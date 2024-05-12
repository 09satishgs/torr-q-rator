import React, { useState } from 'react';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function WatchlistBar({ watchlist, onSearchTitle, onSelectDownload, onRemoveItem }) {
  const [expandedId, setExpandedId] = useState(null);

  if (!watchlist || watchlist.length === 0) {
    return (
      <div className="watchlist-bar-container glass-panel">
        <div className="watchlist-header">
          <i className="fa-solid fa-bookmark maroon-icon"></i>
          <span>Your Wishlist &amp; Recommendations</span>
        </div>
        <p className="watchlist-empty-text">No items in wishlist yet. Save movies or highlight text on screen to add recommendations!</p>
      </div>
    );
  }

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="watchlist-bar-container glass-panel">
      <div className="watchlist-header">
        <div className="watchlist-title">
          <i className="fa-solid fa-bookmark maroon-icon"></i>
          <span>Wishlist &amp; Pre-fetched Torrents ({watchlist.length})</span>
        </div>
        <span className="watchlist-hint">Click a chip to search, or expand to view pre-fetched Top 3 Torrents</span>
      </div>

      <div className="watchlist-items-grid">
        {watchlist.map((item) => {
          const isExpanded = expandedId === item.id;
          const topTorrents = item.topTorrents || [];

          return (
            <div key={item.id} className={`watchlist-card ${isExpanded ? 'expanded' : ''}`}>
              <div className="watchlist-card-main">
                <button
                  type="button"
                  className="watchlist-title-chip"
                  onClick={() => onSearchTitle(item.title)}
                  title="Search torrents for this title"
                >
                  <i className="fa-solid fa-film"></i>
                  <span>{item.title}</span>
                </button>

                <div className="watchlist-actions">
                  {topTorrents.length > 0 && (
                    <button
                      type="button"
                      className="btn-prefetch-toggle"
                      onClick={() => toggleExpand(item.id)}
                      title="View top 3 pre-fetched torrents"
                    >
                      <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                      <span>Top 3 ({topTorrents.length})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn-remove-wl"
                    onClick={() => onRemoveItem(item.id)}
                    title="Remove from wishlist"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </div>

              {isExpanded && topTorrents.length > 0 && (
                <div className="prefetched-torrents-drawer">
                  <div className="prefetched-header">
                    <i className="fa-solid fa-bolt maroon-icon"></i>
                    <span>Pre-fetched Top 3 Releases (Ready for On-Demand Download):</span>
                  </div>

                  <div className="prefetched-list">
                    {topTorrents.map((t, idx) => (
                      <div key={t.id || idx} className="prefetched-torrent-row">
                        <div className="prefetched-info">
                          <span className="indexer-badge">{t.indexer}</span>
                          <span className="prefetched-title">{t.title}</span>
                        </div>

                        <div className="prefetched-meta">
                          <span className="size-cell">{formatBytes(t.size)}</span>
                          <span className="peers-cell">
                            <span className="seeders-count"><i className="fa-solid fa-arrow-up"></i> {t.seeders}</span> / {' '}
                            <span className="leechers-count"><i className="fa-solid fa-arrow-down"></i> {t.leechers}</span>
                          </span>
                          <button
                            type="button"
                            className="btn btn-download btn-sm"
                            onClick={() => onSelectDownload(t)}
                          >
                            <i className="fa-solid fa-download"></i> Download Now
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
