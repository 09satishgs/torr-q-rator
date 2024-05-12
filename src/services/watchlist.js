const fs = require('fs');
const path = require('path');
const prowlarrService = require('./prowlarr');

const DATA_DIR = path.join(__dirname, '../../data');
const WATCHLIST_FILE = path.join(DATA_DIR, 'watchlist.json');

class WatchlistService {
  constructor() {
    this.ensureDirectory();
  }

  ensureDirectory() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(WATCHLIST_FILE)) {
      fs.writeFileSync(WATCHLIST_FILE, JSON.stringify([], null, 2));
    }
  }

  getWatchlist() {
    try {
      this.ensureDirectory();
      const raw = fs.readFileSync(WATCHLIST_FILE, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      console.warn('[WatchlistService] Error reading watchlist file:', err.message);
      return [];
    }
  }

  /**
   * Add Item to Watchlist & Pre-fetch Top 3 Torrents via Prowlarr in parallel
   */
  async addItem(itemData) {
    const list = this.getWatchlist();
    const title = itemData.title || itemData.name || 'Untitled Release';

    console.log(`[WatchlistService] Adding "${title}" to wishlist. Pre-fetching top 3 torrents via Prowlarr...`);

    let topTorrents = [];
    try {
      const searchResults = await prowlarrService.search(title, 10);
      if (Array.isArray(searchResults)) {
        topTorrents = [...searchResults]
          .sort((a, b) => (b.seeders || 0) - (a.seeders || 0))
          .slice(0, 3);
      }
    } catch (err) {
      console.warn(`[WatchlistService] Parallel Prowlarr pre-fetch failed for "${title}":`, err.message);
    }

    const newItem = {
      id: `wl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: title,
      year: itemData.year || '2026',
      rating: itemData.rating || '8.0',
      genre: itemData.genre || 'Media',
      posterUrl: itemData.posterUrl || '',
      overview: itemData.overview || '',
      addedAt: Date.now(),
      topTorrents: topTorrents,
    };

    const existingIdx = list.findIndex(i => i.title.toLowerCase() === title.toLowerCase());
    if (existingIdx !== -1) {
      list[existingIdx] = newItem;
    } else {
      list.unshift(newItem);
    }

    try {
      fs.writeFileSync(WATCHLIST_FILE, JSON.stringify(list, null, 2));
    } catch (err) {
      console.error('[WatchlistService] Error saving watchlist:', err.message);
    }

    return newItem;
  }

  /**
   * Remove Item from Watchlist by ID
   */
  removeItem(id) {
    let list = this.getWatchlist();
    list = list.filter(item => item.id !== id && item.title !== id);

    try {
      fs.writeFileSync(WATCHLIST_FILE, JSON.stringify(list, null, 2));
      return true;
    } catch (err) {
      console.error('[WatchlistService] Error removing watchlist item:', err.message);
      return false;
    }
  }
}

module.exports = new WatchlistService();
