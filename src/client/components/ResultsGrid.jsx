import React from 'react';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function ResultsGrid({ results, onSelectDownload }) {
  return (
    <div className="results-grid">
      {results.map((item, index) => (
        <div key={item.id || index} className="torrent-card glass-panel">
          <div>
            <span className="indexer-badge">{item.indexer}</span>
            <h4 className="card-title" style={{ marginTop: '10px' }}>{item.title}</h4>
          </div>
          <div className="card-meta">
            <div>
              <div className="size-cell">{formatBytes(item.size)}</div>
              <div className="peers-cell" style={{ marginTop: '4px' }}>
                <span className="seeders-count"><i className="fa-solid fa-arrow-up"></i> {item.seeders}</span> &bull; {' '}
                <span className="leechers-count"><i className="fa-solid fa-arrow-down"></i> {item.leechers}</span>
              </div>
            </div>
            <button className="btn btn-download" onClick={() => onSelectDownload(item)}>
              <i className="fa-solid fa-download"></i> Download
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
