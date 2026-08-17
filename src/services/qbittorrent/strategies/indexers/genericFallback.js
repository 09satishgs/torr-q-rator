const logger = require('../../../../utils/logger');

/**
 * Generic Indexer Fallback Handler
 * Triggered when both magnetUrl and downloadUrl were empty, invalid, or errored out.
 */
class GenericFallbackIndexerHandler {
  constructor() {
    this.name = 'GenericFallbackHandler';
  }

  canHandle() {
    return true;
  }

  /**
   * Handle generic indexer fallback flow
   * @param {Object} torrent
   * @param {string} savePath
   * @param {Object} context
   */
  async addTorrent(torrent, savePath, context) {
    logger.error('GenericFallbackHandler', `[INDEXER FALLBACK] Failed to add torrent for indexer "${torrent.indexer || 'Unknown'}"`, {
      torrent,
      savePath,
      reason: 'Both magnetUrl and downloadUrl were absent, invalid, or failed during transfer',
    });

    return {
      ok: false,
      error: `Indexer fallback error: Unable to add torrent for "${torrent.title || 'Untitled'}" via indexer "${torrent.indexer || 'Unknown'}"`,
    };
  }
}

module.exports = new GenericFallbackIndexerHandler();
