const axios = require('axios');
const https = require('https');

// Custom HTTPS Agent to prevent TLS socket disconnection / keep-alive drops over VPN
const httpsAgent = new https.Agent({
  keepAlive: false,
  rejectUnauthorized: false,
});

// Public API Configuration
const OMDB_API_KEY = process.env.OMDB_API_KEY || 'trilogy';
const OMDB_BASE_URL = 'http://www.omdbapi.com';

// TMDB Public Read API Key & Endpoints
const TMDB_API_KEY = process.env.TMDB_API_KEY || '15d2ede00c071716a305968296117e9b';
const TMDB_BASE_URL_HTTPS = 'https://api.themoviedb.org/3';
const TMDB_BASE_URL_HTTP = 'http://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

// Anime Endpoints: AniList GraphQL (Primary) & Kitsu JSON:API (Fallback)
const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';
const KITSU_BASE_URL = 'https://kitsu.io/api/edge';

const GENERAL_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

const KITSU_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/vnd.api+json',
  'Content-Type': 'application/vnd.api+json',
};

class DiscoveryService {
  /**
   * Main Dispatcher for Multi-Source Media Discovery
   */
  async searchMedia({
    source = 'tmdb',
    query = '',
    language = 'te',
    genre = '',
    type = 'movie',
    format = '',
    year = '',
    sort = 'popularity.desc',
    page = 1,
  }) {
    const pageNum = parseInt(page || 1, 10);

    if (source === 'anime') {
      return await this.searchAnime({ query, genre, format, sort, page: pageNum });
    }
    if (source === 'omdb') {
      return await this.searchOmdb({ query, type, year, page: pageNum });
    }
    // Default: TMDB (Telugu & Regional Movies)
    return await this.searchTmdb({ language, query, year, sort, page: pageNum });
  }

  /**
   * Source 1: TMDB API (Telugu & Regional Movies) with TLS Socket Retry & HTTP Fallback
   */
  async searchTmdb({ language = 'te', query = '', year = '', sort = 'popularity.desc', page = 1 }) {
    const isSearch = query && query.trim();
    const path = isSearch ? '/search/movie' : '/discover/movie';

    const params = {
      api_key: TMDB_API_KEY,
      page: page,
    };

    if (isSearch) {
      params.query = query.trim();
    } else {
      params.with_original_language = language;
      params.sort_by = sort || 'popularity.desc';
      if (year && year.trim()) {
        params.primary_release_year = year.trim();
      }
    }

    console.log(`[DiscoveryService] Querying TMDB API: lang=${language}, query="${query}", page=${page}`);

    // Attempt 1: HTTPS with custom TLS Agent
    try {
      const response = await axios.get(`${TMDB_BASE_URL_HTTPS}${path}`, {
        headers: GENERAL_HEADERS,
        params,
        httpsAgent,
        timeout: 10000,
      });

      return this.formatTmdbResponse(response.data, language, page);
    } catch (error1) {
      console.warn(`[DiscoveryService] TMDB HTTPS query failed (${error1.message}). Retrying via HTTP fallback...`);
    }

    // Attempt 2: HTTP Fallback to bypass TLS Socket Disconnection
    try {
      const responseHttp = await axios.get(`${TMDB_BASE_URL_HTTP}${path}`, {
        headers: GENERAL_HEADERS,
        params,
        timeout: 10000,
      });

      return this.formatTmdbResponse(responseHttp.data, language, page);
    } catch (error2) {
      console.error(`[DiscoveryService] TMDB HTTP Fallback Error: ${error2.message}`);
      throw new Error(`TMDB API Connection Error: Unable to establish TLS socket to TMDB (${error2.message}). Please check internet/VPN connectivity.`);
    }
  }

  formatTmdbResponse(data, language, page) {
    if (data && Array.isArray(data.results)) {
      const totalPages = Math.min(data.total_pages || 1, 50);
      const results = data.results.map((item) => ({
        id: `tmdb-${item.id}`,
        title: item.title || item.original_title,
        originalTitle: item.original_title,
        year: item.release_date ? item.release_date.substring(0, 4) : '2024',
        rating: item.vote_average ? item.vote_average.toFixed(1) : 'N/A',
        voteCount: item.vote_count || 0,
        genre: language ? language.toUpperCase() : 'MOVIE',
        mediaType: 'movie',
        source: 'tmdb',
        language: language,
        posterUrl: item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : '',
        overview: item.overview || `${item.title} (${item.original_title}) - Released in ${item.release_date || 'Telugu'}.`,
      }));

      return {
        source: 'tmdb',
        page,
        totalPages,
        count: results.length,
        results,
      };
    }

    return { source: 'tmdb', page: 1, totalPages: 1, count: 0, results: [] };
  }

  /**
   * Source 2: AniList GraphQL Anime Engine (With Kitsu Fallback)
   */
  async searchAnime({ query = '', genre = '', format = '', sort = 'POPULARITY_DESC', page = 1 }) {
    const cleanQuery = query ? query.trim() : '';

    // Attempt 1: AniList Public GraphQL API
    try {
      console.log(`[DiscoveryService] Querying AniList GraphQL API: query="${cleanQuery}", genre="${genre}", format="${format}", page=${page}...`);
      
      const graphqlQuery = `
        query ($search: String, $page: Int, $perPage: Int, $genre: String, $format: MediaFormat, $sort: [MediaSort]) {
          Page(page: $page, perPage: $perPage) {
            pageInfo {
              total
              lastPage
            }
            media(search: $search, genre: $genre, format: $format, type: ANIME, sort: $sort) {
              id
              title {
                english
                romaji
                native
              }
              coverImage {
                extraLarge
                large
              }
              bannerImage
              averageScore
              episodes
              duration
              status
              format
              genres
              season
              seasonYear
              startDate {
                year
              }
              studios(isMain: true) {
                nodes {
                  name
                }
              }
              description
            }
          }
        }
      `;

      const aniSortMap = {
        'POPULARITY_DESC': ['POPULARITY_DESC'],
        'SCORE_DESC': ['SCORE_DESC'],
        'TRENDING_DESC': ['TRENDING_DESC'],
        'START_DATE_DESC': ['START_DATE_DESC'],
      };

      const variables = {
        page: page,
        perPage: 12,
        sort: aniSortMap[sort] || ['POPULARITY_DESC'],
      };

      if (cleanQuery) {
        variables.search = cleanQuery;
      }
      if (genre && genre !== 'All Genres') {
        variables.genre = genre;
      }
      if (format && format !== 'ALL') {
        variables.format = format;
      }

      const aniResponse = await axios.post(
        ANILIST_GRAPHQL_URL,
        { query: graphqlQuery, variables },
        { headers: GENERAL_HEADERS, httpsAgent, timeout: 8000 }
      );

      const pageData = aniResponse.data?.data?.Page;
      if (pageData && Array.isArray(pageData.media) && pageData.media.length > 0) {
        const totalPages = Math.min(pageData.pageInfo?.lastPage || 1, 40);

        const results = pageData.media.map((item) => {
          const rawScore = item.averageScore ? (item.averageScore / 10).toFixed(1) : 'N/A';
          const cleanDesc = item.description ? item.description.replace(/<[^>]*>?/gm, '') : '';
          const title = item.title?.english || item.title?.romaji || item.title?.native || 'Anime Release';
          const studioName = item.studios?.nodes?.[0]?.name || '';

          return {
            id: `anilist-${item.id}`,
            title: title,
            originalTitle: item.title?.native || item.title?.romaji || title,
            year: item.seasonYear || item.startDate?.year || 'Anime',
            rating: rawScore,
            episodes: item.episodes ? `${item.episodes} eps` : (item.format || 'TV'),
            duration: item.duration ? `${item.duration}m` : '',
            status: item.status ? item.status.replace(/_/g, ' ') : 'FINISHED',
            format: item.format || 'TV',
            studio: studioName,
            genre: Array.isArray(item.genres) ? item.genres.slice(0, 3).join(', ') : 'Anime',
            mediaType: 'anime',
            source: 'anime',
            bannerUrl: item.bannerImage || '',
            posterUrl: item.coverImage?.extraLarge || item.coverImage?.large || '',
            overview: cleanDesc || `${title} - Anime series produced by ${studioName || 'Japan'}.`,
          };
        });

        return {
          source: 'anime',
          page,
          totalPages,
          count: results.length,
          results,
        };
      }
    } catch (aniErr) {
      console.warn(`[DiscoveryService] AniList API failed (${aniErr.message}). Switching to Kitsu JSON:API fallback...`);
    }

    // Fallback: Kitsu JSON:API
    try {
      const pageOffset = (page - 1) * 12;
      const params = {
        'page[limit]': 12,
        'page[offset]': pageOffset,
      };

      if (cleanQuery) {
        params['filter[text]'] = cleanQuery;
      }
      if (genre && genre !== 'All Genres') {
        params['filter[categories]'] = genre.toLowerCase();
      }

      const kitsuResp = await axios.get(`${KITSU_BASE_URL}/anime`, { headers: KITSU_HEADERS, httpsAgent, params, timeout: 8000 });

      if (kitsuResp.data && Array.isArray(kitsuResp.data.data) && kitsuResp.data.data.length > 0) {
        const totalCount = kitsuResp.data.meta?.count || 12;
        const totalPages = Math.min(Math.ceil(totalCount / 12), 30);

        const results = kitsuResp.data.data.map((item) => {
          const attr = item.attributes || {};
          const ratingVal = attr.averageRating ? (parseFloat(attr.averageRating) / 10).toFixed(1) : 'N/A';
          const yearVal = attr.startDate ? attr.startDate.substring(0, 4) : 'Anime';

          return {
            id: `kitsu-${item.id}`,
            title: attr.canonicalTitle || attr.titles?.en || attr.titles?.en_jp || 'Anime Release',
            originalTitle: attr.titles?.ja_jp || attr.canonicalTitle,
            year: yearVal,
            rating: ratingVal,
            episodes: attr.episodeCount ? `${attr.episodeCount} eps` : 'TV',
            duration: attr.episodeLength ? `${attr.episodeLength}m` : '',
            status: attr.status ? attr.status.toUpperCase() : 'FINISHED',
            format: attr.showType ? attr.showType.toUpperCase() : 'TV',
            studio: 'Kitsu',
            genre: genre || 'Anime',
            mediaType: 'anime',
            source: 'anime',
            bannerUrl: attr.coverImage?.original || '',
            posterUrl: attr.posterImage?.medium || attr.posterImage?.original || '',
            overview: attr.synopsis || `${attr.canonicalTitle} - Anime series.`,
          };
        });

        return {
          source: 'anime',
          page,
          totalPages,
          count: results.length,
          results,
        };
      }
    } catch (kitsuErr) {
      console.error(`[DiscoveryService] Kitsu Fallback Error: ${kitsuErr.message}`);
    }

    throw new Error('Anime Discovery Error: Unable to fetch anime results from AniList or Kitsu.');
  }

  /**
   * Source 3: OMDb API (Global IMDb Search)
   */
  async searchOmdb({ query = '2024', type = 'all', year = '', page = 1 }) {
    const searchTerm = query && query.trim() ? query.trim() : '2024';
    const omdbType = type && type !== 'all' ? type : undefined;
    const omdbYear = year && year.trim() ? year.trim() : undefined;

    try {
      console.log(`[DiscoveryService] Querying OMDb API: term="${searchTerm}", type="${omdbType || 'any'}", page=${page}`);
      
      const response = await axios.get(OMDB_BASE_URL, {
        params: {
          apikey: OMDB_API_KEY,
          s: searchTerm,
          type: omdbType,
          y: omdbYear,
          page: page,
        },
        timeout: 8000,
      });

      if (response.data && response.data.Response === 'True' && Array.isArray(response.data.Search)) {
        const totalResults = parseInt(response.data.totalResults || '10', 10);
        const totalPages = Math.min(Math.ceil(totalResults / 10), 20);

        const results = response.data.Search.map((item, idx) => ({
          id: item.imdbID || `omdb-${idx}-${Date.now()}`,
          title: item.Title,
          year: item.Year || 'N/A',
          rating: 'IMDb',
          genre: item.Type ? item.Type.toUpperCase() : 'MEDIA',
          mediaType: item.Type === 'series' ? 'series' : 'movie',
          source: 'omdb',
          posterUrl: item.Poster && item.Poster !== 'N/A' ? item.Poster : '',
          overview: `${item.Title} (${item.Year}) - ${item.Type ? item.Type.toUpperCase() : 'Release'} listed on IMDb (${item.imdbID}).`,
          imdbID: item.imdbID,
        }));

        return {
          source: 'omdb',
          page,
          totalPages,
          count: results.length,
          results,
        };
      }

      return { source: 'omdb', page: 1, totalPages: 1, count: 0, results: [] };
    } catch (error) {
      console.error(`[DiscoveryService] OMDb API Error: ${error.message}`);
      throw new Error(`OMDb API Error: ${error.message}`);
    }
  }
}

module.exports = new DiscoveryService();
