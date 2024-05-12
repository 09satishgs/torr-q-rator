import React from 'react';

export default function MetricsBar({ torrents, vpnStatus }) {
  let totalSpeed = 0;
  let activeCount = 0;

  if (Array.isArray(torrents)) {
    torrents.forEach(t => {
      if (t.dlspeed) totalSpeed += t.dlspeed;
      if (t.state === 'downloading') activeCount++;
    });
  }

  const formatSpeed = (bytesPerSec) => {
    if (!bytesPerSec || bytesPerSec === 0) return '0.0 MB/s';
    return (bytesPerSec / (1024 * 1024)).toFixed(2) + ' MB/s';
  };

  return (
    <section className="metrics-bar">
      <div className="metric-card glass-panel">
        <div className="metric-icon">
          <i className="fa-solid fa-satellite-dish"></i>
        </div>
        <div className="metric-data">
          <span className="metric-value">Connected</span>
          <span className="metric-label">Prowlarr Indexers</span>
        </div>
      </div>

      <div className="metric-card glass-panel">
        <div className="metric-icon">
          <i className="fa-solid fa-down-long"></i>
        </div>
        <div className="metric-data">
          <span className="metric-value">{formatSpeed(totalSpeed)}</span>
          <span className="metric-label">Total Download Speed</span>
        </div>
      </div>

      <div className="metric-card glass-panel">
        <div className="metric-icon">
          <i className="fa-solid fa-list-check"></i>
        </div>
        <div className="metric-data">
          <span className="metric-value">{activeCount} Active</span>
          <span className="metric-label">qBittorrent Queue</span>
        </div>
      </div>

      <div className="metric-card glass-panel">
        <div className="metric-icon">
          <i className="fa-solid fa-user-shield"></i>
        </div>
        <div className="metric-data">
          <span className="metric-value">
            {vpnStatus && vpnStatus.vpnConnected ? `${vpnStatus.protocol || 'WireGuard'} Active` : 'Unprotected'}
          </span>
          <span className="metric-label">Kill-Switch Protection</span>
        </div>
      </div>
    </section>
  );
}
