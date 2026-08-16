const axios = require('axios');
const config = require('../config');

class FlareSolverrService {
  constructor() {
    this.baseUrl = config.flaresolverr.baseUrl;
    this.enabled = config.flaresolverr.enabled;
    this.timeout = config.flaresolverr.timeout;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Check connection health to FlareSolverr service
   */
  async checkHealth() {
    if (!this.enabled) {
      return { connected: false, enabled: false, message: 'FlareSolverr is disabled in config' };
    }

    try {
      const response = await this.client.get('/health');
      return {
        connected: true,
        enabled: true,
        status: response.data?.status || 'ok',
        version: response.data?.version || 'unknown',
      };
    } catch (error) {
      return {
        connected: false,
        enabled: true,
        error: `FlareSolverr not reachable at ${this.baseUrl} (${error.message})`,
      };
    }
  }

  /**
   * Solve Cloudflare challenge for a URL using FlareSolverr
   * @param {string} targetUrl The protected URL to request
   * @param {Object} options Additional options (method, postData, session, headers)
   */
  async solveUrl(targetUrl, options = {}) {
    if (!this.enabled) {
      throw new Error('FlareSolverr is disabled in configuration');
    }

    const payload = {
      cmd: options.method === 'POST' ? 'request.post' : 'request.get',
      url: targetUrl,
      maxTimeout: options.maxTimeout || this.timeout,
    };

    if (options.postData) {
      payload.postData = options.postData;
    }

    if (options.session) {
      payload.session = options.session;
    }

    try {
      console.log(`[FlareSolverrService] Solving Cloudflare challenge for: ${targetUrl.slice(0, 80)}...`);
      const response = await this.client.post('/v2', payload);

      if (response.data && response.data.status === 'ok') {
        const solution = response.data.solution || {};
        console.log(`[FlareSolverrService] Successfully bypassed challenge! HTTP Status: ${solution.status}`);
        return {
          ok: true,
          status: solution.status,
          responseUrl: solution.url,
          html: solution.response,
          cookies: solution.cookies || [],
          userAgent: solution.userAgent,
          headers: solution.headers || {},
        };
      }

      throw new Error(response.data?.message || 'FlareSolverr failed to solve challenge');
    } catch (error) {
      console.error(`[FlareSolverrService] Error solving URL (${error.message}):`, error.response?.data || '');
      return {
        ok: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Extract HTML content from a Cloudflare-protected page
   * @param {string} targetUrl URL to fetch
   */
  async extractHtml(targetUrl) {
    const result = await this.solveUrl(targetUrl);
    if (result.ok && result.html) {
      return result.html;
    }
    return null;
  }
}

module.exports = new FlareSolverrService();
