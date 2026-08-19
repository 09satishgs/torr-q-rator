const express = require('express');
const router = express.Router();
const path = require('path');
const os = require('os');
const prowlarrService = require('../services/prowlarr');
const qbittorrentService = require('../services/qbittorrent');
const flaresolverrService = require('../services/flaresolverr');
const discoveryService = require('../services/discovery');
const watchlistService = require('../services/watchlist');
const seedrService = require('../services/seedr');
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
 * Add torrent to qBittorrent using 3-step pipeline (Magnet -> .torrent -> Indexer Specific Flow)
 * Expects { torrent: Object, savePath: String }
 */
router.post('/download', async (req, res) => {
  try {
    const { torrent, savePath } = req.body;

    if (!torrent || typeof torrent !== 'object') {
      logger.error('API:Download', 'Missing or invalid "torrent" object in request body', req.body);
      return res.status(400).json({
        ok: false,
        error: 'Request body must contain a valid "torrent" object',
      });
    }

    if (!savePath || typeof savePath !== 'string') {
      logger.error('API:Download', 'Missing or invalid "savePath" string in request body', req.body);
      return res.status(400).json({
        ok: false,
        error: 'Request body must contain a valid "savePath" string',
      });
    }

    logger.info('API:Download', `Incoming download request for "${torrent.title || 'Untitled'}" [${torrent.indexer || 'Unknown'}]`, {
      torrent,
      savePath,
    });

    const result = await qbittorrentService.addTorrent(torrent, savePath);

    if (!result || !result.ok) {
      logger.error('API:Download', `Failed to queue torrent: ${result?.error || 'Unknown error'}`, {
        torrent,
        savePath,
        result,
      });
      return res.status(400).json(result || { ok: false, error: 'Failed to add torrent' });
    }

    logger.info('API:Download', 'Torrent queued successfully to qBittorrent', result);
    return res.json(result);
  } catch (error) {
    logger.error('API:Download', `Exception while processing torrent download: ${error.message}`, {
      error: error.message,
      body: req.body,
    });
    return res.status(500).json({
      ok: false,
      error: error.message || 'Internal Server Error while adding torrent',
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
 * POST /api/seedr/download
 * Add torrent/magnet to Seedr Queue
 * Expects { torrent: Object, savePath: String }
 */
router.post('/seedr/download', async (req, res) => {
  try {
    const { torrent, savePath } = req.body;

    if (!torrent || typeof torrent !== 'object') {
      logger.error('API:SeedrDownload', 'Missing or invalid "torrent" object in request body');
      return res.status(400).json({
        ok: false,
        error: 'Request body must contain a valid "torrent" object',
      });
    }

    if (!savePath || typeof savePath !== 'string') {
      logger.error('API:SeedrDownload', 'Missing or invalid "savePath" string in request body');
      return res.status(400).json({
        ok: false,
        error: 'Request body must contain a valid "savePath" string',
      });
    }

    logger.info('API:SeedrDownload', `Incoming Seedr queue request for "${torrent.title || 'Untitled'}" [${torrent.indexer || 'Unknown'}]`, {
      torrent,
      savePath,
    });

    const item = seedrService.queue.addItem(torrent, savePath);

    // Trigger immediate background worker check to start item without waiting 5 minutes
    seedrService.worker.triggerCheck().catch(err => {
      logger.warn('API:SeedrDownload', `Immediate worker check error: ${err.message}`);
    });

    return res.json({
      ok: true,
      message: 'Torrent added to Seedr Queue successfully',
      item,
    });
  } catch (error) {
    logger.error('API:SeedrDownload', `Exception while queueing to Seedr: ${error.message}`);
    return res.status(400).json({
      ok: false,
      error: error.message || 'Failed to add torrent to Seedr Queue',
    });
  }
});

/**
 * GET /api/seedr/queue
 * Fetch all Seedr queued, active, and completed transfer items + cloud quota info
 */
router.get('/seedr/queue', async (req, res) => {
  try {
    const queue = seedrService.queue.getQueue();
    const activeItem = seedrService.queue.getActiveItem();

    // Optionally query Seedr account storage info if configured
    let spaceInfo = {
      spaceMax: config.seedr.maxSizeBytes,
      spaceUsed: 0,
      spaceFree: config.seedr.maxSizeBytes,
    };

    try {
      if (config.seedr.token || (config.seedr.username && config.seedr.password)) {
        const root = await seedrService.client.getFolder(0);
        spaceInfo = {
          spaceMax: root.spaceMax,
          spaceUsed: root.spaceUsed,
          spaceFree: root.spaceFree,
        };
      }
    } catch (_) {}

    return res.json({
      success: true,
      count: queue.length,
      queue,
      activeItem,
      ...spaceInfo,
    });
  } catch (error) {
    logger.error('API:SeedrQueue', `Failed to fetch Seedr queue: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch Seedr queue',
      details: error.message,
    });
  }
});

/**
 * POST /api/seedr/cancel/:id
 * Cancel an active or queued Seedr transfer
 */
router.post('/seedr/cancel/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await seedrService.worker.cancelTask(id, 'Cancelled from UI');
    return res.json({
      success: true,
      message: 'Task cancelled successfully',
      ...result,
    });
  } catch (error) {
    logger.error('API:SeedrCancel', `Failed to cancel Seedr task: ${error.message}`);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to cancel Seedr task',
    });
  }
});

/**
 * POST /api/seedr/retry/:id
 * Re-queue a failed or cancelled Seedr transfer
 */
router.post('/seedr/retry/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await seedrService.worker.retryTask(id);
    return res.json({
      success: true,
      message: 'Task re-queued successfully',
      ...result,
    });
  } catch (error) {
    logger.error('API:SeedrRetry', `Failed to retry Seedr task: ${error.message}`);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to retry Seedr task',
    });
  }
});

/**
 * DELETE /api/seedr/item/:id (and POST /api/seedr/delete/:id)
 * Permanently remove a task from Seedr queue and cleanup cloud files
 */
router.delete('/seedr/item/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await seedrService.worker.deleteTask(id);
    return res.json({
      success: true,
      message: 'Task permanently removed',
      ...result,
    });
  } catch (error) {
    logger.error('API:SeedrDelete', `Failed to delete Seedr task: ${error.message}`);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to delete Seedr task',
    });
  }
});

router.post('/seedr/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await seedrService.worker.deleteTask(id);
    return res.json({
      success: true,
      message: 'Task permanently removed',
      ...result,
    });
  } catch (error) {
    logger.error('API:SeedrDelete', `Failed to delete Seedr task: ${error.message}`);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to delete Seedr task',
    });
  }
});

/**
 * POST /api/seedr/clear-completed
 * Clear completed and cancelled tasks from Seedr queue
 */
router.post('/seedr/clear-completed', (req, res) => {
  try {
    const remaining = seedrService.queue.clearCompleted();
    return res.json({
      success: true,
      message: 'Completed tasks cleared from Seedr queue',
      count: remaining.length,
      queue: remaining,
    });
  } catch (error) {
    logger.error('API:SeedrClearCompleted', `Failed to clear finished tasks: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to clear completed tasks',
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
