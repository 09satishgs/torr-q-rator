import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Header({ vpnStatus, activeCount, onToggleDrawer }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isConnected = vpnStatus && vpnStatus.vpnConnected;

  const currentPath = location.pathname;

  return (
    <header className="app-header">
      <div className="header-container">
        <div className="brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <div className="logo-icon">
            <i className="fa-solid fa-magnet"></i>
          </div>
          <div className="brand-text">
            <h1>Torrent<span className="highlight">Qrator</span></h1>
          </div>
          <span className="version-tag">v1.0 Pro</span>
        </div>

        {/* Navigation Route Tabs via React Router HashRouter */}
        <nav className="header-nav">
          <button
            type="button"
            className={`nav-link ${currentPath === '/' || currentPath === '' ? 'active' : ''}`}
            onClick={() => navigate('/')}
          >
            <i className="fa-solid fa-house"></i>
            <span>Discovery Hub</span>
          </button>
          <button
            type="button"
            className={`nav-link ${currentPath === '/search' ? 'active' : ''}`}
            onClick={() => navigate('/search')}
            title="Unified Torrent Search"
          >
            <i className="fa-solid fa-magnifying-glass"></i>
            <span>Torrent Search</span>
          </button>
        </nav>

        <div className="header-actions">
          <div className={`vpn-badge ${isConnected ? '' : 'disconnected'}`}>
            {isConnected && <span className="pulse-dot green"></span>}
            <i className={isConnected ? "fa-solid fa-shield-halved" : "fa-solid fa-shield-cat"}></i>
            <span className="vpn-text">
              {isConnected
                ? `Protected via ${vpnStatus.provider} (${vpnStatus.country})`
                : 'VPN Warning / Standalone'}
            </span>
          </div>

          <button className="btn btn-icon" onClick={onToggleDrawer} title="Active Downloads">
            <i className="fa-solid fa-download"></i>
            <span className="badge-count">{activeCount}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
