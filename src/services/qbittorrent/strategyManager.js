const defaultDownload = require('./strategies/defaultDownload');
const torrDownload = require('./strategies/torrDownload');
const limeTorr = require('./strategies/limeTorr');
const cloudflareProtected = require('./strategies/cloudflareProtected');

class StrategyManager {
  constructor() {
    // Strategy priority pipeline:
    // 1. Magnet direct format
    // 2. LimeTorrents & HTML scraping
    // 3. .torrent binary download / Prowlarr link
    // 4. Cloudflare protected fallback
    this.strategies = [
      defaultDownload,
      limeTorr,
      torrDownload,
      cloudflareProtected,
    ];
  }

  /**
   * Find the most appropriate strategy for a given source URL
   * @param {string} sourceUrl
   */
  findStrategy(sourceUrl) {
    for (const strategy of this.strategies) {
      if (strategy.canHandle(sourceUrl)) {
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
   * @param {Object} context
   */
  async processDownload(sourceUrl, savePath, context) {
    const strategy = this.findStrategy(sourceUrl);
    console.log(`[StrategyManager] Selected strategy "${strategy.name}" for input "${sourceUrl.slice(0, 70)}..."`);
    return await strategy.handle(sourceUrl, savePath, context);
  }
}

module.exports = new StrategyManager();
