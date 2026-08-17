const logger = require('../../../../utils/logger');

/**
 * LimeTorrents Specific Fallback Handler
 * Triggered when both magnetUrl and downloadUrl were empty, invalid, or errored out.
 */
class LimeTorrIndexerHandler {
  constructor() {
    this.name = 'LimeTorrentsHandler';
    this.indexerKeys = ['limetorrents', 'lime-torrents', 'limetorrent'];
  }

  canHandle(indexerName) {
    if (!indexerName || typeof indexerName !== 'string') return false;
    const lower = indexerName.toLowerCase();
    return this.indexerKeys.some(key => lower.includes(key));
  }

  /**
   * Handle LimeTorrents specific fallback flow
   * @param {Object} torrent
   * @param {string} savePath
   * @param {Object} context
   */
  async addTorrent(torrent, savePath, context) {
    logger.error('LimeTorrentsHandler', `[INDEXER FALLBACK] Failed to add torrent for LimeTorrents indexer`, {
      torrent,
      savePath,
      reason: 'Both magnetUrl and downloadUrl were absent, invalid, or failed during transfer',
    });

    return {
      ok: false,
      error: `LimeTorrents indexer fallback: Failed to add torrent "${torrent.title || 'Untitled'}"`,
    };
  }
}

module.exports = new LimeTorrIndexerHandler();
