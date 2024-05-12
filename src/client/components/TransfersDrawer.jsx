import React from 'react';

function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec === 0) return '0.0 MB/s';
  return (bytesPerSec / (1024 * 1024)).toFixed(2) + ' MB/s';
}

function formatEta(seconds) {
  if (!seconds || seconds <= 0 || seconds > 864000) return 'Done / ∞';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  }
  return `${mins}m ${secs}s`;
}

export default function TransfersDrawer({ isOpen, torrents, onClose }) {
  if (!isOpen) return null;

  return (
    <>
      <div className="drawer-overlay" onClick={onClose}></div>
      <aside className="downloads-drawer glass-panel">
        <div className="drawer-header">
          <div className="drawer-title">
            <i className="fa-solid fa-circle-down maroon-icon"></i>
            <h3>Active Transfers</h3>
          </div>
          <button type="button" className="btn-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="drawer-content">
          <div className="drawer-summary-bar">
            <span>Polling qBittorrent via VPN</span>
            <span className="auto-refresh-tag">
              <i className="fa-solid fa-rotate"></i> 3s Live Refresh
            </span>
          </div>

          <div className="drawer-torrent-list">
            {(!torrents || torrents.length === 0) ? (
              <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '40px 0' }}>
                <i className="fa-solid fa-inbox" style={{ fontSize: '32px', marginBottom: '10px' }}></i>
                <p>No active transfers in queue</p>
              </div>
            ) : (
              torrents.map((t, idx) => {
                const pct = Math.round((t.progress || 0) * 100);
                const speedStr = formatSpeed(t.dlspeed || 0);
                const etaStr = formatEta(t.eta);
                const stateClass = (t.state || '').toLowerCase();

                return (
                  <div key={t.hash || idx} className="transfer-card">
                    <div className="transfer-title">{t.name}</div>
                    <div className="progress-bar-container">
                      <div className="progress-bar-fill" style={{ width: `${pct}%` }}></div>
                    </div>
                    <div className="transfer-stats">
                      <span>{pct}% &bull; {speedStr}</span>
                      <span className={`state-tag ${stateClass}`}>
                        {t.state || 'downloading'} ({etaStr})
                      </span>
                    </div>
                    <div className="transfer-path">
                      <i className="fa-solid fa-folder"></i> {t.save_path || '/downloads'}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
