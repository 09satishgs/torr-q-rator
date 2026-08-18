const config = require('../../config');
const logger = require('../../utils/logger');
const seedrClient = require('./seedrClient');
const seedrQueue = require('./seedrQueue');
const seedrDownloader = require('./seedrDownloader');
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
      const matchingTorrent = activeTorrents.find(t => 
        (item.seedrTorrentId && String(t.id) === String(item.seedrTorrentId)) ||
        (t.name && item.title && t.name.toLowerCase().includes(item.title.substring(0, 15).toLowerCase()))
      );

      if (matchingTorrent) {
        const cloudProgress = Math.min(100, Math.max(0, Math.round(matchingTorrent.progress || 0)));
        logger.info('SeedrWorker', `Task "${item.title}" is downloading in Seedr Cloud: ${cloudProgress}%`);
        seedrQueue.updateItem(item.id, {
          status: 'downloading_seedr',
          progress: cloudProgress,
          seedrTorrentId: matchingTorrent.id,
        });
        return;
      }

      // Case B: Cloud download finished - Torrent converted to a Folder or File in Seedr
      // Look for matching folder or file in Seedr root
      const matchingFolder = folders.find(f => 
        (item.seedrFolderId && String(f.id) === String(item.seedrFolderId)) ||
        (f.name && item.title && (f.name.toLowerCase().includes(item.title.substring(0, 15).toLowerCase()) || item.title.toLowerCase().includes(f.name.substring(0, 15).toLowerCase())))
      );

      const matchingFile = files.find(f => 
        (item.seedrFileId && String(f.id) === String(item.seedrFileId)) ||
        (f.name && item.title && (f.name.toLowerCase().includes(item.title.substring(0, 15).toLowerCase()) || item.title.toLowerCase().includes(f.name.substring(0, 15).toLowerCase())))
      );

      if (matchingFolder || matchingFile) {
        logger.info('SeedrWorker', `Task "${item.title}" completed in Seedr cloud! Starting local direct download...`);
        seedrQueue.updateItem(item.id, {
          status: 'downloading_local',
          seedrFolderId: matchingFolder ? matchingFolder.id : null,
          seedrFileId: matchingFile ? matchingFile.id : null,
        });

        // Set up AbortController for cancel capability
        this.activeAbortController = new AbortController();

        try {
          if (matchingFile) {
            // Single file download
            const directUrl = await seedrClient.getFileUrl(matchingFile.id);
            if (!directUrl) throw new Error(`Could not obtain direct URL for Seedr file ${matchingFile.id}`);

            await seedrDownloader.downloadFile(
              directUrl,
              item.savePath || config.defaultDownloadDir,
              matchingFile.name,
              (progressData) => {
                seedrQueue.updateItem(item.id, {
                  progress: progressData.percent,
                  speed: progressData.speed,
                });
              },
              this.activeAbortController
            );
          } else if (matchingFolder) {
            // Folder download: Inspect files inside folder
            const folderDetails = await seedrClient.getFolder(matchingFolder.id);
            const folderFiles = folderDetails.files || [];

            if (folderFiles.length > 0) {
              const targetSubDir = path.join(item.savePath || config.defaultDownloadDir, matchingFolder.name);
              for (const subFile of folderFiles) {
                const subUrl = await seedrClient.getFileUrl(subFile.id);
                if (subUrl) {
                  await seedrDownloader.downloadFile(
                    subUrl,
                    targetSubDir,
                    subFile.name,
                    (progressData) => {
                      seedrQueue.updateItem(item.id, {
                        progress: progressData.percent,
                        speed: progressData.speed,
                      });
                    },
                    this.activeAbortController
                  );
                }
              }
            } else {
              // Fallback: Download whole folder archive as zip
              const archiveUrl = await seedrClient.getFolderDownloadUrl(matchingFolder.id);
              if (!archiveUrl) throw new Error(`Could not obtain archive URL for Seedr folder ${matchingFolder.id}`);

              await seedrDownloader.downloadFile(
                archiveUrl,
                item.savePath || config.defaultDownloadDir,
                `${matchingFolder.name}.zip`,
                (progressData) => {
                  seedrQueue.updateItem(item.id, {
                    progress: progressData.percent,
                    speed: progressData.speed,
                  });
                },
                this.activeAbortController
              );
            }
          }

          // Step: Local Download Finished Successfully -> Delete Cloud Files from Seedr to Free 5GB Quota
          logger.info('SeedrWorker', `Local download finished for "${item.title}". Cleaning up Seedr cloud storage...`);
          if (matchingFolder) {
            await seedrClient.deleteFolder(matchingFolder.id).catch(e => logger.warn('SeedrWorker', `Cloud folder cleanup error: ${e.message}`));
          }
          if (matchingFile) {
            await seedrClient.deleteFile(matchingFile.id).catch(e => logger.warn('SeedrWorker', `Cloud file cleanup error: ${e.message}`));
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
            logger.error('SeedrWorker', `Local download failed for "${item.title}": ${downloadErr.message}`);
            // Treat as failed, cleanup Seedr
            if (matchingFolder) await seedrClient.deleteFolder(matchingFolder.id).catch(() => {});
            if (matchingFile) await seedrClient.deleteFile(matchingFile.id).catch(() => {});

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

      // Case C: Neither active torrent nor completed folder/file found in Seedr (Errored / Removed on Seedr)
      logger.warn('SeedrWorker', `Active task "${item.title}" not found in Seedr transfers or folders. Marking as failed.`);
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

      // Upload magnet or torrent to Seedr
      let uploadResult = null;
      if (nextItem.magnetUrl && nextItem.magnetUrl.startsWith('magnet:?')) {
        uploadResult = await seedrClient.addMagnet(nextItem.magnetUrl);
      } else if (nextItem.downloadUrl) {
        uploadResult = await seedrClient.addTorrentUrl(nextItem.downloadUrl);
      } else {
        throw new Error('No valid magnetUrl or downloadUrl found on queued item');
      }

      const seedrId = uploadResult?.userTorrentId || uploadResult?.id || null;
      seedrQueue.updateItem(nextItem.id, {
        status: 'started',
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
}

module.exports = new SeedrWorker();
