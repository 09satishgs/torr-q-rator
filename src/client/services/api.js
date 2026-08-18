/**
 * Frontend API Service Layer with Integrated Logging & Complete Torrent Object Support
 */

import { logger } from './logger';

export async function setBackendDebug(enabled) {
  try {
    const response = await fetch('/api/config/debug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    return await response.json();
  } catch (e) {
    logger.warn('API:DebugConfig', `Failed to sync debug state with backend: ${e.message}`);
  }
}

export async function searchTorrents(query, limit = 30) {
  logger.debug('API:Search', `Dispatching search query "${query}" (limit: ${limit})`);
  const start = performance.now();
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  const duration = Math.round(performance.now() - start);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errMsg = errorData.error || errorData.details || 'Failed to search torrent releases';
    logger.error('API:Search', `Search failed (${duration}ms): ${errMsg}`, errorData);
    throw new Error(errMsg);
  }

  const data = await response.json();
  logger.info('API:Search', `Found ${data.count || data.results?.length || 0} results for "${query}" (${duration}ms)`, data);
  return data;
}

export async function fetchDirectories() {
  logger.debug('API:Directories', 'Fetching recommended download directories');
  const response = await fetch('/api/directories');
  if (!response.ok) {
    logger.error('API:Directories', 'Failed to fetch directories');
    throw new Error('Failed to fetch recommended directories');
  }
  const data = await response.json();
  logger.debug('API:Directories', 'Directories loaded', data);
  return data;
}

/**
 * Add Download to qBittorrent - passes the entire Prowlarr torrent object + savePath
 * @param {Object} torrent Entire Prowlarr result object
 * @param {string} savePath Target directory path
 */
export async function addDownload(torrent, savePath) {
  const payload = {
    torrent,
    savePath,
  };

  logger.info('API:Download', `Queuing download for "${torrent?.title || 'Untitled'}" [${torrent?.indexer || 'Unknown'}]`, payload);

  const response = await fetch('/api/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({ ok: false, error: 'Malformed API response' }));

  if (!response.ok || !data.ok) {
    const errMsg = data.error || data.details || 'Failed to queue torrent download';
    logger.error('API:Download', `Queue failed: ${errMsg}`, data);
    throw new Error(errMsg);
  }

  logger.info('API:Download', 'Download successfully queued to qBittorrent!', data);
  return data;
}

export async function fetchTorrentsList() {
  const response = await fetch('/api/torrents');
  if (!response.ok) {
    throw new Error('Failed to fetch active torrent transfers');
  }
  const data = await response.json();
  logger.debug('API:Torrents', `Polled active transfers (${data.torrents?.length || 0} active)`, data);
  return data;
}

export async function checkVpnStatus() {
  const response = await fetch('/api/vpn/status');
  if (!response.ok) {
    throw new Error('Failed to check VPN status');
  }
  const data = await response.json();
  logger.debug('API:VPN', 'VPN status checked', data);
  return data;
}

/* Media Discovery & Wishlist API Wrappers */

export async function searchMediaCatalog({
  source = 'tmdb',
  query = '',
  language = 'te',
  genre = '',
  type = 'movie',
  year = '',
  sort = 'popularity.desc',
  page = 1,
} = {}) {
  const params = new URLSearchParams();
  params.append('source', source);
  if (query) params.append('q', query);
  if (language) params.append('language', language);
  if (genre) params.append('genre', genre);
  if (type) params.append('type', type);
  if (year) params.append('year', year);
  if (sort) params.append('sort', sort);
  if (page) params.append('page', page.toString());

  logger.debug('API:Discover', `Querying media catalog [${source}]`, Object.fromEntries(params.entries()));

  const response = await fetch(`/api/discover/search?${params.toString()}`);
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    logger.error('API:Discover', 'Media query error', errData);
    throw new Error(errData.error || errData.details || 'Failed to query media discovery source');
  }
  const data = await response.json();
  logger.debug('API:Discover', `Received ${data.results?.length || 0} discovery items`, data);
  return data;
}

export async function fetchWatchlist() {
  const response = await fetch('/api/watchlist');
  if (!response.ok) {
    throw new Error('Failed to fetch watchlist');
  }
  const data = await response.json();
  logger.debug('API:Watchlist', `Loaded ${data.watchlist?.length || 0} wishlist items`);
  return data;
}

export async function addWatchlistItem(itemData) {
  logger.info('API:Watchlist', `Adding item: "${itemData.title || itemData.name}"`, itemData);
  const response = await fetch('/api/watchlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(itemData),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    logger.error('API:Watchlist', 'Add failed', data);
    throw new Error(data.error || 'Failed to add item to wishlist');
  }
  logger.info('API:Watchlist', 'Item added successfully', data);
  return data;
}

export async function removeWatchlistItem(id) {
  logger.info('API:Watchlist', `Removing item ${id}`);
  const response = await fetch(`/api/watchlist/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete wishlist item');
  }
  return await response.json();
}

/* Seedr Cloud Queue API Wrappers */

export async function addSeedrDownload(torrent, savePath) {
  const payload = { torrent, savePath };
  logger.info('API:Seedr', `Adding "${torrent?.title || 'Untitled'}" to Seedr Queue`, payload);

  const response = await fetch('/api/seedr/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({ ok: false, error: 'Malformed response from server' }));
  if (!response.ok || !data.ok) {
    const errMsg = data.error || 'Failed to queue torrent to Seedr';
    logger.error('API:Seedr', `Seedr queue failed: ${errMsg}`, data);
    throw new Error(errMsg);
  }

  logger.info('API:Seedr', 'Successfully queued to Seedr!', data);
  return data;
}

export async function fetchSeedrQueue() {
  const response = await fetch('/api/seedr/queue');
  if (!response.ok) {
    throw new Error('Failed to fetch Seedr queue');
  }
  const data = await response.json();
  logger.debug('API:Seedr', `Fetched Seedr queue (${data.queue?.length || 0} items)`, data);
  return data;
}

export async function cancelSeedrDownload(id) {
  logger.info('API:Seedr', `Cancelling Seedr task ${id}`);
  const response = await fetch(`/api/seedr/cancel/${encodeURIComponent(id)}`, {
    method: 'POST',
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to cancel Seedr task');
  }
  return data;
}

export async function clearCompletedSeedr() {
  logger.info('API:Seedr', 'Clearing completed items from Seedr queue');
  const response = await fetch('/api/seedr/clear-completed', {
    method: 'POST',
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to clear completed Seedr items');
  }
  return data;
}

