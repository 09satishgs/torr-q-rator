const express = require('express');
const router = express.Router();
const path = require('path');
const os = require('os');
const prowlarrService = require('../services/prowlarr');
const qbittorrentService = require('../services/qbittorrent');
const flaresolverrService = require('../services/flaresolverr');
const discoveryService = require('../services/discovery');
const watchlistService = require('../services/watchlist');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * GET /api/config/debug
 * Get backend debug logging status
 */
router.get('/config/debug', (req, res) => {
  return res.json({
    debug: logger.isDebugEnabled(),
  });
});

/**
 * POST /api/config/debug
 * Toggle backend debug logging
 */
router.post('/config/debug', (req, res) => {
  const { enabled } = req.body;
  logger.setDebug(!!enabled);
  return res.json({
    success: true,
    debug: logger.isDebugEnabled(),
  });
});

/**
 * GET /api/search?q=ubuntu&limit=20
 * Search indexers via Prowlarr
 */
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    const limit = parseInt(req.query.limit || '20', 10);

    logger.info('API:Search', `Searching indexers for query: "${query}" (limit: ${limit})`);
    const results = await prowlarrService.search(query, limit);

    logger.debug('API:Search', `Found ${results.length} results for "${query}"`, {
      sampleTitles: results.slice(0, 3).map(r => r.title),
    });

    return res.json({
      success: true,
      query,
      count: results.length,
      results,
    });
  } catch (error) {
    logger.error('API:Search', `Failed to perform torrent search: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to perform torrent search',
      details: error.message,
    });
  }
});

/**
 * POST /api/download
 * Add torrent to qBittorrent using 3-step pipeline (Magnet -> .torrent -> Indexer Fallback)
 * Accepts entire Prowlarr torrent object + savePath
 */
router.post('/download', async (req, res) => {
  try {
    const { torrent, savePath, source, torrentObject, indexer } = req.body;

    // Support both { torrent, savePath } and legacy formats
    const torrentPayload = torrent || torrentObject || (source ? {
      title: 'Direct Torrent',
      indexer: indexer || 'Direct',
      magnetUrl: source.startsWith('magnet:') ? source : '',
      downloadUrl: source.startsWith('http') ? source : '',
      id: source,
    } : null);

    if (!torrentPayload) {
      logger.warn('API:Download', 'Missing torrent object in download request', req.body);
      return res.status(400).json({
        ok: false,
        error: 'Missing torrent metadata object in request body',
      });
    }

    logger.info('API:Download', `Received download request for "${torrentPayload.title || 'Untitled'}" [${torrentPayload.indexer || 'Unknown'}]`, {
      title: torrentPayload.title,
      indexer: torrentPayload.indexer,
      magnetUrl: torrentPayload.magnetUrl ? `${torrentPayload.magnetUrl.slice(0, 50)}...` : '',
      downloadUrl: torrentPayload.downloadUrl ? `${torrentPayload.downloadUrl.slice(0, 50)}...` : '',
      savePath,
    });

    const result = (await qbittorrentService.addTorrent(torrentPayload, savePath)) || {
      ok: false,
      error: 'Download manager returned an empty response',
    };

    if (!result.ok) {
      logger.warn('API:Download', `Download queue failed: ${result.error}`, result);
      return res.status(400).json(result);
    }

    logger.info('API:Download', 'Torrent queued successfully to qBittorrent', result);
    return res.json(result);
  } catch (error) {
    logger.error('API:Download', `Failed to queue torrent download: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Failed to add torrent download',
      details: error.message,
    });
  }
});

/**
 * GET /api/torrents
 * Get active download status list from qBittorrent
 */
router.get('/torrents', async (req, res) => {
  try {
    const torrents = await qbittorrentService.getTorrentList();
    logger.debug('API:Torrents', `Fetched ${torrents.length} active torrent transfers`);
    return res.json({
      success: true,
      count: torrents.length,
      torrents,
    });
  } catch (error) {
    logger.error('API:Torrents', `Failed to fetch active torrent list: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch active torrent list',
      details: error.message,
    });
  }
});

/**
 * GET /api/vpn/status
 * Check Standalone VPN & Service health status
 */
router.get('/vpn/status', async (req, res) => {
  try {
    const [qbHealth, prowlarrHealth, flareHealth] = await Promise.all([
      qbittorrentService.checkHealth().catch(e => ({ connected: false, error: e.message })),
      prowlarrService.checkHealth().catch(e => ({ connected: false, error: e.message })),
      flaresolverrService.checkHealth().catch(e => ({ connected: false, error: e.message })),
    ]);

    return res.json({
      vpnConnected: true,
      provider: 'Surfshark',
      bindingInterface: config.vpn.interfaceName || 'SurfsharkWireGuard',
      country: config.vpn.country,
      killSwitchActive: true,
      services: {
        qbittorrent: qbHealth,
        prowlarr: prowlarrHealth,
        flaresolverr: flareHealth,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('API:VPN', `Failed to check VPN & service status: ${error.message}`);
    return res.status(500).json({
      vpnConnected: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/directories
 * Return recommended target download directory paths adaptive to host OS
 */
router.get('/directories', (req, res) => {
  const base = config.defaultDownloadDir;
  const directories = [
    { label: 'Default Downloads', path: base },
    { label: 'Movies', path: path.join(base, 'Movies') },
    { label: 'TV Shows', path: path.join(base, 'TV') },
    { label: 'Music & Audio', path: path.join(base, 'Music') },
    { label: 'Software & OS', path: path.join(base, 'Software') },
    { label: 'Games', path: path.join(base, 'Games') },
  ];

  return res.json({
    success: true,
    defaultDir: base,
    directories,
  });
});

/**
 * GET /api/discover/search
 * Multi-Source Media Discovery (TMDB Telugu, Anime Jikan, OMDb Global) with Pagination
 */
router.get('/discover/search', async (req, res) => {
  try {
    const {
      source = 'tmdb',
      q = '',
      language = 'te',
      genre = '',
      type = 'movie',
      year = '',
      sort = 'popularity.desc',
      page = 1,
    } = req.query;

    const data = await discoveryService.searchMedia({
      source,
      query: q,
      language,
      genre,
      type,
      year,
      sort,
      page,
    });

    return res.json({
      success: true,
      source: data.source,
      page: data.page,
      totalPages: data.totalPages,
      count: data.count,
      results: data.results,
    });
  } catch (error) {
    logger.error('API:Discover', `Failed to query media discovery source: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to query media discovery source',
      details: error.message,
    });
  }
});

/**
 * GET /api/watchlist
 * Fetch saved wishlist entries with pre-fetched top 3 torrents
 */
router.get('/watchlist', (req, res) => {
  try {
    const list = watchlistService.getWatchlist();
    return res.json({
      success: true,
      count: list.length,
      watchlist: list,
    });
  } catch (error) {
    logger.error('API:Watchlist', `Failed to fetch watchlist: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch watchlist',
      details: error.message,
    });
  }
});

/**
 * POST /api/watchlist
 * Add title/text to wishlist & pre-fetch top 3 torrents via Prowlarr in parallel
 */
router.post('/watchlist', async (req, res) => {
  try {
    const itemData = req.body;
    if (!itemData || (!itemData.title && !itemData.name)) {
      return res.status(400).json({
        success: false,
        error: 'Missing item title or name',
      });
    }

    const savedItem = await watchlistService.addItem(itemData);
    return res.json({
      success: true,
      message: 'Item added to Wishlist and top 3 torrents pre-fetched',
      item: savedItem,
    });
  } catch (error) {
    logger.error('API:Watchlist', `Failed to add item to watchlist: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to add item to watchlist',
      details: error.message,
    });
  }
});

/**
 * DELETE /api/watchlist/:id
 * Remove item from wishlist
 */
router.delete('/watchlist/:id', (req, res) => {
  try {
    const { id } = req.params;
    const ok = watchlistService.removeItem(id);
    return res.json({
      success: ok,
      message: ok ? 'Item removed from Wishlist' : 'Item not found',
    });
  } catch (error) {
    logger.error('API:Watchlist', `Failed to delete watchlist item: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete watchlist item',
      details: error.message,
    });
  }
});

module.exports = router;
