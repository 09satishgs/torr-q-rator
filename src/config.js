const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  prowlarr: {
    baseUrl: (process.env.PROWLARR_BASE_URL || 'http://prowlarr:9696').replace(/\/+$/, ''),
    apiKey: process.env.PROWLARR_API_KEY || '',
  },
  qbittorrent: {
    baseUrl: (process.env.QBITTORRENT_BASE_URL || 'http://gluetun:8080').replace(/\/+$/, ''),
    username: process.env.QBITTORRENT_USERNAME || 'admin',
    password: process.env.QBITTORRENT_PASSWORD || 'adminadmin',
  },
  vpn: {
    country: process.env.SURFSHARK_COUNTRY || 'Netherlands',
    addresses: process.env.SURFSHARK_WIREGUARD_ADDRESSES || '',
  },
  defaultDownloadDir: process.env.DEFAULT_DOWNLOAD_DIR || '/downloads',
};

module.exports = config;
