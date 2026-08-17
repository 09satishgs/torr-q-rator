const logger = require('../../../../utils/logger');

/**
 * LimeTorrents Specific Fallback Handler (Mock with logging for edge cases)
 */
class LimeTorrIndexerHandler {
  constructor() {
    this.name = 'LimeTorrentsHandler';
    this.indexerKeys = ['limetorrents', 'lime-torrents', 'limetorrent'];
  }

  canHandle(indexerName) {
    if (!indexerName || typeof indexerName !== 'string') return false;
    const lower = indexerName.toLowerCase();
    return this.indexerKeys.some(key => lower.includes(key));
  }

  async handle(torrent, savePath, context) {
    logger.info('LimeTorrentsHandler', `[MOCK FALLBACK] Executing indexer-specific fallback handler for LimeTorrents`, {
      title: torrent.title,
      indexer: torrent.indexer,
      downloadUrl: torrent.downloadUrl,
      magnetUrl: torrent.magnetUrl,
      savePath,
    });

    // If downloadUrl exists, delegate to qBittorrent
    const targetUrl = torrent.downloadUrl || torrent.magnetUrl || torrent.id;
    if (targetUrl) {
      logger.info('LimeTorrentsHandler', `Delegating LimeTorrents target URL directly to qBittorrent: ${targetUrl.slice(0, 80)}...`);
      return await context.client.addTorrentByUrl(targetUrl, savePath);
    }

    return {
      ok: false,
      error: `LimeTorrents fallback handler could not find a valid link for "${torrent.title}"`,
    };
  }
}

module.exports = new LimeTorrIndexerHandler();
