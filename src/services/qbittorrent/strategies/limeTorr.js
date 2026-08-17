const axios = require('axios');
const BaseDownloadStrategy = require('./baseStrategy');
const flaresolverrService = require('../../flaresolverr');

class LimeTorrDownloadStrategy extends BaseDownloadStrategy {
  constructor() {
    super('LimeTorrHtmlScraper');
  }

  /**
   * Specifically matches LimeTorrents indexer or explicit LimeTorrents domains
   */
  canHandle(sourceUrl, context = {}) {
    const indexerName = (context.indexer || context.torrentObject?.indexer || '').toLowerCase();
    
    // Explicit indexer match
    if (indexerName.includes('limetorrent') || indexerName.includes('lime-torrent')) {
      return true;
    }

    if (!sourceUrl || typeof sourceUrl !== 'string') return false;
    const trimmed = sourceUrl.trim().toLowerCase();

    // Explicit domain match
    return trimmed.includes('limetorrents.') || trimmed.includes('lime-torrents.');
  }

  /**
   * Scrape LimeTorrents HTML page, extract magnet or .torrent links, and fallback to FlareSolverr if blocked
   */
  async handle(sourceUrl, savePath, context) {
    const pageUrl = (sourceUrl || context.torrentObject?.downloadUrl || '').trim();
    this.logger.info('LimeTorrHtmlScraper', `Processing LimeTorrents details page: ${pageUrl.slice(0, 90)}...`, {
      indexer: context.indexer,
      title: context.torrentObject?.title,
      savePath,
    });

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
      this.logger.warn('LimeTorrHtmlScraper', `Direct HTML fetch failed (${err.message}). Checking FlareSolverr...`);
      // If direct fetch got 403 / 503 (Cloudflare challenge) and FlareSolverr is enabled, attempt bypass
      if (flaresolverrService.enabled) {
        try {
          this.logger.info('LimeTorrHtmlScraper', `Engaging FlareSolverr for Cloudflare bypass on ${pageUrl}...`);
          htmlContent = await flaresolverrService.extractHtml(pageUrl);
        } catch (flareErr) {
          this.logger.warn('LimeTorrHtmlScraper', `FlareSolverr bypass failed: ${flareErr.message}`);
        }
      }
    }

    // Phase 2: Parse extracted HTML for Magnet URI or direct .torrent link
    if (htmlContent) {
      // 1. Look for magnet link
      const magnet = this.extractMagnetFromHtml(htmlContent);
      if (magnet) {
        this.logger.info('LimeTorrHtmlScraper', 'Successfully extracted magnet link from LimeTorrents HTML DOM!');
        return await context.client.addTorrentByUrl(magnet, savePath);
      }

      // 2. Look for LimeTorrents direct download button link (e.g. href="http://itorrents.org/torrent/..." or ".torrent")
      const itorrentMatch = htmlContent.match(/href=["'](https?:\/\/[^"']+\.torrent[^"']*)["']/i);
      if (itorrentMatch) {
        const directTorrentUrl = itorrentMatch[1];
        this.logger.info('LimeTorrHtmlScraper', `Found direct .torrent link on page: ${directTorrentUrl}`);
        return await context.strategyManager.executeStrategy('TorrentBinary', directTorrentUrl, savePath, context);
      }
    }

    // Phase 3: Fallback - dispatch raw URL directly to qBittorrent client
    this.logger.warn('LimeTorrHtmlScraper', 'Could not parse links from HTML. Delegating raw URL to qBittorrent desktop client...');
    return await context.client.addTorrentByUrl(pageUrl, savePath);
  }
}

module.exports = new LimeTorrDownloadStrategy();
