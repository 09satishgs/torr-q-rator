# 🚀 TorrQrator Standalone & High-Speed Setup Guide

This guide details how to run **TorrQrator** as an ultra-fast, standalone application (`npm start`) on your Mini PC, host it across your local network (LAN), isolate **Surfshark VPN** strictly to torrent traffic, and integrate **FlareSolverr** to bypass Cloudflare-protected indexers.

---

## 📋 Table of Contents
1. [Environment Configuration (.env)](#1-environment-configuration-env)
2. [qBittorrent Desktop Setup & Max Speed Settings](#2-qbittorrent-desktop-setup--max-speed-settings)
3. [Surfshark VPN Isolation & Kill Switch Binding](#3-surfshark-vpn-isolation--kill-switch-binding)
4. [Prowlarr Desktop Configuration](#4-prowlarr-desktop-configuration)
5. [FlareSolverr Standalone Setup (Cloudflare Bypass)](#5-flaresolverr-standalone-setup-cloudflare-bypass)
6. [Hosting TorrQrator Over Your Local Network (LAN)](#6-hosting-torrqrator-over-your-local-network-lan)
7. [Running on Boot (Mini PC)](#7-running-on-boot-mini-pc)

---

## 1. Environment Configuration (.env)

Update your `.env` file in the root of the project with the following standalone values:

```ini
# Server configuration
PORT=3000
HOST=0.0.0.0

# Desktop qBittorrent Web UI
# Enable in qBittorrent: Tools -> Options -> Web UI
QBITTORRENT_BASE_URL=http://localhost:8080
QBITTORRENT_USERNAME=admin
QBITTORRENT_PASSWORD=your_qbittorrent_password

# Desktop Prowlarr
# Found in Prowlarr: Settings -> General -> Security -> API Key
PROWLARR_BASE_URL=http://localhost:9696
PROWLARR_API_KEY=your_prowlarr_api_key_here

# FlareSolverr (Cloudflare Challenge Solver)
FLARESOLVERR_BASE_URL=http://localhost:8191
FLARESOLVERR_ENABLED=true
FLARESOLVERR_TIMEOUT=60000

# Download Directory (Leave blank for default ~/Downloads or specify custom path)
# Windows: C:\Downloads or D:\Torrents
# Linux: /home/youruser/Downloads
DEFAULT_DOWNLOAD_DIR=

# Media Discovery (Optional)
TMDB_API_KEY=your_tmdb_key_if_any
OMDB_API_KEY=your_omdb_key_if_any
```

---

## 2. qBittorrent Desktop Setup & Max Speed Settings

To achieve full line-speed downloads (100Mbps - 1Gbps+) without Docker/Gluetun NAT bottlenecks:

### A. Enable Web UI
1. Open **qBittorrent** -> Go to **Tools** -> **Options** -> **Web UI**.
2. Check **"Web User Interface (Remote control)"**.
3. Set **IP Address**: `0.0.0.0` or `127.0.0.1` and **Port**: `8080`.
4. Set your **Username** and **Password** (matches `.env`).
5. **CRITICAL for LAN access**:
   - Uncheck **"Enable Cross-Site Request Forgery (CSRF) protection"** (or add your LAN subnet e.g. `192.168.*.*` to allowed referrers).
   - Uncheck **"Enable Host header validation"**.
   - Check **"Bypass authentication for clients on localhost"** (optional for faster local node calls).

### B. Torrent Swarm & Speed Optimizations
1. Go to **Options** -> **Connection**:
   - **Peer connection protocol**: Set to **TCP and µTP** (or **TCP only** if your ISP/VPN throttles UDP packets).
   - **Global maximum number of connections**: `1000`
   - **Maximum number of connections per torrent**: `200`
   - **Global maximum number of upload slots**: `50`
   - **Maximum number of upload slots per torrent**: `10`
   - Check **"Use UPnP / NAT-PMP port forwarding from my router"**.
2. Go to **Options** -> **BitTorrent**:
   - Check **"Enable DHT (decentralized network) to find more peers"**.
   - Check **"Enable Peer Exchange (PeX) to find more peers"**.
   - Check **"Enable Local Peer Discovery to find more peers"**.
   - **Encryption mode**: Set to **"Allow encryption"** (allows connecting to both encrypted and unencrypted peers for maximum swarm size).
3. Go to **Options** -> **Advanced**:
   - **Physical memory (RAM) usage limit (Disk cache)**: Set to `512 MiB` or `1024 MiB` (reduces disk I/O bottlenecks on Mini PC SSDs).
   - **Disk write cache expiry interval**: `60s`.
   - **Asynchronous I/O threads**: Set to `4` (or number of CPU cores on your Mini PC).

---

## 3. Surfshark VPN Isolation & Kill Switch Binding

To allow TorrQrator, web browsing, Plex, and local LAN sharing to run unencumbered while forcing **100% of BitTorrent traffic through Surfshark VPN**:

### Method: qBittorrent Network Interface Binding (Recommended)
1. Connect **Surfshark VPN** on your desktop (using WireGuard protocol for maximum speeds).
2. In **qBittorrent**, go to **Tools** -> **Options** -> **Advanced**.
3. Find **"Network Interface"**:
   - Change from `Any interface` to the Surfshark Adapter:
     - On **Windows**: Select `SurfsharkWireGuard` (or `SurfsharkOpenVPN` / `WireGuard Tunnel`).
     - On **Linux**: Select `wg0` or `tun0`.
4. Find **"Optional IP address to bind to"**: Set to `All IPv4 addresses`.
5. Click **Apply** and restart qBittorrent.

> [!TIP]
> **Why this is the best solution**:
> - **Zero IP Leaks**: qBittorrent can *only* transmit over the VPN network adapter.
> - **Instant Hardware Kill Switch**: If Surfshark disconnects, qBittorrent transfers drop to 0 instantly.
> - **Total Isolation**: Your Mini PC's physical Ethernet/Wi-Fi adapter is untouched. TorrQrator server, browser, and local LAN devices communicate without VPN interference or speed loss.

---

## 4. Prowlarr Desktop Configuration

1. Download and run the **Prowlarr Desktop Installer** (runs as a service/tray app on port `9696`).
2. Open `http://localhost:9696`.
3. Go to **Settings** -> **General** -> Copy your **API Key** into `.env` (`PROWLARR_API_KEY`).
4. Add your favorite Indexers (e.g. 1337x, LimeTorrents, TorrentGalaxy, YTS, EZTV).
5. (Optional) Connect qBittorrent in **Settings** -> **Download Clients** -> Add **qBittorrent** (`http://localhost:8080`).

---

## 5. FlareSolverr Standalone Setup (Cloudflare Bypass)

FlareSolverr solves Cloudflare Anti-Bot and Turnstile challenges automatically.

### Running FlareSolverr on Windows/Linux Mini PC:
1. Download FlareSolverr pre-built binary release from [FlareSolverr GitHub Releases](https://github.com/FlareSolverr/FlareSolverr/releases).
2. Extract and run `flaresolverr.exe` (or `./flaresolverr` on Linux). It starts on port `8191`.
3. **Configure FlareSolverr in Prowlarr**:
   - In Prowlarr, go to **Settings** -> **Indexers**.
   - Under **Options**, click **+** next to **Indexer Proxies**.
   - Select **FlareSolverr**.
   - Set **Host**: `http://localhost:8191`.
   - Set **Tags**: e.g., `flaresolverr` (or apply to all indexers that trigger Cloudflare).
   - Save.

---

## 6. Hosting TorrQrator Over Your Local Network (LAN)

1. Build the production client bundle:
   ```bash
   npm run build
   ```
2. Start the TorrQrator server:
   ```bash
   npm start
   ```
3. The console will print your local network access URLs:
   ```
   ================================================================
   ⚡ TorrQrator Standalone Server is RUNNING
   ----------------------------------------------------------------
   Local:            http://localhost:3000
   Network (LAN):    http://192.168.1.150:3000 (Ethernet)
   ----------------------------------------------------------------
   ```
4. On your mobile phone, laptop, or tablet connected to the same Wi-Fi, open `http://<MINI_PC_IP>:3000`.

---

## 7. Running on Boot (Mini PC)

To keep TorrQrator running permanently in the background:

### Option A: Using PM2 (Cross-Platform)
```bash
npm install -g pm2
pm2 start src/index.js --name "torrqrator"
pm2 save
pm2 startup
```

### Option B: Windows Startup Shortcut
1. Create a file named `start-torrqrator.bat` containing:
   ```cmd
   @echo off
   cd /d "%~dp0"
   npm start
   ```
2. Press `Win + R`, type `shell:startup`, and place a shortcut to `start-torrqrator.bat` in that folder.
