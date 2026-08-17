const defaultDownload = require('./strategies/defaultDownload');
const limeTorr = require('./strategies/limeTorr');
const torrDownload = require('./strategies/torrDownload');
const cloudflareProtected = require('./strategies/cloudflareProtected');
const logger = require('../../utils/logger');

class StrategyManager {
  constructor() {
    // Strategy priority pipeline:
    // 1. Direct Magnet URL
    // 2. Specific LimeTorrents Indexer / Domain
    // 3. Direct .torrent Binary / Prowlarr Link
    // 4. Cloudflare Protected Fallback
    this.strategies = [
      defaultDownload,
      limeTorr,
      torrDownload,
      cloudflareProtected,
    ];
    this.logger = logger;
  }

  /**
   * Find the most appropriate strategy for a given source URL & context
   * @param {string} sourceUrl
   * @param {Object} context { indexer, torrentObject, ... }
   */
  findStrategy(sourceUrl, context = {}) {
    for (const strategy of this.strategies) {
      if (strategy.canHandle(sourceUrl, context)) {
        return strategy;
      }
    }
    // Default fallback to magnet/direct URL handler
    return defaultDownload;
  }

  /**
   * Execute a specific strategy by name
   */
  async executeStrategy(name, sourceUrl, savePath, context) {
    const strategy = this.strategies.find(s => s.name === name);
    if (!strategy) {
      throw new Error(`Strategy "${name}" not found in StrategyManager registry`);
    }
    return await strategy.handle(sourceUrl, savePath, context);
  }

  /**
   * Resolve and process a torrent download request
   * @param {string} sourceUrl
   * @param {string} savePath
   * @param {Object} context { client, strategyManager, torrentObject, indexer }
   */
  async processDownload(sourceUrl, savePath, context) {
    const strategy = this.findStrategy(sourceUrl, context);
    this.logger.info('StrategyManager', `Selected strategy "${strategy.name}"`, {
      source: (sourceUrl || '').slice(0, 80),
      indexer: context.indexer,
      title: context.torrentObject?.title,
      savePath,
    });
    return await strategy.handle(sourceUrl, savePath, context);
  }
}

module.exports = new StrategyManager();
