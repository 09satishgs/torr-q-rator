const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const config = require('./config');
const apiRoutes = require('./routes/api');
const seedrService = require('./services/seedr');

const app = express();

// Start Seedr background worker
seedrService.worker.start();

// Request logging middleware for request visibility
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[API] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Determine static build path (dist from Webpack or fallback public)
const distPath = path.join(__dirname, '../dist');
const staticPath = fs.existsSync(distPath) ? distPath : path.join(__dirname, '../public');
app.use(express.static(staticPath));

// Mount API endpoints
app.use('/api', apiRoutes);

// SPA Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[TorrentQrator Server Error]', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

// Helper to get local network IPv4 addresses
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({ name, address: iface.address });
      }
    }
  }
  return ips;
}

// Start Express server
const PORT = config.port;
const HOST = config.host || '0.0.0.0';

app.listen(PORT, HOST, () => {
  const localIps = getLocalIpAddresses();
  console.log(`================================================================`);
  console.log(` ⚡ TorrQrator Standalone Server is RUNNING`);
  console.log(` ----------------------------------------------------------------`);
  console.log(` Local:            http://localhost:${PORT}`);
  localIps.forEach(ip => {
    console.log(` Network (LAN):    http://${ip.address}:${PORT} (${ip.name})`);
  });
  console.log(` ----------------------------------------------------------------`);
  console.log(` Prowlarr API:     ${config.prowlarr.baseUrl}`);
  console.log(` qBittorrent Web:  ${config.qbittorrent.baseUrl}`);
  console.log(` FlareSolverr:     ${config.flaresolverr.baseUrl} (enabled: ${config.flaresolverr.enabled})`);
  console.log(` Download Folder:  ${config.defaultDownloadDir}`);
  console.log(`================================================================`);
});
