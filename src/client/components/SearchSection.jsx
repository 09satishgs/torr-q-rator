import React, { useState, useEffect } from 'react';

const QUICK_CHIPS = [
  { label: 'Ubuntu ISO', query: 'Ubuntu 24.04' },
  { label: 'Debian', query: 'Debian 12' },
  { label: 'Arch', query: 'Arch Linux' },
  { label: 'Blender', query: 'Blender 4' },
  { label: 'Big Buck Bunny', query: 'Big Buck Bunny' },
];

export default function SearchSection({ initialQuery = '', onSearch, sortBy, onSortChange }) {
  const [searchInput, setSearchInput] = useState(initialQuery);

  useEffect(() => {
    if (initialQuery) {
      setSearchInput(initialQuery);
    }
  }, [initialQuery]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onSearch(searchInput.trim());
    }
  };

  const handleChipClick = (query) => {
    setSearchInput(query);
    onSearch(query);
  };

  const handleClear = () => {
    setSearchInput('');
  };

  return (
    <section className="search-section">
      <div className="search-box-card glass-panel">
        <div className="search-headline">
          <h2>Unified Torrent Search</h2>
          <p>Aggregated indexing via Prowlarr &amp; secure downloads via qBittorrent</p>
        </div>

        <form onSubmit={handleSubmit} className="search-form">
          <div className="input-group">
            <i className="fa-solid fa-magnifying-glass search-icon"></i>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search movies, TV, Linux ISOs, software, audio..."
              autoComplete="off"
              required
            />
            {searchInput && (
              <button type="button" className="clear-btn" onClick={handleClear} title="Clear">
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>

          <button type="submit" className="btn btn-primary">
            <i className="fa-solid fa-bolt"></i>
            <span>Search</span>
          </button>
        </form>

        <div className="search-meta-bar">
          <div className="quick-tags">
            <span className="tag-label">Quick Search:</span>
            {QUICK_CHIPS.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                className="chip"
                onClick={() => handleChipClick(chip.query)}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="filter-controls">
            <label htmlFor="sortBySelect" className="filter-label">Sort By:</label>
            <select
              id="sortBySelect"
              className="custom-select"
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
            >
              <option value="seeders-desc">Seeders (High to Low)</option>
              <option value="size-desc">Size (Largest First)</option>
              <option value="size-asc">Size (Smallest First)</option>
              <option value="title-asc">Title (A-Z)</option>
            </select>
          </div>
        </div>
      </div>
    </section>
  );
}
