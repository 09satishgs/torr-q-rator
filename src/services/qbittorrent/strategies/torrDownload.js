const axios = require('axios');
const config = require('../../../config');
const logger = require('../../../utils/logger');

class TorrDownloadStrategy {
  constructor() {
    this.name = 'TorrentBinary';
  }

  /**
   * Check if the download URL is a valid HTTP/HTTPS URL
   * @param {string} downloadUrl
   */
  isValidUrl(downloadUrl) {
    if (!downloadUrl || typeof downloadUrl !== 'string') return false;
    const trimmed = downloadUrl.trim().toLowerCase();
    return trimmed.startsWith('http://') || trimmed.startsWith('https://');
  }

  getDefaultHeaders() {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'application/x-bittorrent,application/octet-stream,*/*;q=0.8',
    };
    if (config.prowlarr.apiKey) {
      headers['X-Api-Key'] = config.prowlarr.apiKey;
    }
    return headers;
  }

  /**
   * Download .torrent binary buffer and upload directly to qBittorrent
   * @param {string} downloadUrl
   * @param {string} savePath
   * @param {Object} context { client, torrent }
   */
  async handle(downloadUrl, savePath, context) {
    let url = downloadUrl.trim();
    logger.info('TorrentBinary', `Downloading .torrent file from: ${url.slice(0, 90)}...`, {
      savePath,
      title: context.torrent?.title,
      indexer: context.torrent?.indexer,
    });

    // Inject Prowlarr API key if downloading through Prowlarr and key is missing in query string
    if (url.includes('prowlarr') && config.prowlarr.apiKey && !url.includes('apikey=')) {
      const sep = url.includes('?') ? '&' : '?';
      url = `${url}${sep}apikey=${config.prowlarr.apiKey}`;
    }

    try {
      const response = await axios.get(url, {
        headers: this.getDefaultHeaders(),
        responseType: 'arraybuffer',
        timeout: 15000,
        maxRedirects: 5,
      });

      const fileBuffer = Buffer.from(response.data);

      // Check if response text was actually a Magnet URI (returned by some indexer redirect endpoints)
      const textSample = fileBuffer.slice(0, 500).toString('utf8').trim();
      if (textSample.startsWith('magnet:?')) {
        logger.info('TorrentBinary', 'Download URL returned a Magnet URI. Forwarding to qBittorrent URL queue...');
        const res = await context.client.addTorrentByUrl(textSample, savePath);
        if (!res || !res.ok) throw new Error(res?.error || 'Failed to add magnet URL returned by endpoint');
        return res;
      }

      if (fileBuffer.length > 0) {
        logger.info('TorrentBinary', `Downloaded .torrent buffer (${fileBuffer.length} bytes). Uploading multipart to qBittorrent...`);
        const res = await context.client.uploadTorrentFile(fileBuffer, savePath);
        if (!res || !res.ok) throw new Error(res?.error || 'Failed to upload .torrent binary buffer to qBittorrent');
        return res;
      }

      throw new Error('Received 0 bytes from torrent download URL');
    } catch (error) {
      logger.warn('TorrentBinary', `Direct buffer download failed (${error.message}). Attempting fallback URL submission to qBittorrent...`);
      const fallbackRes = await context.client.addTorrentByUrl(url, savePath);
      if (!fallbackRes || !fallbackRes.ok) {
        throw new Error(`Torrent download and upload failed: ${error.message} | URL fallback: ${fallbackRes?.error || 'failed'}`);
      }
      return fallbackRes;
    }
  }
}

module.exports = new TorrDownloadStrategy();
