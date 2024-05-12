import React, { useState, useEffect } from 'react';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function DownloadModal({ torrent, directories, defaultDir, onClose, onConfirm }) {
  const [customPath, setCustomPath] = useState(defaultDir || '/downloads');

  useEffect(() => {
    if (defaultDir) {
      setCustomPath(defaultDir);
    }
  }, [defaultDir]);

  if (!torrent) return null;

  const handlePresetChange = (e) => {
    setCustomPath(e.target.value);
  };

  const handleConfirm = () => {
    onConfirm(torrent, customPath.trim());
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <i className="fa-solid fa-folder-arrow-down"></i>
            <h3>Download Location</h3>
          </div>
          <button type="button" className="btn-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="modal-body">
          <div className="target-torrent-info">
            <span className="info-label">Selected Torrent:</span>
            <p className="target-title">{torrent.title}</p>
            <span className="target-size">{formatBytes(torrent.size)}</span>
          </div>

          <div className="form-group">
            <label htmlFor="presetDirSelect">Recommended Folders:</label>
            <select
              id="presetDirSelect"
              className="custom-select"
              value={customPath}
              onChange={handlePresetChange}
            >
              {directories.map((dir, idx) => (
                <option key={idx} value={dir.path}>
                  {dir.label} ({dir.path})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="customPathInput">Destination Directory Path:</label>
            <div className="input-with-icon">
              <i className="fa-solid fa-folder-open"></i>
              <input
                type="text"
                id="customPathInput"
                className="custom-input"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
              />
            </div>
            <span className="form-hint">Host directory mapped to container storage path</span>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleConfirm}>
            <i className="fa-solid fa-download"></i> Start Download
          </button>
        </div>
      </div>
    </div>
  );
}
