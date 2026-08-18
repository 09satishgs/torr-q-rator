const seedrClient = require('./seedrClient');
const seedrQueue = require('./seedrQueue');
const seedrDownloader = require('./seedrDownloader');
const seedrWorker = require('./seedrWorker');

module.exports = {
  client: seedrClient,
  queue: seedrQueue,
  downloader: seedrDownloader,
  worker: seedrWorker,
};
