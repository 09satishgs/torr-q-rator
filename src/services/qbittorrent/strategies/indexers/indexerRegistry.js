const limeTorrHandler = require('./limeTorr');
const genericFallbackHandler = require('./genericFallback');
const logger = require('../../../../utils/logger');

class IndexerRegistry {
  constructor() {
    this.handlers = [
      limeTorrHandler,
      // Add future custom indexer fallback handlers here (e.g. 1337x, nyaa, yts, etc.)
    ];
  }

  /**
   * Find indexer-specific handler by indexer name or return generic fallback
   * @param {string} indexerName
   */
  getHandler(indexerName) {
    for (const handler of this.handlers) {
      if (handler.canHandle(indexerName)) {
        logger.debug('IndexerRegistry', `Matched custom indexer handler "${handler.name}" for indexer "${indexerName}"`);
        return handler;
      }
    }
    logger.debug('IndexerRegistry', `No custom handler for "${indexerName}", using GenericFallbackHandler`);
    return genericFallbackHandler;
  }
}

module.exports = new IndexerRegistry();
