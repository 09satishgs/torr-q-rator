const logger = require('../../../../utils/logger');

/**
 * Generic Indexer Fallback Handler
 */
class GenericFallbackIndexerHandler {
  constructor() {
    this.name = 'GenericFallbackHandler';
  }

  canHandle() {
    return true;
  }

  async handle(torrent, savePath, context) {
    logger.info('GenericFallbackHandler', `[MOCK FALLBACK] Executing generic indexer fallback handler for "${torrent.indexer || 'Unknown'}"`, {
      title: torrent.title,
      indexer: torrent.indexer,
      downloadUrl: torrent.downloadUrl,
      magnetUrl: torrent.magnetUrl,
      guid: torrent.id || torrent.guid,
      savePath,
    });

    const fallbackLink = torrent.downloadUrl || torrent.magnetUrl || torrent.link || torrent.id;
    if (fallbackLink && typeof fallbackLink === 'string') {
      logger.info('GenericFallbackHandler', `Submitting raw fallback URL string to qBittorrent client: ${fallbackLink.slice(0, 80)}...`);
      return await context.client.addTorrentByUrl(fallbackLink, savePath);
    }

    return {
      ok: false,
      error: `No valid magnet, download URL, or fallback link available for indexer "${torrent.indexer || 'Unknown'}"`,
    };
  }
}

module.exports = new GenericFallbackIndexerHandler();
