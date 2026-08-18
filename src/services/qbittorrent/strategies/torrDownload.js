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
   * Download .torrent binary buffer or resolve redirected magnet and upload to qBittorrent
   * @param {string} downloadUrl
   * @param {string} savePath
   * @param {Object} context { client, torrent }
   */
  async handle(downloadUrl, savePath, context) {
    let currentUrl = downloadUrl.trim();
    logger.info('TorrentBinary', `Downloading .torrent file from: ${currentUrl.slice(0, 90)}...`, {
      savePath,
      title: context.torrent?.title,
      indexer: context.torrent?.indexer,
    });

    // Inject Prowlarr API key if downloading through Prowlarr and key is missing in query string
    if (currentUrl.includes('prowlarr') && config.prowlarr.apiKey && !currentUrl.includes('apikey=')) {
      const sep = currentUrl.includes('?') ? '&' : '?';
      currentUrl = `${currentUrl}${sep}apikey=${config.prowlarr.apiKey}`;
    }

    let redirectCount = 0;
    const maxRedirects = 6;

    while (redirectCount < maxRedirects) {
      try {
        const response = await axios.get(currentUrl, {
          headers: this.getDefaultHeaders(),
          responseType: 'arraybuffer',
          timeout: 20000,
          maxRedirects: 0,
          validateStatus: (status) => status >= 200 && status < 400,
        });

        // Intercept 3xx redirects (301, 302, 303, 307, 308)
        if (response.status >= 300 && response.status < 400 && response.headers.location) {
          const redirectLoc = response.headers.location.trim();
          logger.info('TorrentBinary', `Detected HTTP ${response.status} redirect -> ${redirectLoc.slice(0, 70)}...`);

          if (redirectLoc.toLowerCase().startsWith('magnet:?')) {
            logger.info('TorrentBinary', 'Redirect is a Magnet URI! Forwarding to qBittorrent URL queue...');
            const res = await context.client.addTorrentByUrl(redirectLoc, savePath);
            if (!res || !res.ok) throw new Error(res?.error || 'Failed to add magnet URL returned by endpoint');
            return res;
          }

          if (redirectLoc.startsWith('http://') || redirectLoc.startsWith('https://')) {
            currentUrl = redirectLoc;
          } else {
            currentUrl = new URL(redirectLoc, currentUrl).toString();
          }
          redirectCount++;
          continue;
        }

        const fileBuffer = Buffer.from(response.data);

        // Check if response text was actually a Magnet URI in body
        const textSample = fileBuffer.slice(0, 500).toString('utf8').trim();
        if (textSample.toLowerCase().startsWith('magnet:?')) {
          logger.info('TorrentBinary', 'Download URL body contained a Magnet URI. Forwarding to qBittorrent URL queue...');
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
        // Catch magnet location from error headers or message
        const locationHeader = error.response?.headers?.location;
        if (locationHeader && locationHeader.trim().toLowerCase().startsWith('magnet:?')) {
          logger.info('TorrentBinary', 'Recovered Magnet URI from error redirect header. Forwarding to qBittorrent...');
          return await context.client.addTorrentByUrl(locationHeader.trim(), savePath);
        }

        const msgMatch = error.message && error.message.match(/magnet:\?[^\s'"]+/i);
        if (msgMatch && msgMatch[0]) {
          logger.info('TorrentBinary', 'Recovered Magnet URI from error message. Forwarding to qBittorrent...');
          return await context.client.addTorrentByUrl(msgMatch[0], savePath);
        }

        logger.warn('TorrentBinary', `Direct buffer download failed (${error.message}). Attempting fallback URL submission to qBittorrent...`);
        const fallbackRes = await context.client.addTorrentByUrl(currentUrl, savePath);
        if (!fallbackRes || !fallbackRes.ok) {
          throw new Error(`Torrent download and upload failed: ${error.message} | URL fallback: ${fallbackRes?.error || 'failed'}`);
        }
        return fallbackRes;
      }
    }
  }
}

module.exports = new TorrDownloadStrategy();
