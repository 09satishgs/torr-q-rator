const axios = require('axios');
const config = require('../config');

class ProwlarrService {
  constructor() {
    this.client = axios.create({
      baseURL: config.prowlarr.baseUrl,
      timeout: 8000,
    });
  }

  /**
   * Search torrent indexers via Prowlarr API v1
   * @param {string} query Search terms
   * @param {number} limit Maximum results to return
   */
  async search(query, limit = 20) {
    if (!query || query.trim() === '') {
      return [];
    }

    try {
      console.log(`[ProwlarrService] Querying Prowlarr at ${config.prowlarr.baseUrl} for: "${query}"`);
      const response = await this.client.get('/api/v1/search', {
        headers: {
          'X-Api-Key': config.prowlarr.apiKey,
        },
        params: {
          query: query.trim(),
          limit: limit,
        },
      });

      if (Array.isArray(response.data)) {
        console.log(`[ProwlarrService] Prowlarr returned ${response.data.length} results.`);
        return response.data.map((item, index) => this.normalizeResult(item, index));
      }
      return [];
    } catch (error) {
      console.error(`[ProwlarrService] Live API search error (${error.message}).`);
      throw new Error(`Prowlarr Search Error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Check connection health to Prowlarr server
   */
  async checkHealth() {
    try {
      const response = await this.client.get('/api/v1/health', {
        headers: {
          'X-Api-Key': config.prowlarr.apiKey,
        },
      });
      return { connected: true, status: response.status };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }

  /**
   * Normalize Prowlarr result item
   */
  normalizeResult(item, index) {
    let rawMagnet = item.magnetUrl || item.infoUrl || '';

    // Check for "The Pirate Bay" indexer where magnet is stored under "id" or "guid"
    const isTPB = (item.indexer && /the\s*pirate\s*bay/i.test(item.indexer)) ||
                  (item.indexerName && /the\s*pirate\s*bay/i.test(item.indexerName));

    if ((isTPB || !rawMagnet) && typeof item.id === 'string' && item.id.trim().toLowerCase().startsWith('magnet:?')) {
      rawMagnet = item.id.trim();
    } else if ((isTPB || !rawMagnet) && typeof item.guid === 'string' && item.guid.trim().toLowerCase().startsWith('magnet:?')) {
      rawMagnet = item.guid.trim();
    }

    const isMagnet = typeof rawMagnet === 'string' && rawMagnet.startsWith('magnet:?');
    const magnetUrl = isMagnet ? rawMagnet : '';

    let downloadUrl = item.downloadUrl || item.link || '';
    if (downloadUrl && !downloadUrl.startsWith('magnet:?')) {
      if (downloadUrl.startsWith('/')) {
        downloadUrl = `${config.prowlarr.baseUrl}${downloadUrl}`;
      }
      if (config.prowlarr.apiKey && !downloadUrl.includes('apikey=')) {
        const separator = downloadUrl.includes('?') ? '&' : '?';
        downloadUrl = `${downloadUrl}${separator}apikey=${config.prowlarr.apiKey}`;
      }
    }

    return {
      id: item.guid || item.id || `prowlarr-${index}-${Date.now()}`,
      title: item.title || 'Untitled Torrent',
      size: item.size || 0,
      seeders: item.seeders ?? 0,
      leechers: item.leechers ?? 0,
      indexer: item.indexer || item.indexerName || 'Unknown Indexer',
      magnetUrl: magnetUrl,
      downloadUrl: downloadUrl,
      publishDate: item.publishDate || null,
      category: item.categories ? item.categories.map(c => c.name).join(', ') : 'General',
    };
  }
}

module.exports = new ProwlarrService();
