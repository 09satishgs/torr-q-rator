const BaseDownloadStrategy = require('./baseStrategy');

class DefaultDownloadStrategy extends BaseDownloadStrategy {
  constructor() {
    super('MagnetDefault');
  }

  /**
   * Matches any magnet URI format or torrentObjects containing a magnet URL
   */
  canHandle(sourceUrl, context = {}) {
    if (sourceUrl && typeof sourceUrl === 'string' && sourceUrl.trim().toLowerCase().startsWith('magnet:?')) {
      return true;
    }
    if (context.torrentObject?.magnetUrl && context.torrentObject.magnetUrl.startsWith('magnet:?')) {
      return true;
    }
    return false;
  }

  /**
   * Clean and dispatch magnet link to qBittorrent
   */
  async handle(sourceUrl, savePath, context) {
    let cleanMagnet = (sourceUrl || context.torrentObject?.magnetUrl || '').trim();

    // Decode HTML entities if any exist (e.g. &amp; -> &)
    cleanMagnet = cleanMagnet.replace(/&amp;/g, '&');

    // Extract BTIH info hash for logging if present
    const hashMatch = cleanMagnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/i);
    const hashSnippet = hashMatch ? `[BTIH: ${hashMatch[1].substring(0, 8)}...]` : '';

    this.logger.info('MagnetDefault', `Dispatching magnet URI ${hashSnippet} to qBittorrent`, {
      savePath,
      indexer: context.indexer,
      torrentTitle: context.torrentObject?.title,
    });

    return await context.client.addTorrentByUrl(cleanMagnet, savePath);
  }
}

module.exports = new DefaultDownloadStrategy();
