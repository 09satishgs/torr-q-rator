const BaseDownloadStrategy = require('./baseStrategy');
const flaresolverrService = require('../../flaresolverr');

class CloudflareProtectedStrategy extends BaseDownloadStrategy {
  constructor() {
    super('CloudflareProtected');
  }

  /**
   * Matches general URLs that might require Cloudflare resolution
   */
  canHandle(sourceUrl) {
    if (!flaresolverrService.enabled) return false;
    if (!sourceUrl || typeof sourceUrl !== 'string') return false;
    const trimmed = sourceUrl.trim().toLowerCase();
    return (
      (trimmed.startsWith('http://') || trimmed.startsWith('https://')) &&
      !trimmed.endsWith('.torrent') &&
      !trimmed.startsWith('magnet:?')
    );
  }

  /**
   * Run URL through FlareSolverr, extract magnet or torrent from solved DOM
   */
  async handle(sourceUrl, savePath, context) {
    const pageUrl = sourceUrl.trim();
    console.log(`[CloudflareProtectedStrategy] Solving URL with FlareSolverr: ${pageUrl.slice(0, 90)}...`);

    const result = await flaresolverrService.solveUrl(pageUrl);
    if (result.ok && result.html) {
      const magnet = this.extractMagnetFromHtml(result.html);
      if (magnet) {
        console.log('[CloudflareProtectedStrategy] Extracted magnet link via FlareSolverr clearance!');
        return await context.client.addTorrentByUrl(magnet, savePath);
      }

      // Check for .torrent link
      const torrentMatch = result.html.match(/href=["'](https?:\/\/[^"']+\.torrent[^"']*)["']/i);
      if (torrentMatch) {
        return await context.strategyManager.executeStrategy('TorrentBinary', torrentMatch[1], savePath, context);
      }
    }

    // Fallback: Dispatch to qBittorrent
    return await context.client.addTorrentByUrl(pageUrl, savePath);
  }
}

module.exports = new CloudflareProtectedStrategy();
