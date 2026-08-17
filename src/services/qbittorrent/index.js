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
   * Add a new torrent via modular download strategy pipeline
   * @param {string} sourceUrl HTML Page URL, Magnet URI, or .torrent link
   * @param {string} savePath Target directory (defaults to config)
   * @param {Object} metadata Extra metadata { torrentObject, indexer }
   */
  async addTorrent(sourceUrl, savePath, metadata = {}) {
    const rawSource = sourceUrl || metadata.torrentObject?.magnetUrl || metadata.torrentObject?.downloadUrl;
    if (!rawSource || typeof rawSource !== 'string') {
      return { ok: false, error: 'Invalid or missing torrent source URL' };
    }

    const targetPath = savePath || config.defaultDownloadDir;
    const context = {
      client: this.client,
      strategyManager: this.strategyManager,
      torrentObject: metadata.torrentObject || null,
      indexer: metadata.indexer || metadata.torrentObject?.indexer || null,
    };

    return await this.strategyManager.processDownload(rawSource, targetPath, context);
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
