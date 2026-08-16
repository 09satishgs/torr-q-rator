/**
 * Modular QBittorrent Service Facade
 * Delegates core operations and download strategies to src/services/qbittorrent/
 */
const qbittorrentService = require('./qbittorrent/index');

module.exports = qbittorrentService;
