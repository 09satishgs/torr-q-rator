import React from 'react';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function ResultsTable({ results, onSelectDownload }) {
  return (
    <div className="results-table-container glass-panel">
      <table className="results-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Indexer</th>
            <th>Size</th>
            <th>Peers (S / L)</th>
            <th className="text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {results.map((item, index) => (
            <tr key={item.id || index}>
              <td className="torrent-title-cell">{item.title}</td>
              <td><span className="indexer-badge">{item.indexer}</span></td>
              <td className="size-cell">{formatBytes(item.size)}</td>
              <td className="peers-cell">
                <span className="seeders-count"><i className="fa-solid fa-arrow-up"></i> {item.seeders}</span> / {' '}
                <span className="leechers-count"><i className="fa-solid fa-arrow-down"></i> {item.leechers}</span>
              </td>
              <td className="text-right">
                <button className="btn btn-download" onClick={() => onSelectDownload(item)}>
                  <i className="fa-solid fa-download"></i> Download
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
