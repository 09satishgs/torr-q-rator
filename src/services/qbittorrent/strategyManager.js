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
   * Main 3-Step Download Resolution Pipeline:
   * 1. Check for valid magnetUrl -> defaultDownload.js (Magnet queue)
   * 2. Check for valid downloadUrl -> torrDownload.js (.torrent buffer upload)
   * 3. Fallback -> Trigger indexer-specific addTorrent flow with error logging
   *
   * @param {Object} torrent Prowlarr torrent object { title, indexer, magnetUrl, downloadUrl, ... }
   * @param {string} savePath Target directory path
   * @param {Object} context { client }
   */
  async processDownload(torrent, savePath, context) {
    if (!torrent || typeof torrent !== 'object') {
      throw new Error('processDownload requires a valid "torrent" object');
    }

    if (!savePath || typeof savePath !== 'string') {
      throw new Error('processDownload requires a valid "savePath" string');
    }

    const executionContext = {
      ...context,
      torrent,
    };

    logger.info('StrategyManager', `Starting download pipeline for "${torrent.title || 'Untitled'}" [${torrent.indexer || 'Unknown'}]`, {
      torrent,
      savePath,
    });

    // Special check for "The Pirate Bay": check for magnetUrl under field "id"
    const isTPB = (torrent.indexer && /the\s*pirate\s*bay/i.test(torrent.indexer)) ||
                  (typeof torrent.id === 'string' && torrent.id.trim().toLowerCase().startsWith('magnet:?'));
    if (isTPB && typeof torrent.id === 'string' && torrent.id.trim().toLowerCase().startsWith('magnet:?')) {
      logger.info('StrategyManager', 'Detected "The Pirate Bay" indexer with magnet in "id" field. Using as magnetUrl.');
      torrent.magnetUrl = torrent.id.trim();
    }

    // Step 1: Check for valid magnetUrl
    const hasMagnet = this.defaultDownload.isValidMagnet(torrent.magnetUrl);
    if (hasMagnet) {
      logger.info('StrategyManager', 'Step 1: Valid magnetUrl found. Attempting magnet download...', {
        magnetUrl: `${torrent.magnetUrl.slice(0, 70)}...`,
        savePath,
      });

      try {
        const magnetResult = await this.defaultDownload.handle(torrent.magnetUrl, savePath, executionContext);
        if (magnetResult && magnetResult.ok) {
          logger.info('StrategyManager', 'Step 1 SUCCESS: Magnet added to qBittorrent successfully.');
          return magnetResult;
        }
        logger.warn('StrategyManager', `Step 1 (Magnet) returned failure (${magnetResult?.error || 'unknown'}). Proceeding to Step 2...`);
      } catch (err) {
        logger.warn('StrategyManager', `Step 1 (Magnet) threw an error: ${err.message}. Proceeding to Step 2...`);
      }
    } else {
      logger.debug('StrategyManager', 'Step 1 SKIPPED: No valid magnetUrl provided.');
    }

    // Step 2: Check for valid downloadUrl (.torrent flow)
    const hasDownloadUrl = this.torrDownload.isValidUrl(torrent.downloadUrl);
    if (hasDownloadUrl) {
      logger.info('StrategyManager', 'Step 2: Valid downloadUrl found. Attempting .torrent buffer download and upload...', {
        downloadUrl: `${torrent.downloadUrl.slice(0, 70)}...`,
        savePath,
      });

      try {
        const torrResult = await this.torrDownload.handle(torrent.downloadUrl, savePath, executionContext);
        if (torrResult && torrResult.ok) {
          logger.info('StrategyManager', 'Step 2 SUCCESS: .torrent binary uploaded to qBittorrent successfully.');
          return torrResult;
        }
        logger.warn('StrategyManager', `Step 2 (.torrent) returned failure (${torrResult?.error || 'unknown'}). Proceeding to Step 3...`);
      } catch (err) {
        logger.warn('StrategyManager', `Step 2 (.torrent) threw an error: ${err.message}. Proceeding to Step 3...`);
      }
    } else {
      logger.debug('StrategyManager', 'Step 2 SKIPPED: No valid downloadUrl provided.');
    }

    // Step 3: Trigger indexer-specific addTorrent flow
    logger.info('StrategyManager', `Step 3: Direct magnet and downloadUrl unavailable or failed. Dispatching to indexer handler for "${torrent.indexer || 'Unknown'}"...`);
    const indexerHandler = this.indexerRegistry.getHandler(torrent.indexer);
    logger.info('StrategyManager', `Invoking indexer handler: "${indexerHandler.name}"`);

    return await indexerHandler.addTorrent(torrent, savePath, executionContext);
  }
}

module.exports = new StrategyManager();
