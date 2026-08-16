const axios = require('axios');
const BaseDownloadStrategy = require('./baseStrategy');
const flaresolverrService = require('../../flaresolverr');

class LimeTorrDownloadStrategy extends BaseDownloadStrategy {
  constructor() {
    super('LimeTorrHtmlScraper');
  }

  /**
   * Matches LimeTorrents URLs or HTML page detail links
   */
  canHandle(sourceUrl) {
    if (!sourceUrl || typeof sourceUrl !== 'string') return false;
    const trimmed = sourceUrl.trim().toLowerCase();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return false;
    }

    return (
      trimmed.includes('limetorrents') ||
      trimmed.includes('lime-torrents') ||
      trimmed.includes('.html') ||
      trimmed.includes('.htm') ||
      trimmed.includes('/torrent/')
    );
  }

  /**
   * Scrape LimeTorrents HTML page, extract magnet or .torrent links, and fallback to FlareSolverr if blocked
   */
  async handle(sourceUrl, savePath, context) {
    const pageUrl = sourceUrl.trim();
    console.log(`[LimeTorrDownloadStrategy] Processing LimeTorrents/HTML details page: ${pageUrl.slice(0, 90)}...`);

    let htmlContent = null;

    // Phase 1: Try standard axios request
    try {
      const headers = this.getDefaultHeaders();
      const response = await axios.get(pageUrl, {
        headers,
        timeout: 10000,
        maxRedirects: 5,
      });

      if (typeof response.data === 'string') {
        htmlContent = response.data;
      } else if (Buffer.isBuffer(response.data)) {
        htmlContent = response.data.toString('utf8');
      }
    } catch (err) {
      console.warn(`[LimeTorrDownloadStrategy] Direct HTML fetch encountered error (${err.message}). Checking FlareSolverr...`);
      // If direct fetch got 403 / 503 (Cloudflare challenge) and FlareSolverr is enabled, attempt bypass
      if (flaresolverrService.enabled) {
        try {
          console.log(`[LimeTorrDownloadStrategy] Engaging FlareSolverr for Cloudflare bypass on ${pageUrl}...`);
          htmlContent = await flaresolverrService.extractHtml(pageUrl);
        } catch (flareErr) {
          console.warn(`[LimeTorrDownloadStrategy] FlareSolverr bypass failed: ${flareErr.message}`);
        }
      }
    }

    // Phase 2: Parse extracted HTML for Magnet URI or direct .torrent link
    if (htmlContent) {
      // 1. Look for magnet link
      const magnet = this.extractMagnetFromHtml(htmlContent);
      if (magnet) {
        console.log('[LimeTorrDownloadStrategy] Successfully extracted magnet link from LimeTorrents HTML DOM!');
        return await context.client.addTorrentByUrl(magnet, savePath);
      }

      // 2. Look for LimeTorrents direct download button link (e.g. href="http://itorrents.org/torrent/..." or "/download/...")
      const itorrentMatch = htmlContent.match(/href=["'](https?:\/\/[^"']+\.torrent[^"']*)["']/i);
      if (itorrentMatch) {
        const directTorrentUrl = itorrentMatch[1];
        console.log(`[LimeTorrDownloadStrategy] Found direct .torrent link on page: ${directTorrentUrl}`);
        return await context.strategyManager.executeStrategy('TorrentBinary', directTorrentUrl, savePath, context);
      }
    }

    // Phase 3: Fallback - dispatch raw URL directly to qBittorrent client
    console.warn('[LimeTorrDownloadStrategy] Could not parse links from HTML. Delegating raw URL to qBittorrent desktop client...');
    return await context.client.addTorrentByUrl(pageUrl, savePath);
  }
}

module.exports = new LimeTorrDownloadStrategy();
