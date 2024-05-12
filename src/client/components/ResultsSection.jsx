import React from 'react';
import ResultsTable from './ResultsTable';
import ResultsGrid from './ResultsGrid';

export default function ResultsSection({
  results,
  loading,
  viewMode,
  onViewModeChange,
  onSelectDownload,
  hasSearched,
}) {
  return (
    <section className="results-section">
      <div className="section-header">
        <h3>
          <i className="fa-solid fa-list"></i> Search Results
          <span className="results-count-badge">{results.length} found</span>
        </h3>
        <div className="view-toggle">
          <button
            type="button"
            className={`toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => onViewModeChange('table')}
            title="Table View"
          >
            <i className="fa-solid fa-table-list"></i>
          </button>
          <button
            type="button"
            className={`toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
            onClick={() => onViewModeChange('cards')}
            title="Grid Cards View"
          >
            <i className="fa-solid fa-border-all"></i>
          </button>
        </div>
      </div>

      {loading && (
        <div className="loading-state glass-panel">
          <div className="spinner"></div>
          <p>Querying Prowlarr Indexers...</p>
        </div>
      )}

      {!loading && !hasSearched && (
        <div className="empty-state glass-panel">
          <div className="empty-icon">
            <i className="fa-solid fa-compass"></i>
          </div>
          <h3>Ready to Search</h3>
          <p>Type a search query above or click a quick suggestion to locate torrent indexer releases.</p>
        </div>
      )}

      {!loading && hasSearched && results.length === 0 && (
        <div className="empty-state glass-panel">
          <div className="empty-icon">
            <i className="fa-solid fa-face-frown"></i>
          </div>
          <h3>No Results Found</h3>
          <p>No torrent releases found matching your search query.</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <>
          {viewMode === 'table' ? (
            <ResultsTable results={results} onSelectDownload={onSelectDownload} />
          ) : (
            <ResultsGrid results={results} onSelectDownload={onSelectDownload} />
          )}
        </>
      )}
    </section>
  );
}
