const fs = require('fs');
const path = require('path');
const axios = require('axios');
const logger = require('../../utils/logger');

class SeedrDownloader {
  /**
   * Download a single file from direct HTTPS URL to local path
   * @param {string} url Direct Seedr CDN download URL
   * @param {string} destinationDir Local destination directory
   * @param {string} fileName Target file name
   * @param {Function} onProgress Progress callback ({ percent, downloadedBytes, totalBytes, speed })
   * @param {Object} abortController Optional AbortController
   */
  async downloadFile(url, destinationDir, fileName, onProgress = null, abortController = null) {
    if (!fs.existsSync(destinationDir)) {
      fs.mkdirSync(destinationDir, { recursive: true });
    }

    // Sanitize filename for local OS (strip illegal characters like : / \ * ? " < > |)
    const sanitizedFileName = fileName.replace(/[<>:"/\\|?*]/g, '_').trim() || `download_${Date.now()}`;
    const targetFilePath = path.join(destinationDir, sanitizedFileName);
    const tempFilePath = `${targetFilePath}.part`;

    logger.info('SeedrDownloader', `Starting direct HTTPS stream download: "${sanitizedFileName}" -> ${destinationDir}`);

    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 60000,
      signal: abortController ? abortController.signal : undefined,
    });

    const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
    let downloadedBytes = 0;
    let lastBytes = 0;
    let lastTime = Date.now();
    let currentSpeed = 0;

    const writer = fs.createWriteStream(tempFilePath);

    return new Promise((resolve, reject) => {
      // Speed and progress calculation ticker
      const progressInterval = setInterval(() => {
        const now = Date.now();
        const timeDiff = (now - lastTime) / 1000;
        if (timeDiff >= 1) {
          const bytesDiff = downloadedBytes - lastBytes;
          currentSpeed = Math.round(bytesDiff / timeDiff);
          lastBytes = downloadedBytes;
          lastTime = now;

          const percent = totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
          if (typeof onProgress === 'function') {
            onProgress({
              percent,
              downloadedBytes,
              totalBytes,
              speed: currentSpeed,
            });
          }
        }
      }, 1000);

      response.data.on('data', (chunk) => {
        downloadedBytes += chunk.length;
      });

      response.data.pipe(writer);

      writer.on('finish', () => {
        clearInterval(progressInterval);
        try {
          if (fs.existsSync(tempFilePath)) {
            // If target file already exists, overwrite
            if (fs.existsSync(targetFilePath)) {
              fs.unlinkSync(targetFilePath);
            }
            fs.renameSync(tempFilePath, targetFilePath);
          }
          logger.info('SeedrDownloader', `Download completed successfully: "${sanitizedFileName}" (${downloadedBytes} bytes)`);
          
          if (typeof onProgress === 'function') {
            onProgress({
              percent: 100,
              downloadedBytes: downloadedBytes,
              totalBytes: downloadedBytes,
              speed: 0,
            });
          }

          resolve({
            ok: true,
            filePath: targetFilePath,
            fileName: sanitizedFileName,
            bytesDownloaded: downloadedBytes,
          });
        } catch (renameErr) {
          logger.error('SeedrDownloader', `Failed to finalize file: ${renameErr.message}`);
          reject(renameErr);
        }
      });

      writer.on('error', (err) => {
        clearInterval(progressInterval);
        logger.error('SeedrDownloader', `File writer error: ${err.message}`);
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        } catch (_) {}
        reject(err);
      });

      response.data.on('error', (err) => {
        clearInterval(progressInterval);
        logger.error('SeedrDownloader', `Stream error: ${err.message}`);
        try {
          writer.close();
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        } catch (_) {}
        reject(err);
      });
    });
  }
}

module.exports = new SeedrDownloader();
