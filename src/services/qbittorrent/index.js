const client = require('./client');
const strategyManager = require('./strategyManager');
const config = require('../../config');

class QBittorrentService {
  constructor() {
    this.client = client;
    this.strategyManager = strategyManager;
  }

  /**
   * Authenticate with qBittorrent Web UI
   */
  async authenticate() {
    return await this.client.authenticate();
  }

  /**
   * Add a new torrent via modular download strategy pipeline
   * @param {string} sourceUrl HTML Page URL, Magnet URI, or .torrent link
   * @param {string} savePath Target directory (defaults to config)
   */
  async addTorrent(sourceUrl, savePath) {
    if (!sourceUrl || typeof sourceUrl !== 'string') {
      return { ok: false, error: 'Invalid or missing torrent source URL' };
    }

    const targetPath = savePath || config.defaultDownloadDir;
    const context = {
      client: this.client,
      strategyManager: this.strategyManager,
    };

    return await this.strategyManager.processDownload(sourceUrl, targetPath, context);
  }

  /**
   * Fetch active torrent list from qBittorrent
   */
  async getTorrentList() {
    return await this.client.getTorrentList();
  }

  /**
   * Direct magnet or URL add
   */
  async addTorrentByUrl(sourceUrl, savePath) {
    const targetPath = savePath || config.defaultDownloadDir;
    return await this.client.addTorrentByUrl(sourceUrl, targetPath);
  }

  /**
   * Direct binary upload
   */
  async uploadTorrentFile(fileBuffer, savePath) {
    const targetPath = savePath || config.defaultDownloadDir;
    return await this.client.uploadTorrentFile(fileBuffer, targetPath);
  }

  /**
   * Check connection status
   */
  async checkHealth() {
    return await this.client.checkHealth();
  }
}

module.exports = new QBittorrentService();
