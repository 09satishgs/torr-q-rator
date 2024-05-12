const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const apiRoutes = require('./routes/api');

const app = express();

// Request logging middleware for container log visibility
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

// Start Express server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(` TorrentQrator Web UI & REST API is running`);
  console.log(` Endpoint: http://localhost:${PORT}`);
  console.log(` Static Path: ${staticPath}`);
  console.log(` Prowlarr Base: ${config.prowlarr.baseUrl}`);
  console.log(` qBittorrent Base: ${config.qbittorrent.baseUrl}`);
  console.log(` Default Download Dir: ${config.defaultDownloadDir}`);
  console.log(`===================================================`);
});
