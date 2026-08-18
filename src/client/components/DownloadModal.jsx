import React, { useState, useEffect } from 'react';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Smart Path Combiner
 * Combines basePath and dynamic subfolder cleanly across POSIX and Windows formats
 */
export function resolveCombinedPath(basePath, subPath) {
  if (!basePath && !subPath) return '';
  if (!basePath) return (subPath || '').trim();
  if (!subPath || subPath.trim() === '' || subPath.trim() === '/' || subPath.trim() === '\\') {
    return basePath.trim();
  }

  const trimmedSub = subPath.trim();
  // If user entered an absolute Windows drive path (e.g. D:\Anime or C:/Anime)
  if (/^[a-zA-Z]:[/\\]/.test(trimmedSub)) {
    return trimmedSub;
  }

  const isWindows = basePath.includes('\\');
  const separator = isWindows ? '\\' : '/';

  // Strip trailing slashes from base unless it's root '/' or 'C:\'
  let cleanBase = basePath.trim();
  if (cleanBase.length > 3 && (cleanBase.endsWith('/') || cleanBase.endsWith('\\'))) {
    cleanBase = cleanBase.replace(/[/\\]+$/, '');
  }

  // Strip leading and trailing slashes from subfolder
  let cleanSub = trimmedSub.replace(/^[/\\]+/, '').replace(/[/\\]+$/, '');

  // Normalize internal slashes to match the base format
  if (isWindows) {
    cleanSub = cleanSub.replace(/\//g, '\\');
  } else {
    cleanSub = cleanSub.replace(/\\/g, '/');
  }

  if (!cleanSub) return cleanBase;

  if (cleanBase.endsWith('/') || cleanBase.endsWith('\\')) {
    return `${cleanBase}${cleanSub}`;
  }

  return `${cleanBase}${separator}${cleanSub}`;
}

const QUICK_SUBFOLDER_SUGGESTIONS = [
  'Anime',
  'Telugu',
  'Hindi',
  'Tamil',
  'Documentaries',
  '4K Remux',
  'Korean Drama',
  'Animation',
  'Classics',
];

export default function DownloadModal({ torrent, directories = [], defaultDir = '/downloads', onClose, onConfirm }) {
  const [selectedBase, setSelectedBase] = useState(defaultDir);
  const [subFolder, setSubFolder] = useState('');
  const [customPath, setCustomPath] = useState(defaultDir);
  const [isManualOverride, setIsManualOverride] = useState(false);

  useEffect(() => {
    if (defaultDir) {
      setSelectedBase(defaultDir);
      setCustomPath(defaultDir);
    }
  }, [defaultDir]);

  // Recalculate combined path whenever base or subfolder changes (unless in manual override mode)
  useEffect(() => {
    if (!isManualOverride) {
      const combined = resolveCombinedPath(selectedBase, subFolder);
      setCustomPath(combined);
    }
  }, [selectedBase, subFolder, isManualOverride]);

  if (!torrent) return null;

  const handleBaseChange = (e) => {
    const newBase = e.target.value;
    setSelectedBase(newBase);
    setIsManualOverride(false);
  };

  const handleSubFolderChange = (e) => {
    setSubFolder(e.target.value);
    setIsManualOverride(false);
  };

  const handleApplyChip = (chipText) => {
    setSubFolder(chipText);
    setIsManualOverride(false);
  };

  const handleCustomPathChange = (e) => {
    setCustomPath(e.target.value);
    setIsManualOverride(true);
  };

  const handleConfirm = () => {
    const finalPath = customPath.trim() || defaultDir;
    onConfirm(torrent, finalPath);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <i className="fa-solid fa-folder-arrow-down"></i>
            <h3>Download Location</h3>
          </div>
          <button type="button" className="btn-close" onClick={onClose} title="Close">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="modal-body">
          {/* Torrent summary banner */}
          <div className="target-torrent-info">
            <div className="info-header">
              <span className="info-label">Selected Torrent</span>
              {torrent.indexer && <span className="indexer-badge-mini">{torrent.indexer}</span>}
            </div>
            <p className="target-title">{torrent.title}</p>
            <span className="target-size">{formatBytes(torrent.size)}</span>
          </div>

          {/* 1. Base Folder Selection */}
          <div className="form-group">
            <label htmlFor="presetDirSelect">
              <i className="fa-solid fa-server"></i> Base Directory:
            </label>
            <select
              id="presetDirSelect"
              className="custom-select"
              value={selectedBase}
              onChange={handleBaseChange}
            >
              {directories.map((dir, idx) => (
                <option key={idx} value={dir.path}>
                  {dir.label} ({dir.path})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Dynamic Nested Subfolder Input */}
          <div className="form-group">
            <div className="label-with-hint">
              <label htmlFor="subFolderInput">
                <i className="fa-solid fa-folder-tree"></i> Nested Subfolder (Optional):
              </label>
              <span className="hint-pill">Dynamic</span>
            </div>
            <div className="input-with-icon">
              <i className="fa-solid fa-folder-plus"></i>
              <input
                type="text"
                id="subFolderInput"
                className="custom-input"
                placeholder="e.g. /Anime or Anime/2026 or Telugu/Movies"
                value={subFolder}
                onChange={handleSubFolderChange}
              />
            </div>
            
            {/* Quick-select chips */}
            <div className="folder-chips-container">
              <span className="chips-label">Quick Subfolders:</span>
              <div className="folder-chips">
                {QUICK_SUBFOLDER_SUGGESTIONS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`folder-chip ${subFolder === tag || subFolder === `/${tag}` ? 'active' : ''}`}
                    onClick={() => handleApplyChip(tag)}
                  >
                    +{tag}
                  </button>
                ))}
                {subFolder && (
                  <button
                    type="button"
                    className="folder-chip chip-clear"
                    onClick={() => setSubFolder('')}
                    title="Clear Subfolder"
                  >
                    <i className="fa-solid fa-xmark"></i> Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 3. Real-time Final Destination Preview & Manual Override Field */}
          <div className="form-group destination-preview-group">
            <div className="label-with-action">
              <label htmlFor="customPathInput">
                <i className="fa-solid fa-hard-drive"></i> Final Destination Path:
              </label>
              <button
                type="button"
                className="btn-text-toggle"
                onClick={() => setIsManualOverride(!isManualOverride)}
                title="Toggle manual path override"
              >
                <i className="fa-solid fa-pen-to-square"></i> {isManualOverride ? 'Auto Sync' : 'Direct Edit'}
              </button>
            </div>
            <div className="input-with-icon">
              <i className="fa-solid fa-folder-open destination-icon"></i>
              <input
                type="text"
                id="customPathInput"
                className={`custom-input destination-input ${isManualOverride ? 'override-active' : ''}`}
                value={customPath}
                onChange={handleCustomPathChange}
              />
            </div>
            <span className="form-hint">
              {isManualOverride
                ? 'Manual override active: Exact path sent to qBittorrent.'
                : 'Auto-composed from Base Directory + Subfolder.'}
            </span>
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
