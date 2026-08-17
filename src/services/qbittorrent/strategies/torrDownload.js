const axios = require('axios');
const BaseDownloadStrategy = require('./baseStrategy');
const config = require('../../../config');

class TorrDownloadStrategy extends BaseDownloadStrategy {
  constructor() {
    super('TorrentBinary');
  }

  /**
   * Matches HTTP/HTTPS URLs ending in .torrent, Prowlarr/Torznab download links, or items with downloadUrl
   */
  canHandle(sourceUrl, context = {}) {
    const rawUrl = sourceUrl || context.torrentObject?.downloadUrl || '';
    if (!rawUrl || typeof rawUrl !== 'string') return false;
    const trimmed = rawUrl.trim().toLowerCase();
    
    // Ignore magnet links (handled by defaultDownload)
    if (trimmed.startsWith('magnet:?')) return false;

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return true;
    }
    return false;
  }

  /**
   * Download .torrent binary buffer, inspect for redirects/magnets, and upload to qBittorrent
   */
  async handle(sourceUrl, savePath, context) {
    let downloadUrl = (sourceUrl || context.torrentObject?.downloadUrl || '').trim();
    this.logger.info('TorrentBinary', `Fetching .torrent payload from: ${downloadUrl.slice(0, 90)}...`, {
      indexer: context.indexer,
      title: context.torrentObject?.title,
      savePath,
    });

    // Inject Prowlarr API key if downloading through Prowlarr and key is missing in query string
    if (downloadUrl.includes('prowlarr') && config.prowlarr.apiKey && !downloadUrl.includes('apikey=')) {
      const sep = downloadUrl.includes('?') ? '&' : '?';
      downloadUrl = `${downloadUrl}${sep}apikey=${config.prowlarr.apiKey}`;
    }

    try {
      const headers = this.getDefaultHeaders();
      const response = await axios.get(downloadUrl, {
        headers,
        responseType: 'arraybuffer',
        timeout: 12000,
        maxRedirects: 5,
      });

      const fileBuffer = Buffer.from(response.data);
      const textSample = fileBuffer.slice(0, 4000).toString('utf8');

      // Case 1: The response was actually a Magnet URI (often returned by some indexer redirect endpoints)
      if (textSample.trim().startsWith('magnet:?')) {
        this.logger.info('TorrentBinary', 'Downloaded payload is a Magnet URI string. Routing to qBittorrent addTorrentByUrl...');
        return await context.client.addTorrentByUrl(textSample.trim(), savePath);
      }

      // Case 2: The response was an HTML page with embedded magnet link
      const embeddedMagnet = this.extractMagnetFromHtml(textSample);
      if (embeddedMagnet) {
        this.logger.info('TorrentBinary', 'Downloaded payload contained HTML with embedded Magnet URI.');
        return await context.client.addTorrentByUrl(embeddedMagnet, savePath);
      }

      // Case 3: Verify binary .torrent file buffer
      if (fileBuffer.length > 0) {
        this.logger.info('TorrentBinary', `Validated .torrent binary buffer (${fileBuffer.length} bytes). Uploading multipart to qBittorrent...`);
        return await context.client.uploadTorrentFile(fileBuffer, savePath);
      }

      throw new Error('Received 0 bytes from .torrent URL');
    } catch (error) {
      this.logger.warn('TorrentBinary', `Binary download failed (${error.message}). Falling back to direct URL submission to qBittorrent...`);
      // Fallback: Dispatch URL directly to qBittorrent (which can download over its own VPN network adapter)
      return await context.client.addTorrentByUrl(downloadUrl, savePath);
    }
  }
}

module.exports = new TorrDownloadStrategy();
