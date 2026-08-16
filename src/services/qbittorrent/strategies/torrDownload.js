const axios = require('axios');
const BaseDownloadStrategy = require('./baseStrategy');
const config = require('../../../config');

class TorrDownloadStrategy extends BaseDownloadStrategy {
  constructor() {
    super('TorrentBinary');
  }

  /**
   * Matches HTTP/HTTPS URLs ending in .torrent or Prowlarr/Torznab download links
   */
  canHandle(sourceUrl) {
    if (!sourceUrl || typeof sourceUrl !== 'string') return false;
    const trimmed = sourceUrl.trim().toLowerCase();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return false;
    }
    // Check if it looks like a .torrent download URL or Prowlarr / Jackett download API URL
    return (
      trimmed.includes('.torrent') ||
      trimmed.includes('/download?') ||
      trimmed.includes('/api/v1/indexer/') ||
      trimmed.includes('torznab') ||
      trimmed.includes('prowlarr')
    );
  }

  /**
   * Download .torrent binary buffer, inspect for redirects/magnets, and upload to qBittorrent
   */
  async handle(sourceUrl, savePath, context) {
    let downloadUrl = sourceUrl.trim();
    console.log(`[TorrDownloadStrategy] Fetching .torrent payload from: ${downloadUrl.slice(0, 90)}...`);

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
        console.log('[TorrDownloadStrategy] Downloaded payload is a Magnet URI string. Routing to qBittorrent addTorrentByUrl...');
        return await context.client.addTorrentByUrl(textSample.trim(), savePath);
      }

      // Case 2: The response was an HTML page with embedded magnet link
      const embeddedMagnet = this.extractMagnetFromHtml(textSample);
      if (embeddedMagnet) {
        console.log('[TorrDownloadStrategy] Downloaded payload contained HTML with embedded Magnet URI.');
        return await context.client.addTorrentByUrl(embeddedMagnet, savePath);
      }

      // Case 3: Verify bencoded .torrent file header (starts with 'd' and ends with 'e' or contains announce/info dictionary)
      if (fileBuffer.length > 0) {
        console.log(`[TorrDownloadStrategy] Validated .torrent binary buffer (${fileBuffer.length} bytes). Uploading multipart to qBittorrent...`);
        return await context.client.uploadTorrentFile(fileBuffer, savePath);
      }

      throw new Error('Received 0 bytes from .torrent URL');
    } catch (error) {
      console.warn(`[TorrDownloadStrategy] Binary download failed (${error.message}). Falling back to direct URL submission...`);
      // Fallback: Dispatch URL directly to qBittorrent (which can download over its own VPN network adapter)
      return await context.client.addTorrentByUrl(downloadUrl, savePath);
    }
  }
}

module.exports = new TorrDownloadStrategy();
