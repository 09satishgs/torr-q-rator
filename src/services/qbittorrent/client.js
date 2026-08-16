const axios = require('axios');
const config = require('../../config');

class QBittorrentClient {
  constructor() {
    this.sid = null;
    this.client = axios.create({
      baseURL: config.qbittorrent.baseUrl,
      timeout: 10000,
    });
  }

  /**
   * Authenticate with qBittorrent Web UI API v2
   */
  async authenticate() {
    try {
      console.log(`[QBittorrentClient] Authenticating with qBittorrent WebUI at ${config.qbittorrent.baseUrl} (user: ${config.qbittorrent.username})...`);

      const params = new URLSearchParams();
      params.append('username', config.qbittorrent.username);
      params.append('password', config.qbittorrent.password);

      const response = await this.client.post('/api/v2/auth/login', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (typeof response.data === 'string' && response.data.trim() === 'Fails.') {
        console.error('[QBittorrentClient] Auth failed: Invalid qBittorrent username or password');
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
              console.log('[QBittorrentClient] Successfully authenticated with qBittorrent WebUI. Session SID acquired.');
              return this.sid;
            }
          }
        }
      }

      if (response.status === 200) {
        console.log('[QBittorrentClient] qBittorrent login returned 200 OK (Auth disabled or session active).');
        this.sid = 'no-auth-required';
        return this.sid;
      }

      return null;
    } catch (error) {
      console.error(`[QBittorrentClient] Connection to qBittorrent failed (${error.message}). Is qBittorrent desktop running with WebUI enabled?`);
      this.sid = null;
      return null;
    }
  }

  /**
   * Check connection health to qBittorrent WebUI
   */
  async checkHealth() {
    try {
      if (!this.sid) {
        await this.authenticate();
      }
      const response = await this.client.get('/api/v2/app/version', {
        headers: this.getHeaders(),
      });
      return {
        connected: true,
        version: response.data || 'unknown',
        webUiUrl: config.qbittorrent.baseUrl,
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        webUiUrl: config.qbittorrent.baseUrl,
      };
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
   * Post URL or Magnet string directly to qBittorrent
   * @param {string} sourceUrl Magnet link or download URL
   * @param {string} savePath Target directory path
   */
  async addTorrentByUrl(sourceUrl, savePath) {
    try {
      if (!this.sid) {
        await this.authenticate();
      }

      const params = new URLSearchParams();
      params.append('urls', sourceUrl);
      if (savePath) {
        params.append('savepath', savePath);
      }

      const response = await this.client.post('/api/v2/torrents/add', params, {
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (response.status === 200) {
        console.log('[QBittorrentClient] Magnet/URL added successfully to qBittorrent!');
        return { ok: true, message: 'Torrent added successfully to qBittorrent', live: true };
      }
      return { ok: false, error: `qBittorrent returned HTTP ${response.status}` };
    } catch (error) {
      console.error(`[QBittorrentClient] Error posting magnet/URL to qBittorrent: ${error.response?.data || error.message}`);

      if (error.response && error.response.status === 403) {
        try {
          console.log('[QBittorrentClient] Re-authenticating after 403...');
          await this.authenticate();
          const params = new URLSearchParams();
          params.append('urls', sourceUrl);
          if (savePath) params.append('savepath', savePath);

          const retryResp = await this.client.post('/api/v2/torrents/add', params, {
            headers: {
              ...this.getHeaders(),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          });

          if (retryResp.status === 200) {
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
   * Upload binary .torrent file buffer to qBittorrent via multipart/form-data
   * @param {Buffer} fileBuffer Raw .torrent file buffer
   * @param {string} savePath Target directory path
   */
  async uploadTorrentFile(fileBuffer, savePath) {
    try {
      if (!this.sid) {
        await this.authenticate();
      }

      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2, 12);
      const postData = [];

      if (savePath) {
        postData.push(
          Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="savepath"\r\n\r\n${savePath}\r\n`
          )
        );
      }

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
        console.log('[QBittorrentClient] Binary .torrent file uploaded and added to qBittorrent successfully!');
        return { ok: true, message: 'Torrent file uploaded and added to qBittorrent', live: true };
      }
      return { ok: false, error: `qBittorrent returned HTTP ${response.status}` };
    } catch (error) {
      console.error(`[QBittorrentClient] Failed to upload binary .torrent: ${error.response?.data || error.message}`);

      if (error.response && error.response.status === 403) {
        try {
          console.log('[QBittorrentClient] Re-authenticating after 403...');
          await this.authenticate();
          return await this.uploadTorrentFile(fileBuffer, savePath);
        } catch (reAuthErr) {
          return { ok: false, error: `qBittorrent Upload Auth Error: ${reAuthErr.message}` };
        }
      }

      return { ok: false, error: `qBittorrent Upload Error: ${error.response?.data || error.message}` };
    }
  }

  /**
   * Fetch active torrent list and transfer speeds from qBittorrent
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
          upspeed: t.upspeed || 0,
          eta: t.eta,
          state: t.state,
          num_seeds: t.num_seeds,
          num_leechs: t.num_leechs,
          save_path: t.save_path,
          added_on: t.added_on,
          size: t.size || t.total_size || 0,
        }));
      }
      return [];
    } catch (error) {
      console.warn(`[QBittorrentClient] Failed to fetch torrent list from qBittorrent (${error.message}).`);
      return [];
    }
  }
}

module.exports = new QBittorrentClient();
