# How to Run TorrentQrator WITHOUT Docker

This guide explains step-by-step how to set up and run **TorrentQrator** natively on your computer using desktop applications for **qBittorrent**, **Prowlarr**, and **Surfshark VPN**, without using Docker or Docker Compose.

---

## Table of Contents
1. [System Prerequisites](#1-system-prerequisites)
2. [Step 1: Install & Configure qBittorrent Desktop App](#step-1-install--configure-qbittorrent-desktop-app)
3. [Step 2: Install & Configure Prowlarr Desktop App](#step-2-install--configure-prowlarr-desktop-app)
4. [Step 3: Configure Surfshark VPN Desktop App](#step-3-configure-surfshark-vpn-desktop-app)
5. [Step 4: Configure TorrentQrator Environment (`.env`)](#step-4-configure-torrentqrator-environment-env)
6. [Step 5: Install Dependencies, Build & Run TorrentQrator](#step-5-install-dependencies-build--run-torrentqrator)
7. [Step 6: Verifying Full Local Workflow](#step-6-verifying-full-local-workflow)
8. [Troubleshooting & Common Issues](#troubleshooting--common-issues)

---

## 1. System Prerequisites

- **Node.js**: Version 20.x LTS or higher ([Download Node.js](https://nodejs.org/)).
- **Git** (optional): For version control.
- **Web Browser**: Chrome, Edge, Firefox, or Safari.

---

## Step 1: Install & Configure qBittorrent Desktop App

qBittorrent is the torrent download manager client. TorrentQrator communicates with it via its Web UI API.

### 1. Download & Install qBittorrent
- Download the installer for your OS from the official page: [qBittorrent Downloads](https://www.qbittorrent.org/download).
- Install qBittorrent using default installation settings.

### 2. Enable Web UI API
1. Launch the **qBittorrent** application.
2. Open Settings:
   - **Windows/Linux**: Go to **Tools** -> **Options** (or press `Ctrl+O`).
   - **macOS**: Go to **qBittorrent** -> **Preferences** (or press `Cmd+,`).
3. Click on the **Web UI** tab on the left menu.
4. Check the box **"Web User Interface (Remote control)"**.
5. Configure the Web UI parameters:
   - **IP address**: Leave default `*` or enter `127.0.0.1`.
   - **Port**: Set to `8080` (or `8085` if port 8080 is used by another service).
6. Under **Authentication**:
   - **Username**: Set to `admin` (or your preferred username).
   - **Password**: Set to `adminadmin` (or your preferred password).
7. Scroll down to **Bypass authentication for clients on localhost**:
   - (Optional) Check **"Bypass authentication for clients on localhost"** to simplify local development API access.
8. Click **Apply** and **OK** to save settings.

### 3. Configure Default Save Directory
1. In qBittorrent Options, click on the **Downloads** tab.
2. Under **Saving Management** -> **Default Save Path**, specify your target download folder:
   - **Windows**: e.g., `C:\downloads` or `C:\Users\YourName\Downloads`
   - **macOS/Linux**: e.g., `/Users/YourName/Downloads` or `/home/yourname/downloads`
3. Click **Apply** and **OK**.

---

## Step 2: Install & Configure Prowlarr Desktop App

Prowlarr is the indexer aggregator that searches public torrent sites.

### 1. Download & Install Prowlarr
- Download Prowlarr for Windows/macOS/Linux from [prowlarr.com](https://prowlarr.com/).
- Follow the installer instructions and launch Prowlarr.

### 2. Retrieve Prowlarr API Key
1. Open your browser to **`http://localhost:9696`**.
2. Go to **Settings** -> **General** tab.
3. Under **Security**, locate **API Key**.
4. Copy the **API Key** (you will paste this into `.env`).

### 3. Add Torrent Indexers
1. In Prowlarr, click **Indexers** in the left sidebar menu.
2. Click **+ Add Indexer**.
3. Search and add popular public indexers (e.g. 1337x, YTS, EZTV, LimeTorrents, RARBG mirrors).
4. Click **Save** for each indexer.

---

## Step 3: Configure Surfshark VPN Desktop App

To protect all torrent traffic without Docker:

1. Launch your **Surfshark VPN** desktop application.
2. Connect to your desired location (e.g. Netherlands).
3. Open Surfshark **Settings** -> **VPN Settings**:
   - Enable **Kill Switch** (blocks all internet traffic if VPN drops).
   - Ensure protocol is set to **WireGuard** or **Auto**.

---

## Step 4: Configure TorrentQrator Environment (`.env`)

1. Open your terminal in the `torrentqrator` root directory.
2. Create or update your `.env` file with native local service URLs:

```env
# Application Port
PORT=3000

# Native Prowlarr Service URL (running locally on port 9696)
PROWLARR_BASE_URL=http://localhost:9696
PROWLARR_API_KEY=your_prowlarr_api_key_copied_from_step_2

# Native qBittorrent Desktop Web UI URL (running locally on port 8080)
QBITTORRENT_BASE_URL=http://localhost:8080
QBITTORRENT_USERNAME=admin
QBITTORRENT_PASSWORD=adminadmin

# Default Target Download Directory on your computer
DEFAULT_DOWNLOAD_DIR=C:/downloads
```

*(Replace `C:/downloads` with your actual local download folder path. Use forward slashes `/` for cross-platform compatibility).*

---

## Step 5: Install Dependencies, Build & Run TorrentQrator

### 1. Install Node.js Dependencies
In your terminal, run:
```bash
npm install
```

### 2. Build Production Webpack 5 Bundle
Compile the React 18 frontend into static assets:
```bash
npm run build
```

### 3. Start the TorrentQrator Server
Launch the Express backend server:
```bash
npm start
```
Output:
```text
===================================================
 TorrentQrator Web UI & REST API is running
 Endpoint: http://localhost:3000
 Static Path: .../dist
 Prowlarr Base: http://localhost:9696
 qBittorrent Base: http://localhost:8080
 Default Download Dir: C:/downloads
===================================================
```

### 4. (Optional) Run Webpack DevServer for Hot Reloading
If you are developing frontend components and want Hot Module Replacement (HMR):
```bash
npm run dev:client
```
- Webpack DevServer runs on **`http://localhost:8080`** and proxies `/api` requests to **`http://localhost:3000`**.

---

## Step 6: Verifying Full Local Workflow

1. Open **`http://localhost:3000`** in your browser.
2. **Execute a Search**: Type `Ubuntu` or `Debian` in the search bar and press **Search**.
   - TorrentQrator queries your native Prowlarr desktop instance (`http://localhost:9696`).
3. **Trigger Download**: Click **Download** on any result.
4. **Choose Location**: Select or enter your local destination directory (e.g. `C:/downloads/Movies`) and click **Start Download**.
   - TorrentQrator sends the `.torrent` file directly into your native qBittorrent desktop app (`http://localhost:8080`).
5. **Monitor Transfers**: Click the top-right download icon to open the **Active Transfers** drawer and watch progress bars update in real time.
6. Check your native **qBittorrent desktop window**—the torrent will appear in the transfers list!

---

## Troubleshooting & Common Issues

### Issue 1: `qBittorrent Auth Error: Invalid username or password`
- **Cause**: The `QBITTORRENT_USERNAME` or `QBITTORRENT_PASSWORD` in `.env` does not match your qBittorrent desktop app settings.
- **Fix**: Open qBittorrent -> **Tools** -> **Options** -> **Web UI** tab, re-enter your password, click **Apply**, and restart TorrentQrator (`npm start`).

### Issue 2: `Failed to fetch torrent list from qBittorrent (econrefused)`
- **Cause**: qBittorrent desktop app is not running or Web UI is disabled.
- **Fix**: Ensure qBittorrent desktop application is launched and Web UI is checked under Options -> Web UI.

### Issue 3: `Prowlarr search failed (econrefused)`
- **Cause**: Prowlarr desktop service is not running.
- **Fix**: Launch Prowlarr app and verify you can open `http://localhost:9696` in your browser. Ensure `PROWLARR_API_KEY` in `.env` matches Settings -> General -> API Key.

### Issue 4: Port 8080 Collision (qBittorrent Web UI vs Webpack DevServer)
- **Cause**: Both qBittorrent Web UI and Webpack DevServer attempt to use port `8080`.
- **Fix**: In qBittorrent options, change Web UI port to `8085` and update `.env` to `QBITTORRENT_BASE_URL=http://localhost:8085`.
