# TorrentQrator: Project Specification & Development Prompt

> **Instructions**: Use the detailed prompt below to build **TorrentQrator** from scratch as a brand-new application.

---

```markdown
# SYSTEM PROMPT: Build TorrentQrator from Scratch

## 1. Project Overview & Objective
Build **TorrentQrator**, a modern, standalone Web-based Torrent Search Engine & Download Manager. 

The application provides a unified web interface to search public torrent indexers via **Prowlarr**, download torrents directly into user-specified host directories via **qBittorrent**, monitor live download progress, and protect all torrent traffic through **Surfshark VPN** via a **Gluetun** container gateway with an automatic kill-switch.

---

## 2. Technology Stack & Infrastructure

* **Backend**: Node.js, Express.js, Axios, `dotenv`
* **Frontend**: HTML5, Vanilla CSS3 (Dark Mode, Glassmorphism, Responsive Grid), Vanilla JavaScript (ES6 Fetch API)
* **Services & Containers (Docker Compose)**:
  1. `gluetun` (`qmcgaw/gluetun`): VPN gateway configured for Surfshark WireGuard with automatic kill-switch firewall.
  2. `qbittorrent` (`lscr.io/linuxserver/qbittorrent`): Torrent download client routed strictly through `gluetun` network (`network_mode: "service:gluetun"`).
  3. `prowlarr` (`lscr.io/linuxserver/prowlarr`): Torrent indexer API aggregator.
  4. `app` (Custom Node.js container): Serves the Web UI dashboard and REST API.

---

## 3. Project File Directory Structure

```
torrentqrator/
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── package.json
├── src/
│   ├── index.js               # Express server entry point
│   ├── config.js              # Environment variable loader & validator
│   ├── routes/
│   │   └── api.js             # REST API routes (/api/search, /api/download, /api/torrents, /api/vpn)
│   └── services/
│       ├── prowlarr.js        # Prowlarr API v1 integration (Search & Health)
│       └── qbittorrent.js     # qBittorrent API v2 integration (Auth, Add Torrent, Status)
└── public/
    ├── index.html             # Web UI Dashboard HTML shell
    ├── style.css              # Dark mode styling system & animations
    └── app.js                 # Dynamic UI logic, search rendering, download modals & status polling
```

---

## 4. Detailed Component Specifications

### A. Environment Configuration (`.env.example`)
Define the following environment variables:
```env
# Application Port
PORT=3000

# Container User/Group & Timezone
PUID=1000
PGID=1000
TZ=Asia/Kolkata

# Surfshark VPN Credentials (Gluetun)
SURFSHARK_WIREGUARD_PRIVATE_KEY=your_surfshark_wireguard_private_key
SURFSHARK_WIREGUARD_ADDRESSES=10.14.0.2/32
SURFSHARK_COUNTRY=Netherlands

# Prowlarr Integration
PROWLARR_BASE_URL=http://prowlarr:9696
PROWLARR_API_KEY=your_prowlarr_api_key

# qBittorrent Integration
QBITTORRENT_BASE_URL=http://gluetun:8080
QBITTORRENT_USERNAME=admin
QBITTORRENT_PASSWORD=adminadmin

# Default Download Directory inside containers
DEFAULT_DOWNLOAD_DIR=/downloads
```

---

### B. Container Topology (`docker-compose.yml`)
Create a Docker Compose configuration establishing the following network dependencies:

1. **`gluetun` Service**:
   - Image: `qmcgaw/gluetun:latest`
   - Capability: `cap_add: [NET_ADMIN]`
   - Environment: Configured for `surfshark` provider and `wireguard` VPN type using environment variables.
   - Ports Exposed: `"8080:8080"` (for qBittorrent Web UI), `"6881:6881"`, `"6881:6881/udp"`.

2. **`qbittorrent` Service**:
   - Image: `lscr.io/linuxserver/qbittorrent:latest`
   - **Crucial Security Requirement**: `network_mode: "service:gluetun"`.
   - Volumes: Mount `./data/qbittorrent:/config` and `./downloads:/downloads`.

3. **`prowlarr` Service**:
   - Image: `lscr.io/linuxserver/prowlarr:latest`
   - Ports Exposed: `"9696:9696"`
   - Volumes: Mount `./data/prowlarr:/config`.

4. **`app` Service**:
   - Build: Current directory (`.`)
   - Ports Exposed: `"3000:3000"`
   - Environment: Points to `PROWLARR_BASE_URL` and `QBITTORRENT_BASE_URL`.

---

### C. Backend API Service Layer (`src/services/`)

#### 1. Prowlarr Integration (`src/services/prowlarr.js`)
* `search(query, limit = 20)`: Calls `GET {PROWLARR_BASE_URL}/api/v1/search` with `X-Api-Key` header.
* Normalizes response objects to extract: `id`, `title`, `size`, `seeders`, `leechers`, `indexer`, `magnetUrl`, `downloadUrl`.

#### 2. qBittorrent Integration (`src/services/qbittorrent.js`)
* `authenticate()`: Sends POST to `{QBITTORRENT_BASE_URL}/api/v2/auth/login` using `username` and `password`. Extracts and returns `SID` session cookie.
* `addTorrent(sourceUrl, savePath)`: Sends POST to `{QBITTORRENT_BASE_URL}/api/v2/torrents/add` with `urls` and `savepath`.
* `getTorrentList()`: Sends GET to `{QBITTORRENT_BASE_URL}/api/v2/torrents/info` to fetch active downloads, returning array of objects containing `hash`, `name`, `progress`, `dlspeed`, `eta`, `state`, and `save_path`.

---

### D. Express REST API Routes (`src/routes/api.js`)

1. **`GET /api/search?q=query&limit=20`**:
   - Calls `prowlarr.search()`.
   - Returns `{ results: [...] }`.

2. **`POST /api/download`**:
   - Accepts body `{ source: "magnet:...", savePath: "/downloads/Movies" }`.
   - Calls `qbittorrent.addTorrent()`.
   - Returns `{ ok: true, message: "Torrent added successfully" }`.

3. **`GET /api/torrents`**:
   - Calls `qbittorrent.getTorrentList()`.
   - Returns `{ torrents: [...] }`.

4. **`GET /api/vpn/status`**:
   - Verifies Gluetun VPN health and returns `{ vpnConnected: true, provider: "Surfshark" }`.

5. **`GET /api/directories`**:
   - Returns default directory suggestions (e.g. `/downloads`, `/downloads/Movies`, `/downloads/TV`, `/downloads/Music`).

---

### E. Frontend Web Interface (`public/`)

Create a responsive, single-page application with modern styling (Dark theme, cyan/emerald accents, glassmorphism cards):

1. **Header Section**:
   - App title ("TorrentQrator").
   - Real-time **VPN Protection Badge** (Green "Protected via Surfshark" indicator).

2. **Search Control Section**:
   - Large search bar input + "Search" button.
   - Filter controls: Sort by Seeders, Size, or Indexer.

3. **Search Results Table / Card Grid**:
   - Display torrent title, size (human readable formatting B, KB, MB, GB), seeders/leechers count badge, indexer name.
   - Action Button: **"Download"** button per result.

4. **Target Folder Modal**:
   - When "Download" is clicked on a result, open a modal allowing the user to select from common subfolders (`/downloads/Movies`, `/downloads/TV`, `/downloads/Music`) or type a custom subfolder path.
   - Confirming sends POST to `/api/download`.

5. **Active Downloads Monitor Drawer / Tab**:
   - Polls `/api/torrents` every 3 seconds.
   - Displays animated progress bar (`0%` to `100%`), download speed (`MB/s`), ETA, state, and target destination directory.

---

## 5. Development Steps & Verification

1. **Initialize Project**: Create `package.json` with dependencies `express`, `axios`, `dotenv`.
2. **Build Backend Services**: Implement `config.js`, `prowlarr.js`, `qbittorrent.js`, and `api.js`.
3. **Build Frontend Interface**: Create `public/index.html`, `public/style.css`, and `public/app.js`.
4. **Deploy Stack**: Launch with `docker compose up --build`.
5. **Verify**:
   - Access Web UI at `http://localhost:3000`.
   - Execute a search, confirm Prowlarr returns indexer results.
   - Download a torrent into a specific directory and verify qBittorrent processes the request through the VPN tunnel.
```
