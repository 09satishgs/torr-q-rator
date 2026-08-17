const defaultDownload = require('./strategies/defaultDownload');
const torrDownload = require('./strategies/torrDownload');
const indexerRegistry = require('./strategies/indexers/indexerRegistry');
const logger = require('../../utils/logger');

class StrategyManager {
  constructor() {
    this.defaultDownload = defaultDownload;
    this.torrDownload = torrDownload;
    this.indexerRegistry = indexerRegistry;
  }

  /**
   * Normalize input into a standard Prowlarr-like torrent object
   * @param {Object|string} input
   */
  normalizeTorrentInput(input) {
    if (!input) return null;
    if (typeof input === 'string') {
      const trimmed = input.trim();
      const isMagnet = trimmed.toLowerCase().startsWith('magnet:?');
      return {
        title: 'Direct Torrent',
        indexer: 'Direct',
        magnetUrl: isMagnet ? trimmed : '',
        downloadUrl: !isMagnet && (trimmed.startsWith('http://') || trimmed.startsWith('https://')) ? trimmed : '',
        id: trimmed,
      };
    }
    return {
      title: input.title || 'Untitled Torrent',
      indexer: input.indexer || input.indexerName || 'Unknown',
      magnetUrl: input.magnetUrl || '',
      downloadUrl: input.downloadUrl || input.link || '',
      id: input.id || input.guid || '',
      size: input.size || 0,
      seeders: input.seeders || 0,
      leechers: input.leechers || 0,
      category: input.category || '',
    };
  }

  /**
   * Primary download resolution pipeline:
   * 1. Check for valid magnetUrl -> defaultDownload.js (Magnet queue)
   * 2. Check for valid downloadUrl -> torrDownload.js (.torrent buffer upload)
   * 3. Fallback -> Indexer specific js handler with mock logging
   *
   * @param {Object|string} torrentInput Full prowlarr torrent object or source
   * @param {string} savePath Target directory path
   * @param {Object} context { client }
   */
  async processDownload(torrentInput, savePath, context) {
    const torrent = this.normalizeTorrentInput(torrentInput);
    if (!torrent) {
      return { ok: false, error: 'Invalid or missing torrent metadata' };
    }

    const executionContext = {
      ...context,
      torrent,
    };

    logger.info('StrategyManager', `Initiating download pipeline for "${torrent.title}" [Indexer: ${torrent.indexer}]`, {
      magnetUrl: torrent.magnetUrl ? `${torrent.magnetUrl.slice(0, 60)}...` : '(none)',
      downloadUrl: torrent.downloadUrl ? `${torrent.downloadUrl.slice(0, 60)}...` : '(none)',
      savePath,
    });

    // Step 1: Check for valid magnetUrl
    if (this.defaultDownload.isValidMagnet(torrent.magnetUrl)) {
      logger.info('StrategyManager', 'Step 1: Valid magnetUrl detected. Executing MagnetDefault strategy...');
      try {
        const magnetResult = await this.defaultDownload.handle(torrent.magnetUrl, savePath, executionContext);
        if (magnetResult && magnetResult.ok) {
          logger.info('StrategyManager', 'Magnet download queued successfully via Step 1.');
          return magnetResult;
        }
        logger.warn('StrategyManager', `Step 1 (Magnet) returned unsuccessful result: ${magnetResult?.error || 'unknown'}. Proceeding to next step.`);
      } catch (err) {
        logger.warn('StrategyManager', `Step 1 (Magnet) failed with exception (${err.message}). Proceeding to next step.`);
      }
    }

    // Step 2: Check for valid downloadUrl (.torrent flow)
    if (this.torrDownload.isValidUrl(torrent.downloadUrl)) {
      logger.info('StrategyManager', 'Step 2: Valid downloadUrl detected. Executing TorrentBinary strategy...');
      try {
        const torrResult = await this.torrDownload.handle(torrent.downloadUrl, savePath, executionContext);
        if (torrResult && torrResult.ok) {
          logger.info('StrategyManager', '.torrent download queued successfully via Step 2.');
          return torrResult;
        }
        logger.warn('StrategyManager', `Step 2 (TorrentBinary) returned unsuccessful result: ${torrResult?.error || 'unknown'}. Proceeding to indexer fallback.`);
      } catch (err) {
        logger.warn('StrategyManager', `Step 2 (TorrentBinary) failed with exception (${err.message}). Proceeding to indexer fallback.`);
      }
    }

    // Step 3: Both absent or failed -> Search for indexer-specific fallback handler
    logger.info('StrategyManager', `Step 3: Direct magnet and downloadUrl absent or failed. Querying indexer handler for "${torrent.indexer}"...`);
    const indexerHandler = this.indexerRegistry.getHandler(torrent.indexer);
    logger.info('StrategyManager', `Executing indexer fallback handler: "${indexerHandler.name}"`);
    return await indexerHandler.handle(torrent, savePath, executionContext);
  }
}

module.exports = new StrategyManager();
