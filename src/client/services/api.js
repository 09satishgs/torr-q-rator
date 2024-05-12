/**
 * Frontend API Service Layer
 */

export async function searchTorrents(query, limit = 30) {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to search torrent releases');
  }
  return await response.json();
}

export async function fetchDirectories() {
  const response = await fetch('/api/directories');
  if (!response.ok) {
    throw new Error('Failed to fetch recommended directories');
  }
  return await response.json();
}

export async function addDownload(source, savePath) {
  const response = await fetch('/api/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, savePath }),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.error || 'Failed to queue torrent download');
  }
  return data;
}

export async function fetchTorrentsList() {
  const response = await fetch('/api/torrents');
  if (!response.ok) {
    throw new Error('Failed to fetch active torrent transfers');
  }
  return await response.json();
}

export async function checkVpnStatus() {
  const response = await fetch('/api/vpn/status');
  if (!response.ok) {
    throw new Error('Failed to check VPN status');
  }
  return await response.json();
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

  const response = await fetch(`/api/discover/search?${params.toString()}`);
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || errData.details || 'Failed to query media discovery source');
  }
  return await response.json();
}

export async function fetchWatchlist() {
  const response = await fetch('/api/watchlist');
  if (!response.ok) {
    throw new Error('Failed to fetch wishlist');
  }
  return await response.json();
}

export async function addWatchlistItem(itemData) {
  const response = await fetch('/api/watchlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(itemData),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to add item to wishlist');
  }
  return data;
}

export async function removeWatchlistItem(id) {
  const response = await fetch(`/api/watchlist/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete wishlist item');
  }
  return await response.json();
}
