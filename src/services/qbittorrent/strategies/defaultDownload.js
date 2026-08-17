const logger = require('../../../utils/logger');

class DefaultDownloadStrategy {
  constructor() {
    this.name = 'MagnetDefault';
  }

  /**
   * Check if the magnet URL is valid
   * @param {string} magnetUrl
   */
  isValidMagnet(magnetUrl) {
    if (!magnetUrl || typeof magnetUrl !== 'string') return false;
    return magnetUrl.trim().toLowerCase().startsWith('magnet:?');
  }

  /**
   * Clean and add magnet link to qBittorrent
   * @param {string} magnetUrl
   * @param {string} savePath
   * @param {Object} context { client, torrent }
   */
  async handle(magnetUrl, savePath, context) {
    let cleanMagnet = magnetUrl.trim().replace(/&amp;/g, '&');

    const hashMatch = cleanMagnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/i);
    const hashSnippet = hashMatch ? `[BTIH: ${hashMatch[1].substring(0, 8)}...]` : '';

    logger.info('MagnetDefault', `Queuing magnet URI ${hashSnippet} to qBittorrent`, {
      savePath,
      title: context.torrent?.title,
      indexer: context.torrent?.indexer,
    });

    return await context.client.addTorrentByUrl(cleanMagnet, savePath);
  }
}

module.exports = new DefaultDownloadStrategy();
