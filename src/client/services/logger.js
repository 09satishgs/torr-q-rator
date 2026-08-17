/**
 * Flexible & Generic Frontend Logger for TorrQrator
 */

const STORAGE_KEY = 'torrqrator_debug_mode';

class FrontendLogger {
  constructor() {
    this.debugEnabled = localStorage.getItem(STORAGE_KEY) === 'true';
  }

  /**
   * Toggle debug mode on/off
   * @param {boolean} enabled
   */
  setDebugMode(enabled) {
    this.debugEnabled = !!enabled;
    localStorage.setItem(STORAGE_KEY, this.debugEnabled ? 'true' : 'false');
    console.log(
      `%c[TorrQrator:Logger] Debug mode ${this.debugEnabled ? 'ENABLED' : 'DISABLED'}`,
      'color: #e50914; font-weight: bold; font-size: 13px;'
    );
  }

  /**
   * Check if debug logging is enabled
   */
  isDebugEnabled() {
    return this.debugEnabled;
  }

  getTimestamp() {
    return new Date().toTimeString().split(' ')[0] + '.' + String(new Date().getMilliseconds()).padStart(3, '0');
  }

  debug(tag, message, payload) {
    if (!this.debugEnabled) return;
    const time = this.getTimestamp();
    console.groupCollapsed(
      `%c[${time}] %c[DEBUG] %c[${tag}] %c${message}`,
      'color: #888; font-size: 10px;',
      'background: #8c070d; color: #fff; border-radius: 3px; padding: 1px 4px; font-weight: bold;',
      'color: #00d2ff; font-weight: bold;',
      'color: inherit;'
    );
    if (payload !== undefined) {
      console.log('Payload/Data:', payload);
    }
    console.groupEnd();
  }

  info(tag, message, payload) {
    const time = this.getTimestamp();
    if (this.debugEnabled) {
      console.groupCollapsed(
        `%c[${time}] %c[INFO]  %c[${tag}] %c${message}`,
        'color: #888; font-size: 10px;',
        'background: #005f73; color: #fff; border-radius: 3px; padding: 1px 4px; font-weight: bold;',
        'color: #2ecc71; font-weight: bold;',
        'color: inherit;'
      );
      if (payload !== undefined) {
        console.log('Details:', payload);
      }
      console.groupEnd();
    } else {
      console.log(`%c[${tag}]%c ${message}`, 'color: #2ecc71; font-weight: bold;', 'color: inherit;');
    }
  }

  warn(tag, message, payload) {
    const time = this.getTimestamp();
    console.warn(
      `%c[${time}] [WARN] [${tag}] ${message}`,
      'color: #e67e22; font-weight: bold;',
      payload !== undefined ? payload : ''
    );
  }

  error(tag, message, payload) {
    const time = this.getTimestamp();
    console.error(
      `%c[${time}] [ERROR] [${tag}] ${message}`,
      'color: #e50914; font-weight: bold;',
      payload !== undefined ? payload : ''
    );
  }
}

export const logger = new FrontendLogger();
export default logger;
