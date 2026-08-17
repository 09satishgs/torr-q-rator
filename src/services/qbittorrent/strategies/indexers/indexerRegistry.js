const limeTorrHandler = require('./limeTorr');
const genericFallbackHandler = require('./genericFallback');
const logger = require('../../../../utils/logger');

class IndexerRegistry {
  constructor() {
    this.handlers = [
      limeTorrHandler,
    ];
  }

  /**
   * Find indexer-specific handler by indexer name or return generic fallback
   * @param {string} indexerName
   */
  getHandler(indexerName) {
    if (indexerName) {
      for (const handler of this.handlers) {
        if (handler.canHandle(indexerName)) {
          logger.debug('IndexerRegistry', `Matched indexer-specific handler "${handler.name}" for "${indexerName}"`);
          return handler;
        }
      }
    }
    logger.debug('IndexerRegistry', `No custom indexer handler for "${indexerName || 'Unknown'}", using GenericFallbackHandler`);
    return genericFallbackHandler;
  }
}

module.exports = new IndexerRegistry();
