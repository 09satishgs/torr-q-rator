const fs = require('fs');
const path = require('path');
const config = require('../../config');
const logger = require('../../utils/logger');

const DATA_DIR = path.join(__dirname, '../../../data');
const SEEDR_QUEUE_FILE = path.join(DATA_DIR, 'seedr_queue.json');
const MAX_SLIDING_WINDOW_SIZE = 100;

class SeedrQueue {
  constructor() {
    this.ensureDirectory();
  }

  ensureDirectory() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (!fs.existsSync(SEEDR_QUEUE_FILE)) {
        fs.writeFileSync(SEEDR_QUEUE_FILE, JSON.stringify([], null, 2));
      }
    } catch (err) {
      logger.error('SeedrQueue', `Failed to initialize data directory or file: ${err.message}`);
    }
  }

  /**
   * Get complete queue array from JSON file
   */
  getQueue() {
    try {
      this.ensureDirectory();
      const raw = fs.readFileSync(SEEDR_QUEUE_FILE, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      logger.error('SeedrQueue', `Error reading seedr queue file: ${err.message}`);
      return [];
    }
  }

  /**
   * Persist queue array to JSON file
   */
  saveQueue(list) {
    try {
      this.ensureDirectory();
      fs.writeFileSync(SEEDR_QUEUE_FILE, JSON.stringify(list, null, 2));
    } catch (err) {
      logger.error('SeedrQueue', `Error writing seedr queue file: ${err.message}`);
    }
  }

  /**
   * Add a new torrent download task to Seedr queue
   * @param {Object} torrent Torrent metadata object { title, size, magnetUrl, downloadUrl, indexer, ... }
   * @param {string} savePath Target local destination directory path
   */
  addItem(torrent, savePath) {
    if (!torrent || typeof torrent !== 'object') {
      throw new Error('Valid torrent object required');
    }

    if (!savePath || typeof savePath !== 'string') {
      throw new Error('Valid savePath string required');
    }

    // Enforce 5GB maximum size limit for free tier
    const maxSize = config.seedr.maxSizeBytes || 5 * 1024 * 1024 * 1024;
    const torrentSize = torrent.size || 0;
    if (torrentSize > maxSize) {
      const sizeGB = (torrentSize / (1024 * 1024 * 1024)).toFixed(2);
      const maxGB = (maxSize / (1024 * 1024 * 1024)).toFixed(1);
      throw new Error(`Torrent size (${sizeGB} GB) exceeds Seedr limit (${maxGB} GB). Please use qBittorrent for files > ${maxGB} GB.`);
    }

    const list = this.getQueue();

    const newItem = {
      id: `seedr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: torrent.title || 'Untitled Torrent',
      size: torrent.size || 0,
      indexer: torrent.indexer || 'Unknown',
      magnetUrl: torrent.magnetUrl || '',
      downloadUrl: torrent.downloadUrl || '',
      savePath: savePath,
      status: 'queued', // 'queued' | 'started' | 'downloading_seedr' | 'downloading_local' | 'completed' | 'failed' | 'cancelled'
      progress: 0,
      speed: 0,
      seedrTorrentId: null,
      seedrFolderId: null,
      seedrFileId: null,
      error: null,
      addedAt: Date.now(),
      startedAt: null,
      completedAt: null,
      updatedAt: Date.now(),
    };

    list.push(newItem);
    this.saveQueue(list);
    this.pruneCompleted(MAX_SLIDING_WINDOW_SIZE);

    logger.info('SeedrQueue', `Added task "${newItem.title}" to Seedr Queue (ID: ${newItem.id})`);
    return newItem;
  }

  /**
   * Find item by ID
   */
  getItem(id) {
    const list = this.getQueue();
    return list.find(item => item.id === id) || null;
  }

  /**
   * Update item fields
   */
  updateItem(id, updates) {
    const list = this.getQueue();
    const idx = list.findIndex(item => item.id === id);
    if (idx === -1) return null;

    list[idx] = {
      ...list[idx],
      ...updates,
      updatedAt: Date.now(),
    };

    this.saveQueue(list);
    return list[idx];
  }

  /**
   * Mark item as cancelled
   */
  cancelItem(id, reason = 'Cancelled by user') {
    return this.updateItem(id, {
      status: 'cancelled',
      error: reason,
      completedAt: Date.now(),
    });
  }

  /**
   * Get currently active item in Seedr (if any)
   */
  getActiveItem() {
    const list = this.getQueue();
    return list.find(item => ['started', 'downloading_seedr', 'downloading_local'].includes(item.status)) || null;
  }

  /**
   * Get next queued item waiting for processing
   */
  getNextQueuedItem() {
    const list = this.getQueue();
    return list.find(item => item.status === 'queued') || null;
  }

  /**
   * Prune history to enforce sliding window size (default: 100)
   * Active items are NEVER pruned.
   */
  pruneCompleted(windowSize = MAX_SLIDING_WINDOW_SIZE) {
    const list = this.getQueue();
    const activeItems = list.filter(item => ['queued', 'started', 'downloading_seedr', 'downloading_local'].includes(item.status));
    const finishedItems = list.filter(item => ['completed', 'failed', 'cancelled'].includes(item.status));

    // Sort finished items descending by completedAt or addedAt
    finishedItems.sort((a, b) => (b.completedAt || b.addedAt || 0) - (a.completedAt || a.addedAt || 0));

    // Slice to window size
    const prunedFinished = finishedItems.slice(0, windowSize);
    const updatedList = [...activeItems, ...prunedFinished];

    if (updatedList.length !== list.length) {
      logger.info('SeedrQueue', `Pruned history queue via sliding window (${list.length} -> ${updatedList.length} items)`);
      this.saveQueue(updatedList);
    }
  }

  /**
   * Clear all completed and cancelled items manually
   */
  clearCompleted() {
    const list = this.getQueue();
    const activeItems = list.filter(item => ['queued', 'started', 'downloading_seedr', 'downloading_local'].includes(item.status));
    this.saveQueue(activeItems);
    logger.info('SeedrQueue', `Cleared completed/cancelled tasks from Seedr queue`);
    return activeItems;
  }
}

module.exports = new SeedrQueue();
