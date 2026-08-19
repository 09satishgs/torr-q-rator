const config = require('../../config');
const logger = require('../../utils/logger');
const seedrClient = require('./seedrClient');
const seedrQueue = require('./seedrQueue');
const seedrDownloader = require('./seedrDownloader');
const torrentHelper = require('../../utils/torrentHelper');
const path = require('path');

class SeedrWorker {
  constructor() {
    this.intervalHandle = null;
    this.isProcessing = false;
    this.activeAbortController = null;
  }

  /**
   * Start the 5-minute recurring background worker
   */
  start() {
    if (this.intervalHandle) return;

    const intervalMs = config.seedr.checkIntervalMs || 5 * 60 * 1000;
    logger.info('SeedrWorker', `Starting Seedr background worker (Interval: ${intervalMs / 1000}s)`);

    // Initial check after 5 seconds
    setTimeout(() => {
      this.tick().catch(err => logger.error('SeedrWorker', `Error in initial worker tick: ${err.message}`));
    }, 5000);

    this.intervalHandle = setInterval(() => {
      this.tick().catch(err => logger.error('SeedrWorker', `Error in periodic worker tick: ${err.message}`));
    }, intervalMs);
  }

  /**
   * Stop worker
   */
  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      logger.info('SeedrWorker', 'Seedr background worker stopped');
    }
  }

  /**
   * Immediately trigger a tick (e.g. after adding or cancelling an item)
   */
  async triggerCheck() {
    logger.info('SeedrWorker', 'Manual worker check triggered');
    return this.tick();
  }

  /**
   * Main orchestrator tick executed periodically
   */
  async tick() {
    if (this.isProcessing) {
      logger.debug('SeedrWorker', 'Worker tick skipped: previous tick still processing');
      return;
    }

    // If Seedr credentials/token not configured, skip
    if (!config.seedr.token && (!config.seedr.username || !config.seedr.password)) {
      logger.debug('SeedrWorker', 'Seedr credentials not configured in environment. Skipping tick.');
      return;
    }

    this.isProcessing = true;
    try {
      // Step 0: Maintain 100-item sliding window
      seedrQueue.pruneCompleted(100);

      // Step 1: Check active item in local queue
      let activeItem = seedrQueue.getActiveItem();

      if (activeItem) {
        await this.handleActiveItem(activeItem);
      } else {
        // Step 2: If no active item, check if there is a queued item waiting
        await this.startNextQueuedItem();
      }
    } catch (err) {
      logger.error('SeedrWorker', `Error in Seedr worker execution: ${err.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Handle the currently active Seedr download item
   */
  async handleActiveItem(item) {
    logger.info('SeedrWorker', `Checking status for active task "${item.title}" [Status: ${item.status}]`);

    try {
      const rootFolder = await seedrClient.getFolder(0);
      const activeTorrents = rootFolder.torrents || [];
      const folders = rootFolder.folders || [];
      const files = rootFolder.files || [];

      // Case A: Torrent is currently downloading in Seedr Cloud
      // If there are ANY active torrent transfers in Seedr, update progress and wait
      if (activeTorrents.length > 0) {
        const activeT = activeTorrents[0];
        const cloudProgress = Math.min(100, Math.max(0, Math.round(activeT.progress || 0)));
        logger.info('SeedrWorker', `Task "${item.title}" is downloading in Seedr Cloud: ${cloudProgress}% (${activeT.name || 'Transfer'})`);
        seedrQueue.updateItem(item.id, {
          status: 'downloading_seedr',
          progress: cloudProgress,
          seedrTorrentId: activeT.id,
        });
        return;
      }

      // Case B: Cloud download finished! We have completed folders or files in Seedr cloud
      if (folders.length > 0 || files.length > 0) {
        logger.info('SeedrWorker', `Task "${item.title}" completed in Seedr cloud! (Found ${folders.length} folder(s), ${files.length} file(s)). Starting local download...`);
        seedrQueue.updateItem(item.id, {
          status: 'downloading_local',
        });

        // Set up AbortController for cancel capability
        this.activeAbortController = new AbortController();
        const destinationDir = item.savePath || config.defaultDownloadDir;

        try {
          // 1. Process and download each folder in Seedr cloud
          for (const folder of folders) {
            const folderName = folder.name || folder.fullname || item.title || 'download';
            logger.info('SeedrWorker', `Inspecting folder "${folderName}" (ID: ${folder.id})...`);

            let folderDetails = null;
            try {
              folderDetails = await seedrClient.getFolder(folder.id);
            } catch (folderInspectErr) {
              logger.warn('SeedrWorker', `Could not inspect folder ${folder.id} contents: ${folderInspectErr.message}`);
            }

            const folderFiles = folderDetails?.files || [];

            if (folderFiles.length > 0) {
              logger.info('SeedrWorker', `Folder "${folderName}" has ${folderFiles.length} file(s). Downloading direct files...`);
              const targetFolderDir = folderFiles.length > 1 ? path.join(destinationDir, folderName) : destinationDir;

              for (const subFile of folderFiles) {
                const subFileName = subFile.name || 'file';
                logger.info('SeedrWorker', `Downloading file "${subFileName}" (ID: ${subFile.id || subFile.folder_file_id})...`);
                const fileDownloadInfo = await seedrClient.getFileDownload(subFile.id || subFile.folder_file_id);

                await seedrDownloader.downloadFile(
                  fileDownloadInfo.url,
                  targetFolderDir,
                  subFileName,
                  (progressData) => {
                    seedrQueue.updateItem(item.id, {
                      progress: progressData.percent,
                      speed: progressData.speed,
                    });
                  },
                  this.activeAbortController,
                  fileDownloadInfo.headers
                );
              }
            } else {
              // Fallback: Download whole folder archive as zip
              logger.info('SeedrWorker', `Downloading folder "${folderName}" (ID: ${folder.id}) as ZIP archive...`);
              const zipDownloadInfo = await seedrClient.getFolderZipDownload(folder.id);
              const zipFileName = `${folderName}.zip`;

              await seedrDownloader.downloadFile(
                zipDownloadInfo.url,
                destinationDir,
                zipFileName,
                (progressData) => {
                  seedrQueue.updateItem(item.id, {
                    progress: progressData.percent,
                    speed: progressData.speed,
                  });
                },
                this.activeAbortController,
                zipDownloadInfo.headers
              );
            }

            // Only delete folder from Seedr cloud AFTER successful download
            logger.info('SeedrWorker', `Download verified for folder "${folderName}". Deleting from Seedr cloud...`);
            await seedrClient.deleteFolder(folder.id).catch(e => logger.warn('SeedrWorker', `Cloud folder delete error: ${e.message}`));
          }

          // 2. Download any loose files in Seedr cloud (if any)
          for (const file of files) {
            const fileName = file.name || 'file';
            logger.info('SeedrWorker', `Downloading loose file "${fileName}" (ID: ${file.id || file.folder_file_id})...`);
            const fileDownloadInfo = await seedrClient.getFileDownload(file.id || file.folder_file_id);

            await seedrDownloader.downloadFile(
              fileDownloadInfo.url,
              destinationDir,
              fileName,
              (progressData) => {
                seedrQueue.updateItem(item.id, {
                  progress: progressData.percent,
                  speed: progressData.speed,
                });
              },
              this.activeAbortController,
              fileDownloadInfo.headers
            );

            // Only delete file from Seedr cloud AFTER successful download
            logger.info('SeedrWorker', `Download verified for file "${fileName}". Deleting from Seedr cloud...`);
            await seedrClient.deleteFile(file.id || file.folder_file_id).catch(e => logger.warn('SeedrWorker', `Cloud file delete error: ${e.message}`));
          }

          // Mark completed
          seedrQueue.updateItem(item.id, {
            status: 'completed',
            progress: 100,
            speed: 0,
            completedAt: Date.now(),
          });
          logger.info('SeedrWorker', `Task "${item.title}" successfully completed and Seedr storage freed!`);

          this.activeAbortController = null;

          // Start next in queue
          await this.startNextQueuedItem();
        } catch (downloadErr) {
          if (downloadErr.name === 'CanceledError' || downloadErr.message?.includes('canceled') || downloadErr.message?.includes('aborted')) {
            logger.warn('SeedrWorker', `Local download for "${item.title}" was aborted`);
          } else {
            logger.error('SeedrWorker', `Local download failed for "${item.title}": ${downloadErr.message}. Preserving Seedr cloud files for retry.`);
            // NOTE: DO NOT delete folders/files on download failure so user can retry!

            seedrQueue.updateItem(item.id, {
              status: 'failed',
              error: downloadErr.message,
              completedAt: Date.now(),
            });

            this.activeAbortController = null;
            // Advance to next queued item
            await this.startNextQueuedItem();
          }
        }
        return;
      }

      // Case C: Neither active torrent nor folders/files found in Seedr
      // Give a 30-second grace window after item was marked started
      const elapsedSinceStart = Date.now() - (item.startedAt || item.addedAt || 0);
      if (elapsedSinceStart < 30000) {
        logger.info('SeedrWorker', `Task "${item.title}" recently started (${Math.round(elapsedSinceStart / 1000)}s ago). Waiting for Seedr to register.`);
        return;
      }

      logger.warn('SeedrWorker', `Active task "${item.title}" not found in Seedr transfers or folders after ${Math.round(elapsedSinceStart / 1000)}s. Marking as failed.`);
      seedrQueue.updateItem(item.id, {
        status: 'failed',
        error: 'Torrent did not complete or was removed from Seedr cloud',
        completedAt: Date.now(),
      });

      // Advance to next queued item
      await this.startNextQueuedItem();
    } catch (err) {
      logger.error('SeedrWorker', `Error checking active item "${item.title}": ${err.message}`);
    }
  }

  /**
   * Start the next waiting item from the queue
   */
  async startNextQueuedItem() {
    const nextItem = seedrQueue.getNextQueuedItem();
    if (!nextItem) {
      logger.debug('SeedrWorker', 'No queued tasks waiting in Seedr queue.');
      return;
    }

    logger.info('SeedrWorker', `Picking next queued item: "${nextItem.title}" (ID: ${nextItem.id})`);

    try {
      // Ensure Seedr has no active torrent transfers before adding
      const rootFolder = await seedrClient.getFolder(0);
      if (rootFolder.torrents && rootFolder.torrents.length > 0) {
        logger.info('SeedrWorker', `Seedr already has ${rootFolder.torrents.length} active torrent(s). Waiting for current transfer to complete.`);
        return;
      }

      // Resolve magnet URL or fetch torrent payload
      logger.info('SeedrWorker', `Resolving magnet / download URI for "${nextItem.title}"...`);
      const { magnetUrl } = await torrentHelper.resolveMagnet(nextItem);

      let uploadResult = null;
      if (magnetUrl && magnetUrl.startsWith('magnet:?')) {
        logger.info('SeedrWorker', `Dispatching resolved Magnet URI to Seedr API...`);
        uploadResult = await seedrClient.addMagnet(magnetUrl);
      } else if (nextItem.downloadUrl && (nextItem.downloadUrl.startsWith('http://') || nextItem.downloadUrl.startsWith('https://'))) {
        logger.info('SeedrWorker', `Dispatching direct URL to Seedr API...`);
        uploadResult = await seedrClient.addUrl(nextItem.downloadUrl);
      } else {
        throw new Error('Unable to resolve a valid Magnet URI or accessible download URL for Seedr');
      }

      const seedrId = uploadResult?.userTorrentId || uploadResult?.id || null;
      seedrQueue.updateItem(nextItem.id, {
        status: 'started',
        magnetUrl: magnetUrl || nextItem.magnetUrl,
        seedrTorrentId: seedrId,
        startedAt: Date.now(),
        error: null,
      });

      logger.info('SeedrWorker', `Successfully uploaded "${nextItem.title}" to Seedr! (Seedr Torrent ID: ${seedrId})`);
    } catch (err) {
      logger.error('SeedrWorker', `Failed to start queued item "${nextItem.title}": ${err.message}`);
      seedrQueue.updateItem(nextItem.id, {
        status: 'failed',
        error: err.message,
        completedAt: Date.now(),
      });
      // Try next queued item if available
      await this.startNextQueuedItem();
    }
  }

  /**
   * Cancel an item by ID (called from user action)
   */
  async cancelTask(id, reason = 'Cancelled by user') {
    const item = seedrQueue.getItem(id);
    if (!item) {
      throw new Error(`Item ${id} not found in Seedr queue`);
    }

    logger.info('SeedrWorker', `Cancelling Seedr task "${item.title}" (${id})...`);

    // If this item is currently downloading locally, abort HTTP stream
    if (this.activeAbortController && item.status === 'downloading_local') {
      try {
        this.activeAbortController.abort();
      } catch (_) {}
      this.activeAbortController = null;
    }

    // If this item is in Seedr cloud, delete it
    try {
      if (item.seedrTorrentId) {
        await seedrClient.deleteTorrent(item.seedrTorrentId).catch(() => {});
      }
      if (item.seedrFolderId) {
        await seedrClient.deleteFolder(item.seedrFolderId).catch(() => {});
      }
      if (item.seedrFileId) {
        await seedrClient.deleteFile(item.seedrFileId).catch(() => {});
      }
    } catch (cleanupErr) {
      logger.warn('SeedrWorker', `Error cleaning up Seedr resources for cancelled task: ${cleanupErr.message}`);
    }

    seedrQueue.cancelItem(id, reason);

    // If it was active, immediately trigger next in queue
    if (['started', 'downloading_seedr', 'downloading_local'].includes(item.status)) {
      setTimeout(() => {
        this.startNextQueuedItem().catch(e => logger.error('SeedrWorker', `Error starting next task after cancellation: ${e.message}`));
      }, 1000);
    }

    return { ok: true, item: seedrQueue.getItem(id) };
  }

  /**
   * Re-queue a failed or cancelled task for processing
   */
  async retryTask(id) {
    const item = seedrQueue.getItem(id);
    if (!item) {
      throw new Error(`Item ${id} not found in Seedr queue`);
    }

    const updated = seedrQueue.retryItem(id);
    logger.info('SeedrWorker', `Task "${item.title}" re-queued. Triggering worker check...`);

    // If worker has no active items, trigger tick immediately
    const active = seedrQueue.getActiveItem();
    if (!active || active.id === id) {
      setTimeout(() => this.triggerCheck(), 500);
    }

    return { ok: true, item: updated };
  }

  /**
   * Permanently delete a task by ID
   */
  async deleteTask(id) {
    const item = seedrQueue.getItem(id);
    if (!item) {
      return { ok: true, message: 'Item not found or already deleted' };
    }

    // If active, cancel/abort first
    if (['started', 'downloading_seedr', 'downloading_local'].includes(item.status)) {
      await this.cancelTask(id, 'Deleted by user');
    }

    seedrQueue.deleteItem(id);
    return { ok: true, message: 'Item deleted permanently' };
  }
}

module.exports = new SeedrWorker();
