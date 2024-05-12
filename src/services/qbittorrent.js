const axios = require('axios');
const config = require('../config');

class QBittorrentService {
  constructor() {
    this.sid = null;
    this.client = axios.create({
      baseURL: config.qbittorrent.baseUrl,
      timeout: 8000,
    });
  }

  /**
   * Authenticate with qBittorrent Web UI API v2
   */
  async authenticate() {
    try {
      console.log(`[qBittorrentService] Authenticating with qBittorrent at ${config.qbittorrent.baseUrl} (user: ${config.qbittorrent.username})...`);
      
      const params = new URLSearchParams();
      params.append('username', config.qbittorrent.username);
      params.append('password', config.qbittorrent.password);

      const response = await this.client.post('/api/v2/auth/login', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (typeof response.data === 'string' && response.data.trim() === 'Fails.') {
        console.error('[qBittorrentService] Auth failed: Invalid qBittorrent username or password');
        this.sid = null;
        return null;
      }

      const cookies = response.headers['set-cookie'];
      if (cookies) {
        for (const cookie of cookies) {
          if (cookie.includes('SID=')) {
            const sidMatch = cookie.match(/SID=([^;]+)/);
            if (sidMatch) {
              this.sid = sidMatch[1];
              console.log('[qBittorrentService] Successfully authenticated with qBittorrent. Session SID acquired.');
              return this.sid;
            }
          }
        }
      }

      if (response.status === 200) {
        console.log('[qBittorrentService] qBittorrent login returned 200 OK (Auth disabled or session active).');
        this.sid = 'no-auth-required';
        return this.sid;
      }

      return null;
    } catch (error) {
      console.error(`[qBittorrentService] Connection to qBittorrent failed (${error.message}).`);
      this.sid = null;
      return null;
    }
  }

  /**
   * Get headers required for API requests
   */
  getHeaders() {
    const headers = {};
    if (this.sid && this.sid !== 'no-auth-required') {
      headers['Cookie'] = `SID=${this.sid}`;
    }
    return headers;
  }

  /**
   * Add a new torrent by Magnet URL, HTTP URL, or Torrent File Buffer
   * @param {string} sourceUrl Magnet link or HTTP URL
   * @param {string} savePath Target directory (e.g. /downloads/Movies)
   */
  async addTorrent(sourceUrl, savePath) {
    if (!sourceUrl || typeof sourceUrl !== 'string') {
      return { ok: false, error: 'Invalid or missing torrent source URL' };
    }

    const targetPath = savePath || config.defaultDownloadDir;
    let formattedSource = sourceUrl.trim();

    console.log(`[qBittorrentService] Processing download request... Target: "${targetPath}", Source: "${formattedSource.slice(0, 90)}..."`);

    // If sourceUrl is a Magnet Link, pass it directly to qBittorrent
    if (formattedSource.startsWith('magnet:?')) {
      return (await this.addTorrentByUrl(formattedSource, targetPath)) || { ok: false, error: 'Failed to add magnet link' };
    }

    // If sourceUrl is an HTTP/HTTPS URL (e.g. Prowlarr download link), download .torrent file in Node backend first!
    if (formattedSource.startsWith('http://') || formattedSource.startsWith('https://')) {
      try {
        console.log(`[qBittorrentService] Downloading .torrent file buffer from URL in backend...`);
        const downloadHeaders = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        };
        if (config.prowlarr.apiKey) {
          downloadHeaders['X-Api-Key'] = config.prowlarr.apiKey;
        }

        if (formattedSource.includes('prowlarr') && config.prowlarr.apiKey && !formattedSource.includes('apikey=')) {
          const sep = formattedSource.includes('?') ? '&' : '?';
          formattedSource = `${formattedSource}${sep}apikey=${config.prowlarr.apiKey}`;
        }

        const torrentResp = await axios.get(formattedSource, {
          headers: downloadHeaders,
          responseType: 'arraybuffer',
          timeout: 10000,
          maxRedirects: 5,
        });

        const fileBuffer = Buffer.from(torrentResp.data);
        const textContent = fileBuffer.toString('utf8');

        if (textContent.startsWith('magnet:?')) {
          console.log('[qBittorrentService] HTTP URL resolved to a Magnet Link.');
          return (await this.addTorrentByUrl(textContent.trim(), targetPath)) || { ok: false, error: 'Failed to add resolved magnet link' };
        }

        if (fileBuffer.length > 0) {
          console.log(`[qBittorrentService] Downloaded .torrent binary file (${fileBuffer.length} bytes). Uploading directly to qBittorrent...`);
          return (await this.uploadTorrentFile(fileBuffer, targetPath)) || { ok: false, error: 'Failed to upload torrent binary file' };
        }
      } catch (err) {
        console.warn(`[qBittorrentService] Backend .torrent download attempt failed (${err.message}). Falling back to passing URL directly to qBittorrent.`);
      }
    }

    return (await this.addTorrentByUrl(formattedSource, targetPath)) || { ok: false, error: 'Failed to dispatch URL to qBittorrent' };
  }

  /**
   * Upload binary .torrent file buffer to qBittorrent via multipart/form-data
   */
  async uploadTorrentFile(fileBuffer, savePath) {
    try {
      if (!this.sid) {
        await this.authenticate();
      }

      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2, 12);
      const postData = [];

      postData.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="savepath"\r\n\r\n${savePath}\r\n`
        )
      );

      postData.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="torrents"; filename="release.torrent"\r\nContent-Type: application/x-bittorrent\r\n\r\n`
        )
      );
      postData.push(fileBuffer);
      postData.push(Buffer.from(`\r\n--${boundary}--\r\n`));

      const payload = Buffer.concat(postData);

      const response = await this.client.post('/api/v2/torrents/add', payload, {
        headers: {
          ...this.getHeaders(),
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': payload.length,
        },
      });

      if (response.status === 200) {
        console.log('[qBittorrentService] Binary .torrent file uploaded and added to qBittorrent successfully!');
        return { ok: true, message: 'Torrent file uploaded and added to qBittorrent', live: true };
      }
      return { ok: false, error: `qBittorrent returned HTTP ${response.status}` };
    } catch (error) {
      console.error(`[qBittorrentService] Failed to upload binary .torrent to qBittorrent: ${error.response?.data || error.message}`);
      
      if (error.response && error.response.status === 403) {
        try {
          console.log('[qBittorrentService] Re-authenticating after 403...');
          await this.authenticate();
          return (await this.uploadTorrentFile(fileBuffer, savePath)) || { ok: false, error: 'Failed to upload torrent binary after re-auth' };
        } catch (reAuthErr) {
          return { ok: false, error: `qBittorrent Upload Auth Error: ${reAuthErr.message}` };
        }
      }

      return { ok: false, error: `qBittorrent Upload Error: ${error.response?.data || error.message}` };
    }
  }

  /**
   * Add torrent by Magnet URL or Web URL string
   */
  async addTorrentByUrl(sourceUrl, savePath) {
    try {
      if (!this.sid) {
        await this.authenticate();
      }

      const params = new URLSearchParams();
      params.append('urls', sourceUrl);
      params.append('savepath', savePath);

      const response = await this.client.post('/api/v2/torrents/add', params, {
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (response.status === 200) {
        console.log('[qBittorrentService] Magnet/URL added successfully to qBittorrent!');
        return { ok: true, message: 'Torrent added successfully to qBittorrent', live: true };
      }
      return { ok: false, error: `qBittorrent returned HTTP ${response.status}` };
    } catch (error) {
      console.error(`[qBittorrentService] Error posting magnet/URL to qBittorrent: ${error.response?.data || error.message}`);

      if (error.response && error.response.status === 403) {
        try {
          await this.authenticate();
          const params = new URLSearchParams();
          params.append('urls', sourceUrl);
          params.append('savepath', savePath);

          const retryResp = await this.client.post('/api/v2/torrents/add', params, {
            headers: {
              ...this.getHeaders(),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          });

          if (retryResp.status === 200) {
            console.log('[qBittorrentService] Magnet/URL added successfully after re-auth!');
            return { ok: true, message: 'Torrent added successfully to qBittorrent', live: true };
          }
          return { ok: false, error: `qBittorrent returned HTTP ${retryResp.status} on retry` };
        } catch (reAuthErr) {
          return { ok: false, error: `qBittorrent Auth Error: ${reAuthErr.message}` };
        }
      }

      return { ok: false, error: `qBittorrent API Error: ${error.response?.data || error.message}` };
    }
  }

  /**
   * Fetch active torrent list from qBittorrent
   */
  async getTorrentList() {
    try {
      if (!this.sid) {
        await this.authenticate();
      }

      const response = await this.client.get('/api/v2/torrents/info', {
        headers: this.getHeaders(),
      });

      if (Array.isArray(response.data)) {
        return response.data.map(t => ({
          hash: t.hash,
          name: t.name,
          progress: t.progress,
          dlspeed: t.dlspeed,
          eta: t.eta,
          state: t.state,
          save_path: t.save_path,
          added_on: t.added_on,
          size: t.size || t.total_size || 0,
        }));
      }
      return [];
    } catch (error) {
      console.warn(`[qBittorrentService] Failed to fetch torrent list from qBittorrent (${error.message}).`);
      return [];
    }
  }
}

module.exports = new QBittorrentService();
