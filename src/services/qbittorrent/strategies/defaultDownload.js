const BaseDownloadStrategy = require('./baseStrategy');

class DefaultDownloadStrategy extends BaseDownloadStrategy {
  constructor() {
    super('MagnetDefault');
  }

  /**
   * Matches any magnet URI format
   */
  canHandle(sourceUrl) {
    if (!sourceUrl || typeof sourceUrl !== 'string') return false;
    return sourceUrl.trim().toLowerCase().startsWith('magnet:?');
  }

  /**
   * Clean and dispatch magnet link to qBittorrent
   */
  async handle(sourceUrl, savePath, context) {
    let cleanMagnet = sourceUrl.trim();

    // Decode HTML entities if any exist (e.g. &amp; -> &)
    cleanMagnet = cleanMagnet.replace(/&amp;/g, '&');

    // Extract BTIH info hash for logging if present
    const hashMatch = cleanMagnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/i);
    const hashSnippet = hashMatch ? `[BTIH: ${hashMatch[1].substring(0, 8)}...]` : '';

    console.log(`[DefaultDownloadStrategy] Dispatching magnet URI ${hashSnippet} to qBittorrent...`);
    return await context.client.addTorrentByUrl(cleanMagnet, savePath);
  }
}

module.exports = new DefaultDownloadStrategy();
