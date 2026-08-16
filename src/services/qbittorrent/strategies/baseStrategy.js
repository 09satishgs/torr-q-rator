const axios = require('axios');
const config = require('../../../config');

class BaseDownloadStrategy {
  constructor(name) {
    this.name = name;
  }

  /**
   * Determine whether this strategy is suited to handle the given source URL / input
   * @param {string} sourceUrl
   * @returns {boolean}
   */
  canHandle(sourceUrl) {
    throw new Error(`Strategy "${this.name}" must implement canHandle()`);
  }

  /**
   * Process the download request and dispatch to qBittorrent client
   * @param {string} sourceUrl
   * @param {string} savePath
   * @param {Object} context Shared client & options context
   * @returns {Promise<{ ok: boolean, message?: string, error?: string, live?: boolean }>}
   */
  async handle(sourceUrl, savePath, context) {
    throw new Error(`Strategy "${this.name}" must implement handle()`);
  }

  /**
   * Helper to build standard headers for remote requests (Prowlarr API key, User-Agent)
   */
  getDefaultHeaders() {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/x-bittorrent,*/*;q=0.8',
    };
    if (config.prowlarr.apiKey) {
      headers['X-Api-Key'] = config.prowlarr.apiKey;
    }
    return headers;
  }

  /**
   * Helper to extract magnet URI from text or HTML
   */
  extractMagnetFromHtml(html) {
    if (!html || typeof html !== 'string') return null;
    const match = html.match(/href=["'](magnet:\?[^"']+)["']/i) || html.match(/(magnet:\?xt=urn:[^\s"'<>]+)/i);
    if (match) {
      const rawMagnet = match[1] || match[0];
      return rawMagnet.replace(/&amp;/g, '&').trim();
    }
    return null;
  }
}

module.exports = BaseDownloadStrategy;
