import React, { useState } from 'react';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

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

function getSeedrStatusLabel(status, progress, error) {
  switch (status) {
    case 'queued':
      return { text: 'In Queue', className: 'status-queued', icon: 'fa-clock' };
    case 'started':
      return { text: 'Starting...', className: 'status-started', icon: 'fa-spinner fa-spin' };
    case 'downloading_seedr':
      return { text: `Cloud Seeding (${progress || 0}%)`, className: 'status-seedr-cloud', icon: 'fa-cloud-arrow-down' };
    case 'downloading_local':
      return { text: `Downloading Local (${progress || 0}%)`, className: 'status-seedr-local', icon: 'fa-download' };
    case 'completed':
      return { text: 'Completed & Cleaned', className: 'status-completed', icon: 'fa-circle-check' };
    case 'cancelled':
      return { text: 'Cancelled', className: 'status-cancelled', icon: 'fa-ban' };
    case 'failed':
      return { text: error ? `Failed: ${error}` : 'Failed', className: 'status-failed', icon: 'fa-circle-xmark' };
    default:
      return { text: status, className: 'status-default', icon: 'fa-circle-info' };
  }
}

export default function TransfersDrawer({
  isOpen,
  torrents = [],
  seedrQueue = [],
  seedrSpace = null,
  onCancelSeedr,
  onClearCompletedSeedr,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState('qbittorrent'); // 'qbittorrent' | 'seedr'

  if (!isOpen) return null;

  const activeSeedrCount = seedrQueue.filter(item =>
    ['queued', 'started', 'downloading_seedr', 'downloading_local'].includes(item.status)
  ).length;

  return (
    <>
      <div className="drawer-overlay" onClick={onClose}></div>
      <aside className="downloads-drawer glass-panel">
        <div className="drawer-header">
          <div className="drawer-title">
            <i className="fa-solid fa-circle-down maroon-icon"></i>
            <h3>Active Transfers</h3>
          </div>
          <button type="button" className="btn-close" onClick={onClose} title="Close">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Two-Tab Navigation Bar */}
        <div className="drawer-tabs-nav">
          <button
            type="button"
            className={`drawer-tab-btn ${activeTab === 'qbittorrent' ? 'active' : ''}`}
            onClick={() => setActiveTab('qbittorrent')}
          >
            <i className="fa-solid fa-network-wired"></i>
            <span>qBittorrent</span>
            {torrents.length > 0 && <span className="tab-badge">{torrents.length}</span>}
          </button>
          <button
            type="button"
            className={`drawer-tab-btn ${activeTab === 'seedr' ? 'active' : ''}`}
            onClick={() => setActiveTab('seedr')}
          >
            <i className="fa-solid fa-bolt"></i>
            <span>Seedr Queue</span>
            {activeSeedrCount > 0 && <span className="tab-badge seedr-badge">{activeSeedrCount}</span>}
          </button>
        </div>

        <div className="drawer-content">
          {/* TAB 1: qBittorrent Transfers */}
          {activeTab === 'qbittorrent' && (
            <>
              <div className="drawer-summary-bar">
                <span>Polling qBittorrent via VPN</span>
                <span className="auto-refresh-tag">
                  <i className="fa-solid fa-rotate"></i> 3s Live Refresh
                </span>
              </div>

              <div className="drawer-torrent-list">
                {(!torrents || torrents.length === 0) ? (
                  <div className="drawer-empty-state">
                    <i className="fa-solid fa-inbox"></i>
                    <p>No active transfers in qBittorrent</p>
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
            </>
          )}

          {/* TAB 2: Seedr Cloud Queue */}
          {activeTab === 'seedr' && (
            <>
              <div className="drawer-summary-bar seedr-summary-bar">
                <div className="seedr-storage-pill">
                  <i className="fa-solid fa-cloud"></i>
                  <span>
                    {seedrSpace
                      ? `${formatBytes(seedrSpace.spaceUsed || 0)} / ${formatBytes(seedrSpace.spaceMax || 5368709120)}`
                      : '5GB Free Cloud Tier'}
                  </span>
                </div>
                <div className="seedr-actions-pill">
                  <button
                    type="button"
                    className="btn-clear-history"
                    onClick={onClearCompletedSeedr}
                    title="Clear completed/cancelled history"
                  >
                    <i className="fa-solid fa-broom"></i> Clear Finished
                  </button>
                  <span className="auto-refresh-tag">
                    <i className="fa-solid fa-clock-rotate-left"></i> 5m Periodic
                  </span>
                </div>
              </div>

              <div className="drawer-torrent-list">
                {(!seedrQueue || seedrQueue.length === 0) ? (
                  <div className="drawer-empty-state">
                    <i className="fa-solid fa-bolt"></i>
                    <p>No Seedr downloads in queue</p>
                    <span className="empty-subtext">Click "Add to Seedr" in any search result to download via high-speed cloud seedbox.</span>
                  </div>
                ) : (
                  seedrQueue.map((item) => {
                    const statusInfo = getSeedrStatusLabel(item.status, item.progress, item.error);
                    const isActive = ['queued', 'started', 'downloading_seedr', 'downloading_local'].includes(item.status);
                    const isDownloading = ['downloading_seedr', 'downloading_local'].includes(item.status);
                    const pct = item.progress || 0;
                    const speedStr = item.speed ? formatSpeed(item.speed) : '';

                    return (
                      <div key={item.id} className={`transfer-card seedr-card ${item.status}`}>
                        <div className="seedr-card-header">
                          <div className="transfer-title" title={item.title}>
                            {item.title}
                          </div>
                          {isActive && (
                            <button
                              type="button"
                              className="btn-card-cancel"
                              onClick={() => onCancelSeedr(item.id)}
                              title="Cancel Seedr Download"
                            >
                              <i className="fa-solid fa-xmark"></i>
                            </button>
                          )}
                        </div>

                        {/* Progress bar for active downloads */}
                        {isActive && (
                          <div className="progress-bar-container">
                            <div
                              className={`progress-bar-fill ${item.status === 'downloading_local' ? 'seedr-local-fill' : 'seedr-cloud-fill'}`}
                              style={{ width: `${pct}%` }}
                            ></div>
                          </div>
                        )}

                        <div className="transfer-stats">
                          <span>
                            {formatBytes(item.size)}
                            {speedStr ? ` • ${speedStr}` : ''}
                          </span>
                          <span className={`state-tag ${statusInfo.className}`}>
                            <i className={`fa-solid ${statusInfo.icon}`}></i> {statusInfo.text}
                          </span>
                        </div>

                        <div className="transfer-path">
                          <i className="fa-solid fa-folder"></i> {item.savePath || '/downloads'}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
