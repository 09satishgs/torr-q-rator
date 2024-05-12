import React, { useEffect } from 'react';
import { searchMediaCatalog } from '../services/api';

const SOURCES = [
  { id: 'tmdb', label: 'TMDB (Telugu & Regional Movies)', icon: 'fa-solid fa-clapperboard' },
  { id: 'anime', label: 'AniList (Anime & Series)', icon: 'fa-solid fa-dragon' },
  { id: 'omdb', label: 'OMDb (Global IMDb Search)', icon: 'fa-solid fa-film' },
];

const ANIME_GENRES = [
  'All Genres', 'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy',
  'Horror', 'Mecha', 'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life',
  'Sports', 'Supernatural', 'Thriller'
];

export default function DiscoverySection({
  mdhState,
  onMdhStateChange,
  onSearchTorrent,
  onAddToWishlist,
  addToast,
}) {
  const activeSource = mdhState.activeSource || 'tmdb';
  const currentSourceState = mdhState.sources[activeSource] || {};

  const {
    query = '',
    language = 'te',
    genre = '',
    type = 'all',
    format = 'ALL',
    year = '',
    sort = activeSource === 'anime' ? 'POPULARITY_DESC' : 'popularity.desc',
    page = 1,
    totalPages = 1,
    results = [],
    loading = false,
    initialLoaded = false,
  } = currentSourceState;

  // Initial load when mounting component if active source hasn't loaded yet
  useEffect(() => {
    if (!initialLoaded) {
      executeSearch(activeSource, currentSourceState);
    }
  }, [activeSource, initialLoaded]);

  const executeSearch = async (sourceKey, params) => {
    onMdhStateChange(sourceKey, { loading: true });

    try {
      const queryParams = {
        source: sourceKey,
        query: params.query || '',
        language: params.language || 'te',
        genre: params.genre || '',
        type: params.type || 'all',
        format: params.format || 'ALL',
        year: params.year || '',
        sort: params.sort || (sourceKey === 'anime' ? 'POPULARITY_DESC' : 'popularity.desc'),
        page: params.page || 1,
      };

      const data = await searchMediaCatalog(queryParams);

      onMdhStateChange(sourceKey, {
        results: data.results || [],
        page: data.page || 1,
        totalPages: data.totalPages || 1,
        loading: false,
        initialLoaded: true,
      });
    } catch (err) {
      console.warn(`[DiscoverySection] Search error for ${sourceKey}:`, err);
      if (addToast) {
        addToast(err.message || `Failed to query ${sourceKey.toUpperCase()} source`, 'error');
      }
      onMdhStateChange(sourceKey, {
        results: [],
        loading: false,
        initialLoaded: true,
      });
    }
  };

  const handleSourceRadioChange = (newSource) => {
    onMdhStateChange('ACTIVE_SOURCE', newSource);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    // Search ONLY executes when user clicks Search button or submits form
    executeSearch(activeSource, { ...currentSourceState, page: 1 });
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    executeSearch(activeSource, { ...currentSourceState, page: newPage });
  };

  const handleResetFilters = () => {
    const defaults = {
      tmdb: { query: '', language: 'te', year: '', sort: 'popularity.desc', page: 1 },
      anime: { query: '', genre: '', format: 'ALL', sort: 'POPULARITY_DESC', page: 1 },
      omdb: { query: '2024', type: 'all', year: '', page: 1 },
    };

    const sourceDefaults = defaults[activeSource] || {};
    onMdhStateChange(activeSource, sourceDefaults);
    executeSearch(activeSource, sourceDefaults);

    if (addToast) {
      addToast(`Filters for ${activeSource.toUpperCase()} reset to default`, 'info');
    }
  };

  return (
    <section className="discovery-section">
      <div className="discovery-box glass-panel">
        
        {/* Header & Source Radio Buttons Bar */}
        <div className="discovery-header">
          <div className="discovery-title">
            <h2><i className="fa-solid fa-layer-group maroon-icon"></i> Multi-Source Media Discovery Engine</h2>
            <p>Select your discovery source to explore Telugu movies, AniList Anime, or global IMDb titles</p>
          </div>

          <div className="discovery-actions-top">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleResetFilters}
              title="Reset current source search filters"
            >
              <i className="fa-solid fa-rotate-left"></i> Reset Filters
            </button>
          </div>
        </div>

        {/* Source Selection Radio Buttons */}
        <div className="source-radio-group">
          {SOURCES.map((s) => (
            <label key={s.id} className={`source-radio-label ${activeSource === s.id ? 'active' : ''}`}>
              <input
                type="radio"
                name="discoverySource"
                value={s.id}
                checked={activeSource === s.id}
                onChange={() => handleSourceRadioChange(s.id)}
              />
              <i className={s.icon}></i>
              <span>{s.label}</span>
            </label>
          ))}
        </div>

        {/* Dynamic UI View Controls per Source (No auto-search on dropdown change) */}
        <form onSubmit={handleFormSubmit} className="discovery-filter-bar">

          {/* DYNAMIC VIEW 1: TMDB Telugu & Regional Movies */}
          {activeSource === 'tmdb' && (
            <>
              <div className="filter-group">
                <label className="filter-label">Language:</label>
                <select
                  className="custom-select"
                  value={language}
                  onChange={(e) => onMdhStateChange('tmdb', { language: e.target.value })}
                >
                  <option value="te">Telugu (తెలుగు)</option>
                  <option value="hi">Hindi (हिंदी)</option>
                  <option value="ta">Tamil (தமிழ்)</option>
                  <option value="en">English</option>
                </select>

                <label className="filter-label">Sort:</label>
                <select
                  className="custom-select"
                  value={sort}
                  onChange={(e) => onMdhStateChange('tmdb', { sort: e.target.value })}
                >
                  <option value="popularity.desc">Most Popular</option>
                  <option value="vote_average.desc">Top Rated (Ratings)</option>
                  <option value="primary_release_date.desc">Latest Releases</option>
                </select>

                <input
                  type="text"
                  className="custom-input year-input"
                  value={year}
                  onChange={(e) => onMdhStateChange('tmdb', { year: e.target.value })}
                  placeholder="Year (e.g. 2024)"
                />
              </div>

              <div className="input-group search-input-group">
                <i className="fa-solid fa-magnifying-glass search-icon"></i>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => onMdhStateChange('tmdb', { query: e.target.value })}
                  placeholder="Search Telugu / Regional movies by name..."
                />
                <button type="submit" className="btn btn-primary btn-sm search-btn-inline">
                  <i className="fa-solid fa-magnifying-glass"></i> Search TMDB
                </button>
              </div>
            </>
          )}

          {/* DYNAMIC VIEW 2: AniList GraphQL Anime Engine */}
          {activeSource === 'anime' && (
            <>
              <div className="filter-group">
                <label className="filter-label">Sort:</label>
                <select
                  className="custom-select"
                  value={sort}
                  onChange={(e) => onMdhStateChange('anime', { sort: e.target.value })}
                >
                  <option value="POPULARITY_DESC">Most Popular</option>
                  <option value="SCORE_DESC">Top Rated (Scores)</option>
                  <option value="TRENDING_DESC">Trending Now</option>
                  <option value="START_DATE_DESC">Latest Releases</option>
                </select>

                <label className="filter-label">Format:</label>
                <select
                  className="custom-select"
                  value={format}
                  onChange={(e) => onMdhStateChange('anime', { format: e.target.value })}
                >
                  <option value="ALL">All Formats</option>
                  <option value="TV">TV Series</option>
                  <option value="MOVIE">Anime Movie</option>
                  <option value="OVA">OVA / Special</option>
                </select>

                <label className="filter-label">Genre:</label>
                <select
                  className="custom-select"
                  value={genre}
                  onChange={(e) => onMdhStateChange('anime', { genre: e.target.value })}
                >
                  {ANIME_GENRES.map((g) => (
                    <option key={g} value={g === 'All Genres' ? '' : g}>{g}</option>
                  ))}
                </select>
              </div>

              <div className="input-group search-input-group">
                <i className="fa-solid fa-dragon search-icon"></i>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => onMdhStateChange('anime', { query: e.target.value })}
                  placeholder="Search anime on AniList (e.g. 'Attack on Titan', 'Demon Slayer')..."
                />
                <button type="submit" className="btn btn-primary btn-sm search-btn-inline">
                  <i className="fa-solid fa-magnifying-glass"></i> Search AniList
                </button>
              </div>
            </>
          )}

          {/* DYNAMIC VIEW 3: OMDb Global IMDb Search */}
          {activeSource === 'omdb' && (
            <>
              <div className="filter-group">
                <label className="filter-label">Type:</label>
                <select
                  className="custom-select"
                  value={type}
                  onChange={(e) => onMdhStateChange('omdb', { type: e.target.value })}
                >
                  <option value="all">All Release Types</option>
                  <option value="movie">Movies</option>
                  <option value="series">TV / Web Series</option>
                </select>

                <input
                  type="text"
                  className="custom-input year-input"
                  value={year}
                  onChange={(e) => onMdhStateChange('omdb', { year: e.target.value })}
                  placeholder="Year (e.g. 2024)"
                />
              </div>

              <div className="input-group search-input-group">
                <i className="fa-solid fa-magnifying-glass search-icon"></i>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => onMdhStateChange('omdb', { query: e.target.value })}
                  placeholder="Search global movies & shows by title..."
                />
                <button type="submit" className="btn btn-primary btn-sm search-btn-inline">
                  <i className="fa-solid fa-magnifying-glass"></i> Search OMDb
                </button>
              </div>
            </>
          )}

        </form>

        {/* Media Poster Cards Grid */}
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Fetching discovery items from {activeSource.toUpperCase()} API...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="empty-state">
            <i className="fa-solid fa-film empty-icon"></i>
            <h3>No Results Found</h3>
            <p>No results matched your search criteria on {activeSource.toUpperCase()}. Adjust your query or filters and click Search.</p>
          </div>
        ) : (
          <>
            <div className="discovery-grid">
              {results.map((item) => (
                <div key={item.id} className="discovery-card">
                  <div className="poster-wrapper">
                    {item.posterUrl ? (
                      <img
                        src={item.posterUrl}
                        alt={item.title}
                        className="poster-img"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div
                      className="poster-fallback"
                      style={{ display: item.posterUrl ? 'none' : 'flex' }}
                    >
                      <i className="fa-solid fa-film"></i>
                      <span>{item.title}</span>
                    </div>

                    <span className="rating-badge">★ {item.rating}</span>
                  </div>

                  <div className="discovery-card-content">
                    <div className="discovery-card-header">
                      <h4 className="media-title">{item.title}</h4>
                      {item.originalTitle && item.originalTitle !== item.title && (
                        <div className="media-subtitle">{item.originalTitle}</div>
                      )}
                      <div className="media-year">
                        {item.year} &bull; {item.genre} {item.episodes ? `(${item.episodes})` : ''} {item.studio ? `&bull; ${item.studio}` : ''}
                      </div>
                    </div>

                    <p className="media-overview">{item.overview}</p>

                    <div className="discovery-card-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => onAddToWishlist(item)}
                        title="Save to Wishlist & Pre-fetch Top 3 Torrents"
                      >
                        <i className="fa-solid fa-bookmark"></i> + Wishlist
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => onSearchTorrent(item.title)}
                        title="Search torrent indexers for this title"
                      >
                        <i className="fa-solid fa-bolt"></i> Find Torrents
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="pagination-bar">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                >
                  <i className="fa-solid fa-chevron-left"></i> Previous
                </button>

                <span className="page-indicator">
                  Page <strong>{page}</strong> of <strong>{totalPages}</strong>
                </span>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => handlePageChange(page + 1)}
                >
                  Next <i className="fa-solid fa-chevron-right"></i>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
