const crypto = require('crypto');
const axios = require('axios');
const config = require('../config');
const logger = require('./logger');

class TorrentHelper {
  /**
   * Extract SHA-1 BTIH infoHash from a bencoded .torrent buffer
   * @param {Buffer} buffer
   * @returns {string|null} 40-character hex infoHash
   */
  extractInfoHash(buffer) {
    if (!Buffer.isBuffer(buffer)) return null;

    const infoKey = Buffer.from('4:info');
    const index = buffer.indexOf(infoKey);
    if (index === -1) return null;

    const start = index + 6; // index after '4:info'
    if (buffer[start] !== 0x64) { // 'd' in ASCII
      return null;
    }

    // Traverse bencoded data structures to find matching end 'e'
    let depth = 0;
    let pos = start;
    while (pos < buffer.length) {
      const byte = buffer[pos];
      if (byte === 0x64 || byte === 0x6c) { // 'd' (dict) or 'l' (list)
        depth++;
        pos++;
      } else if (byte === 0x69) { // 'i' integer format: i...e
        pos++;
        while (pos < buffer.length && buffer[pos] !== 0x65) pos++;
        pos++; // skip 'e'
      } else if (byte >= 0x30 && byte <= 0x39) { // '0'-'9' string length format: <len>:<content>
        let numStr = '';
        while (pos < buffer.length && buffer[pos] >= 0x30 && buffer[pos] <= 0x39) {
          numStr += String.fromCharCode(buffer[pos]);
          pos++;
        }
        if (buffer[pos] === 0x3a) { // ':'
          pos++;
          const strLen = parseInt(numStr, 10);
          pos += strLen;
        } else {
          break;
        }
      } else if (byte === 0x65) { // 'e' end of dict/list
        depth--;
        pos++;
        if (depth === 0) {
          const infoDictBuffer = buffer.slice(start, pos);
          return crypto.createHash('sha1').update(infoDictBuffer).digest('hex');
        }
      } else {
        pos++;
      }
    }
    return null;
  }

  /**
   * Resolve a downloadUrl or torrent metadata into a valid Magnet URI
   * @param {Object} item { title, magnetUrl, downloadUrl }
   * @returns {Promise<{ magnetUrl: string|null, fileBuffer: Buffer|null }>}
   */
  async resolveMagnet(item) {
    // 0. Special check for "The Pirate Bay": check for magnetUrl under field "id"
    const isTPB = (item.indexer && /the\s*pirate\s*bay/i.test(item.indexer)) ||
                  (typeof item.id === 'string' && item.id.trim().toLowerCase().startsWith('magnet:?'));
    if (isTPB && typeof item.id === 'string' && item.id.trim().toLowerCase().startsWith('magnet:?')) {
      logger.info('TorrentHelper', 'Detected "The Pirate Bay" indexer with magnet in "id" field. Using as magnetUrl.');
      return { magnetUrl: item.id.trim(), fileBuffer: null };
    }

    // 1. Direct magnet URL check
    if (item.magnetUrl && item.magnetUrl.trim().toLowerCase().startsWith('magnet:?')) {
      return { magnetUrl: item.magnetUrl.trim(), fileBuffer: null };
    }

    if (item.downloadUrl && item.downloadUrl.trim().toLowerCase().startsWith('magnet:?')) {
      return { magnetUrl: item.downloadUrl.trim(), fileBuffer: null };
    }

    // 2. Fetch download URL
    if (item.downloadUrl && (item.downloadUrl.startsWith('http://') || item.downloadUrl.startsWith('https://'))) {
      let url = item.downloadUrl.trim();

      // Inject Prowlarr API key if needed
      if (url.includes('prowlarr') && config.prowlarr.apiKey && !url.includes('apikey=')) {
        const sep = url.includes('?') ? '&' : '?';
        url = `${url}${sep}apikey=${config.prowlarr.apiKey}`;
      }

      logger.info('TorrentHelper', `Fetching torrent payload from URL: ${url.substring(0, 80)}...`);

      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/x-bittorrent,application/octet-stream,*/*;q=0.8',
      };
      if (config.prowlarr.apiKey) {
        headers['X-Api-Key'] = config.prowlarr.apiKey;
      }

      const response = await axios.get(url, {
        headers,
        responseType: 'arraybuffer',
        timeout: 20000,
        maxRedirects: 5,
      });

      const buffer = Buffer.from(response.data);
      const textSample = buffer.slice(0, 500).toString('utf8').trim();

      if (textSample.startsWith('magnet:?')) {
        logger.info('TorrentHelper', 'Endpoint returned Magnet URI redirect text');
        return { magnetUrl: textSample, fileBuffer: buffer };
      }

      if (buffer.length > 0) {
        const infoHash = this.extractInfoHash(buffer);
        if (infoHash) {
          const titleEncoded = encodeURIComponent(item.title || 'Torrent');
          const generatedMagnet = `magnet:?xt=urn:btih:${infoHash}&dn=${titleEncoded}`;
          logger.info('TorrentHelper', `Extracted BTIH InfoHash [${infoHash.substring(0, 10)}...] -> Generated Magnet URI`);
          return { magnetUrl: generatedMagnet, fileBuffer: buffer };
        }
        return { magnetUrl: null, fileBuffer: buffer };
      }
    }

    return { magnetUrl: null, fileBuffer: null };
  }
}

module.exports = new TorrentHelper();
