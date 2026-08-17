const client = require('./client');
const strategyManager = require('./strategyManager');
const config = require('../../config');
const logger = require('../../utils/logger');

class QBittorrentService {
  constructor() {
    this.client = client;
    this.strategyManager = strategyManager;
    this.logger = logger;
  }

  /**
   * Authenticate with qBittorrent Web UI
   */
  async authenticate() {
    return await this.client.authenticate();
  }

  /**
   * Add a new torrent via the 3-step download resolution pipeline
   * @param {Object|string} torrentInput Full Prowlarr torrent result object or URL string
   * @param {string} savePath Target directory (defaults to config)
   */
  async addTorrent(torrentInput, savePath) {
    if (!torrentInput) {
      return { ok: false, error: 'Invalid or missing torrent metadata' };
    }

    const targetPath = savePath || config.defaultDownloadDir;
    const context = {
      client: this.client,
      strategyManager: this.strategyManager,
    };

    return await this.strategyManager.processDownload(torrentInput, targetPath, context);
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
