/**
 * Flexible & Generic Logging System for TorrQrator Backend
 */

class Logger {
  constructor() {
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };

    // Default level: debug if process.env.DEBUG is set or LOG_LEVEL=debug
    const envLevel = (process.env.LOG_LEVEL || (process.env.DEBUG === 'true' ? 'debug' : 'info')).toLowerCase();
    this.currentLevel = this.levels[envLevel] !== undefined ? this.levels[envLevel] : this.levels.info;
    this.debugEnabled = this.currentLevel === this.levels.debug;
  }

  /**
   * Dynamically toggle debug mode
   * @param {boolean} enabled
   */
  setDebug(enabled) {
    this.debugEnabled = !!enabled;
    this.currentLevel = this.debugEnabled ? this.levels.debug : this.levels.info;
    console.log(`[Logger] Backend Debug Mode set to: ${this.debugEnabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Check if debug logging is enabled
   */
  isDebugEnabled() {
    return this.debugEnabled;
  }

  /**
   * Format timestamp
   */
  getTimestamp() {
    return new Date().toISOString().replace('T', ' ').substring(0, 23);
  }

  /**
   * Safely sanitize and truncate payloads for logging
   */
  formatPayload(payload) {
    if (payload === undefined || payload === null) return '';
    if (typeof payload === 'string') {
      if (payload.length > 500) {
        return `${payload.substring(0, 500)}... (truncated ${payload.length - 500} chars)`;
      }
      return payload;
    }
    if (Buffer.isBuffer(payload)) {
      return `<Buffer ${payload.length} bytes>`;
    }
    try {
      const seen = new WeakSet();
      const str = JSON.stringify(payload, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        if (typeof value === 'string' && value.length > 300) {
          return `${value.substring(0, 300)}...`;
        }
        return value;
      }, 2);
      return str;
    } catch (e) {
      return `[Unserializable Object: ${e.message}]`;
    }
  }

  debug(tag, message, payload) {
    if (this.currentLevel <= this.levels.debug) {
      const payloadStr = payload !== undefined ? `\nPayload: ${this.formatPayload(payload)}` : '';
      console.log(`\x1b[35m[${this.getTimestamp()}] [DEBUG] [${tag}]\x1b[0m ${message}${payloadStr}`);
    }
  }

  info(tag, message, payload) {
    if (this.currentLevel <= this.levels.info) {
      const payloadStr = payload !== undefined ? `\nPayload: ${this.formatPayload(payload)}` : '';
      console.log(`\x1b[36m[${this.getTimestamp()}] [INFO]  [${tag}]\x1b[0m ${message}${payloadStr}`);
    }
  }

  warn(tag, message, payload) {
    if (this.currentLevel <= this.levels.warn) {
      const payloadStr = payload !== undefined ? `\nPayload: ${this.formatPayload(payload)}` : '';
      console.warn(`\x1b[33m[${this.getTimestamp()}] [WARN]  [${tag}]\x1b[0m ${message}${payloadStr}`);
    }
  }

  error(tag, message, payload) {
    if (this.currentLevel <= this.levels.error) {
      const payloadStr = payload !== undefined ? `\nPayload: ${this.formatPayload(payload)}` : '';
      console.error(`\x1b[31m[${this.getTimestamp()}] [ERROR] [${tag}]\x1b[0m ${message}${payloadStr}`);
    }
  }
}

module.exports = new Logger();
