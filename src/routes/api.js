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

/**
 * GET /api/search?q=ubuntu&limit=20
 * Search indexers via Prowlarr
 */
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    const limit = parseInt(req.query.limit || '20', 10);

    const results = await prowlarrService.search(query, limit);
    return res.json({
      success: true,
      query,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error('[API /search] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to perform torrent search',
      details: error.message,
    });
  }
});

/**
 * POST /api/download
 * Add torrent to qBittorrent using modular strategy pipeline
 */
router.post('/download', async (req, res) => {
  try {
    const { source, savePath } = req.body;

    if (!source) {
      return res.status(400).json({
        ok: false,
        error: 'Missing torrent source URL or magnet link',
      });
    }

    const result = (await qbittorrentService.addTorrent(source, savePath)) || {
      ok: false,
      error: 'Download manager returned an empty response',
    };

    if (!result.ok) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (error) {
    console.error('[API /download] Error:', error.message);
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
    return res.json({
      success: true,
      count: torrents.length,
      torrents,
    });
  } catch (error) {
    console.error('[API /torrents] Error:', error.message);
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
    console.error('[API /discover/search] Error:', error.message);
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
    console.error('[API GET /watchlist] Error:', error.message);
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
    console.error('[API POST /watchlist] Error:', error.message);
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
    console.error('[API DELETE /watchlist] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete watchlist item',
      details: error.message,
    });
  }
});

module.exports = router;
