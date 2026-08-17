const BaseDownloadStrategy = require('./baseStrategy');
const flaresolverrService = require('../../flaresolverr');

class CloudflareProtectedStrategy extends BaseDownloadStrategy {
  constructor() {
    super('CloudflareProtected');
  }

  /**
   * Matches general URLs that might require Cloudflare resolution
   */
  canHandle(sourceUrl, context = {}) {
    if (!flaresolverrService.enabled) return false;
    const rawUrl = sourceUrl || context.torrentObject?.downloadUrl || '';
    if (!rawUrl || typeof rawUrl !== 'string') return false;
    const trimmed = rawUrl.trim().toLowerCase();
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
    const pageUrl = (sourceUrl || context.torrentObject?.downloadUrl || '').trim();
    this.logger.info('CloudflareProtected', `Solving URL with FlareSolverr: ${pageUrl.slice(0, 90)}...`, {
      indexer: context.indexer,
      title: context.torrentObject?.title,
      savePath,
    });

    const result = await flaresolverrService.solveUrl(pageUrl);
    if (result.ok && result.html) {
      const magnet = this.extractMagnetFromHtml(result.html);
      if (magnet) {
        this.logger.info('CloudflareProtected', 'Extracted magnet link via FlareSolverr clearance!');
        return await context.client.addTorrentByUrl(magnet, savePath);
      }

      // Check for .torrent link
      const torrentMatch = result.html.match(/href=["'](https?:\/\/[^"']+\.torrent[^"']*)["']/i);
      if (torrentMatch) {
        return await context.strategyManager.executeStrategy('TorrentBinary', torrentMatch[1], savePath, context);
      }
    }

    // Fallback: Dispatch to qBittorrent
    this.logger.warn('CloudflareProtected', 'FlareSolverr did not extract direct links, delegating to qBittorrent client...');
    return await context.client.addTorrentByUrl(pageUrl, savePath);
  }
}

module.exports = new CloudflareProtectedStrategy();
