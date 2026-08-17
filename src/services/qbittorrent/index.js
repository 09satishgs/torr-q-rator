const client = require('./client');
const strategyManager = require('./strategyManager');
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
   * @param {Object} torrent Prowlarr torrent result object
   * @param {string} savePath Target directory path
   */
  async addTorrent(torrent, savePath) {
    if (!torrent || typeof torrent !== 'object') {
      throw new Error('addTorrent requires a valid "torrent" object');
    }

    if (!savePath || typeof savePath !== 'string') {
      throw new Error('addTorrent requires a valid "savePath" string');
    }

    const context = {
      client: this.client,
      strategyManager: this.strategyManager,
    };

    return await this.strategyManager.processDownload(torrent, savePath, context);
  }

  /**
   * Fetch active torrent list from qBittorrent
   */
  async getTorrentList() {
    return await this.client.getTorrentList();
  }

  /**
   * Check connection status
   */
  async checkHealth() {
    return await this.client.checkHealth();
  }
}

module.exports = new QBittorrentService();
