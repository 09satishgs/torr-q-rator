const dotenv = require('dotenv');
const os = require('os');
const path = require('path');

// Load environment variables from .env file
dotenv.config();

// Determine default download directory based on OS for standalone mode
const getDefaultDownloadDir = () => {
  if (process.env.DEFAULT_DOWNLOAD_DIR) {
    return process.env.DEFAULT_DOWNLOAD_DIR;
  }
  const homeDir = os.homedir();
  return path.join(homeDir, 'Downloads');
};

const config = {
  host: process.env.HOST || '0.0.0.0',
  port: parseInt(process.env.PORT || '3000', 10),
  prowlarr: {
    baseUrl: (process.env.PROWLARR_BASE_URL || 'http://localhost:9696').replace(/\/+$/, ''),
    apiKey: process.env.PROWLARR_API_KEY || '',
  },
  qbittorrent: {
    baseUrl: (process.env.QBITTORRENT_BASE_URL || 'http://localhost:8080').replace(/\/+$/, ''),
    username: process.env.QBITTORRENT_USERNAME || 'admin',
    password: process.env.QBITTORRENT_PASSWORD || 'adminadmin',
  },
  flaresolverr: {
    baseUrl: (process.env.FLARESOLVERR_BASE_URL || 'http://localhost:8191').replace(/\/+$/, ''),
    enabled: process.env.FLARESOLVERR_ENABLED === 'true' || process.env.FLARESOLVERR_ENABLED === undefined,
    timeout: parseInt(process.env.FLARESOLVERR_TIMEOUT || '60000', 10),
  },
  vpn: {
    country: process.env.SURFSHARK_COUNTRY || 'Netherlands',
    addresses: process.env.SURFSHARK_WIREGUARD_ADDRESSES || '',
    interfaceName: process.env.VPN_INTERFACE_NAME || 'SurfsharkWireGuard',
  },
  seedr: {
    username: process.env.SEEDR_USERNAME || '',
    password: process.env.SEEDR_PASSWORD || '',
    token: process.env.SEEDR_TOKEN || '',
    maxSizeBytes: parseInt(process.env.SEEDR_MAX_SIZE_BYTES || String(5 * 1024 * 1024 * 1024), 10), // 5GB free tier limit
    checkIntervalMs: parseInt(process.env.SEEDR_CHECK_INTERVAL_MS || String(5 * 60 * 1000), 10), // 5 minutes
  },
  defaultDownloadDir: getDefaultDownloadDir(),
};

module.exports = config;
