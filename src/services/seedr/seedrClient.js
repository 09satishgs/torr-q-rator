const axios = require('axios');
const config = require('../../config');
const logger = require('../../utils/logger');

const SEEDR_REST_BASE = 'https://www.seedr.cc/rest';
const SEEDR_AUTH_TOKEN_URL = 'https://www.seedr.cc/oauth_test/token';

class SeedrClient {
  constructor() {
    this.token = config.seedr.token || null;
    this.tokenExpiresAt = 0;
  }

  /**
   * Acquire or reuse bearer token for Seedr API
   */
  async getAuthHeaders() {
    if (this.token) {
      return { Authorization: `Bearer ${this.token}` };
    }

    const { username, password } = config.seedr;
    if (!username || !password) {
      throw new Error('Seedr credentials not configured. Please set SEEDR_USERNAME & SEEDR_PASSWORD or SEEDR_TOKEN in .env');
    }

    // Try OAuth password token exchange
    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'password');
      params.append('client_id', 'seedr_xbmc');
      params.append('type', 'login');
      params.append('username', username.trim().toLowerCase());
      params.append('password', password);

      const resp = await axios.post(SEEDR_AUTH_TOKEN_URL, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      });

      if (resp.data && resp.data.access_token) {
        this.token = resp.data.access_token;
        this.tokenExpiresAt = Date.now() + (resp.data.expires_in || 3600) * 1000;
        logger.info('SeedrClient', 'Obtained OAuth bearer token successfully');
        return { Authorization: `Bearer ${this.token}` };
      }
    } catch (authErr) {
      logger.warn('SeedrClient', `OAuth token exchange failed (${authErr.message}). Falling back to HTTP Basic Auth.`);
    }

    // Fallback: HTTP Basic Auth header
    const basicAuth = Buffer.from(`${username.trim().toLowerCase()}:${password}`).toString('base64');
    return { Authorization: `Basic ${basicAuth}` };
  }

  /**
   * Make an authenticated HTTP request to Seedr API
   */
  async request(method, endpoint, data = null, headers = {}) {
    const authHeaders = await this.getAuthHeaders();
    const url = endpoint.startsWith('http') ? endpoint : `${SEEDR_REST_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    try {
      const reqConfig = {
        method,
        url,
        headers: {
          ...authHeaders,
          ...headers,
        },
        timeout: 30000,
      };

      if (data) {
        if (typeof data === 'string' || Buffer.isBuffer(data) || data instanceof URLSearchParams) {
          reqConfig.data = data;
        } else {
          const params = new URLSearchParams();
          for (const [key, value] of Object.entries(data)) {
            if (value !== undefined && value !== null) {
              params.append(key, value);
            }
          }
          reqConfig.data = params.toString();
          reqConfig.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
      }

      logger.debug('SeedrClient', `Request: ${method.toUpperCase()} ${url}`);
      const res = await axios(reqConfig);
      return res.data;
    } catch (err) {
      // If 401 and we had a cached token, clear it to retry next time
      if (err.response && err.response.status === 401) {
        this.token = null;
      }
      const errorMsg = err.response?.data?.error || err.response?.data?.result || err.message;
      logger.error('SeedrClient', `Request failed: ${method.toUpperCase()} ${url} -> ${errorMsg}`, {
        status: err.response?.status,
        data: err.response?.data,
      });
      throw new Error(`Seedr API Error: ${errorMsg}`);
    }
  }

  /**
   * Add a magnet link to Seedr
   */
  async addMagnet(magnetUrl) {
    logger.info('SeedrClient', `Adding magnet to Seedr: ${magnetUrl.substring(0, 70)}...`);
    const data = await this.request('POST', '/transfer/magnet', { magnet: magnetUrl });
    
    // Seedr response can be { result: true, user_torrent_id: 123 } or { result: false, error: '...' }
    if (data && (data.result === true || data.user_torrent_id || data.title || data.id)) {
      return {
        ok: true,
        userTorrentId: data.user_torrent_id || data.id || null,
        title: data.title || '',
        code: data.code || 200,
        raw: data,
      };
    }

    if (data && (data.result === 'not_enough_space' || data.error === 'not_enough_space')) {
      throw new Error('Seedr account does not have enough free space for this torrent (5GB max).');
    }

    return {
      ok: false,
      error: data?.result || data?.error || 'Failed to add magnet to Seedr',
      raw: data,
    };
  }

  /**
   * Add a public web download URL to Seedr
   */
  async addUrl(url) {
    logger.info('SeedrClient', `Adding direct URL to Seedr: ${url.substring(0, 70)}...`);
    const data = await this.request('POST', '/transfer/url', { url });
    return {
      ok: true,
      userTorrentId: data?.user_torrent_id || data?.id || null,
      raw: data,
    };
  }

  /**
   * Fetch root or specific folder info (includes active torrents, files, folders, and storage quota)
   */
  async getFolder(folderId = 0) {
    const endpoint = folderId === 0 ? '/folder' : `/folder/${folderId}`;
    const data = await this.request('GET', endpoint);
    return {
      folders: data.folders || [],
      files: data.files || [],
      torrents: data.torrents || [],
      spaceMax: data.space_max || config.seedr.maxSizeBytes,
      spaceUsed: data.space_used || 0,
      spaceFree: Math.max(0, (data.space_max || config.seedr.maxSizeBytes) - (data.space_used || 0)),
      raw: data,
    };
  }

  /**
   * Get direct download URL for a specific file
   */
  async getFileUrl(fileId) {
    try {
      const data = await this.request('GET', `/file/${fileId}/url`);
      if (data && data.url) {
        return data.url;
      }
    } catch (err) {
      logger.warn('SeedrClient', `GET /file/${fileId}/url failed, trying fallback /file/${fileId}: ${err.message}`);
    }

    const fileData = await this.request('GET', `/file/${fileId}`);
    return fileData.url || fileData.download_url || null;
  }

  /**
   * Get folder download (ZIP) URL
   */
  async getFolderDownloadUrl(folderId) {
    const data = await this.request('GET', `/folder/${folderId}/download`);
    return data.url || data.download_url || null;
  }

  /**
   * Delete an active torrent / transfer from Seedr
   */
  async deleteTorrent(torrentId) {
    logger.info('SeedrClient', `Deleting torrent transfer ${torrentId} from Seedr`);
    try {
      return await this.request('DELETE', `/torrent/${torrentId}`);
    } catch (err) {
      return await this.request('POST', `/torrent/${torrentId}`, { _method: 'DELETE', method: 'delete' });
    }
  }

  /**
   * Delete a completed folder from Seedr cloud to free storage
   */
  async deleteFolder(folderId) {
    logger.info('SeedrClient', `Deleting folder ${folderId} from Seedr`);
    try {
      return await this.request('DELETE', `/folder/${folderId}`);
    } catch (err) {
      return await this.request('POST', `/folder/${folderId}`, { _method: 'DELETE', method: 'delete' });
    }
  }

  /**
   * Delete a single file from Seedr cloud
   */
  async deleteFile(fileId) {
    logger.info('SeedrClient', `Deleting file ${fileId} from Seedr`);
    try {
      return await this.request('DELETE', `/file/${fileId}`);
    } catch (err) {
      return await this.request('POST', `/file/${fileId}`, { _method: 'DELETE', method: 'delete' });
    }
  }
}

module.exports = new SeedrClient();
