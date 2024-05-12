# How to Run TorrentQrator: Step-by-Step Guide

This guide provides complete, step-by-step instructions to set up, configure, and run **TorrentQrator** from scratch, including how to install Docker, configure Surfshark VPN (via Gluetun), set up Prowlarr indexers, and launch the application.

---

## Table of Contents
1. [Prerequisites & System Requirements](#1-prerequisites--system-requirements)
2. [Step 1: Installing Docker Desktop](#step-1-installing-docker-desktop)
   - [Windows Setup](#windows-setup)
   - [macOS Setup](#macos-setup)
   - [Linux Setup](#linux-setup)
3. [Step 2: Environment Configuration (`.env`)](#step-2-environment-configuration-env)
   - [Retrieving Surfshark WireGuard Credentials](#retrieving-surfshark-wireguard-credentials)
4. [Step 3: Launching the App with Docker Compose](#step-3-launching-the-app-with-docker-compose)
5. [Step 4: Initial Service Setup (Prowlarr & qBittorrent)](#step-4-initial-service-setup-prowlarr--qbittorrent)
6. [Step 5: Accessing the TorrentQrator Dashboard](#step-5-accessing-the-torrentqrator-dashboard)
7. [Running in Standalone Development Mode (Without Docker)](#running-in-standalone-development-mode-without-docker)
8. [Troubleshooting & FAQs](#troubleshooting--faqs)

---

## 1. Prerequisites & System Requirements

- **Operating System**: Windows 10/11 (64-bit), macOS 11+, or 64-bit Linux distribution.
- **Hardware**: Minimum 4 GB RAM (8 GB recommended), 10 GB free disk space for downloads and container storage.
- **VPN Account (Optional but recommended for full VPN protection)**: Surfshark subscription for WireGuard VPN tunneling.

---

## Step 1: Installing Docker Desktop

Docker runs all 4 containerized services (`app`, `gluetun` VPN, `qbittorrent`, `prowlarr`) in isolated environments.

### Windows Setup
1. **Download Docker Desktop**:
   - Download the installer from the official page: [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/).
2. **Install**:
   - Double-click `Docker Desktop Installer.exe`.
   - Ensure the option **"Use WSL 2 instead of Hyper-V"** is selected during installation.
   - Click **Ok** and wait for installation to complete, then restart your PC if prompted.
3. **Start Docker Desktop**:
   - Launch "Docker Desktop" from the Start Menu.
   - Wait until the bottom-left icon turns **Green** (indicating Docker Engine is running).

### macOS Setup
1. **Download Docker Desktop**:
   - Visit [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/).
   - Choose **Apple Silicon (M1/M2/M3/M4)** or **Intel Chip** depending on your Mac hardware.
2. **Install**:
   - Open the `.dmg` installer file and drag the `Docker` icon into your `Applications` folder.
3. **Start Docker**:
   - Open `Applications` -> `Docker`. Click **Open** when prompted by macOS security.

### Linux Setup (Ubuntu / Debian)
Open a terminal and execute:
```bash
# Download and execute official Docker setup script
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (avoids needing sudo for docker commands)
sudo usermod -aG docker $USER

# Log out and log back in for group changes to take effect
newgrp docker
```

---

## Step 2: Environment Configuration (`.env`)

Before starting TorrentQrator, you need to set up your environment variables file.

1. Open a terminal or command prompt in the project directory (`torrentqrator/`).
2. Create a copy of `.env.example` named `.env`:

   **On Windows (PowerShell):**
   ```powershell
   Copy-Item .env.example .env
   ```

   **On Mac / Linux:**
   ```bash
   cp .env.example .env
   ```

3. Open `.env` in any text editor (VS Code, Notepad, Nano, etc.).

### Retrieving Surfshark WireGuard Credentials

Gluetun connects directly to Surfshark using WireGuard. Here is how to obtain your private key:

1. Log into your [Surfshark Account Dashboard](https://my.surfshark.com/).
2. Navigate to **VPN** -> **Manual Setup** -> **Router** or **WireGuard**.
3. Click **I don't have a keypair** (or generate a new key pair).
4. Copy the generated **Private Key** and your assigned **IP Address** (e.g. `10.14.0.2/32`).
5. Update your `.env` file with these values:

```env
# Port where TorrentQrator Web UI runs
PORT=3000

# User / Group permissions for download storage
PUID=1000
PGID=1000
TZ=Asia/Kolkata

# Surfshark VPN Credentials for Gluetun
SURFSHARK_WIREGUARD_PRIVATE_KEY=your_copied_wireguard_private_key_here
SURFSHARK_WIREGUARD_ADDRESSES=10.14.0.2/32
SURFSHARK_COUNTRY=Netherlands

# Prowlarr & qBittorrent Internal URLs
PROWLARR_BASE_URL=http://prowlarr:9696
PROWLARR_API_KEY=your_prowlarr_api_key_here

QBITTORRENT_BASE_URL=http://gluetun:8080
QBITTORRENT_USERNAME=admin
QBITTORRENT_PASSWORD=adminadmin

DEFAULT_DOWNLOAD_DIR=/downloads
```

---

## Step 3: Launching the App with Docker Compose

1. Open your terminal in the `torrentqrator` root directory.
2. Build and start all 4 services in background (detached) mode:
   ```bash
   docker compose up --build -d
   ```
3. Check the status of your running containers:
   ```bash
   docker compose ps
   ```
   You should see 4 containers in `running` status:
   - `torrentqrator-gluetun`
   - `torrentqrator-qbittorrent`
   - `torrentqrator-prowlarr`
   - `torrentqrator-app`

4. (Optional) Inspect real-time logs to ensure VPN tunnel connection:
   ```bash
   docker compose logs -f gluetun
   ```
   Look for: `[wireguard] You are connected to Netherlands #...`

---

## Step 4: Initial Service Setup (Prowlarr & qBittorrent)

### 1. Configure Prowlarr Indexers
1. Open your browser and navigate to **`http://localhost:9696`**.
2. Go to **Settings** -> **General** -> Copy your **API Key**.
3. Paste this key into your `.env` file under `PROWLARR_API_KEY=...` and restart the app container:
   ```bash
   docker compose restart app
   ```
4. In Prowlarr, go to **Indexers** -> Click **+ Add Indexer**.
5. Search and add public indexers (e.g. 1337x, YTS, EZTV, RARBG mirrors, etc.).

### 2. Verify & Configure qBittorrent Password
- qBittorrent Web UI runs inside the Gluetun container network on port **8080** (`http://localhost:8080`).
- Modern qBittorrent containers generate a temporary random admin password on initial boot.
- Find your temporary password by running:
  ```bash
  docker compose logs qbittorrent | grep "A temporary password"
  ```
- Open `http://localhost:8080` in your browser, log in with username `admin` and the temporary password, go to **Tools** -> **Options** -> **Web UI**, and change the password to `adminadmin` (or update `QBITTORRENT_PASSWORD` in `.env` to match your chosen password).
- Restart the app container to re-authenticate:
  ```bash
  docker compose restart app
  ```

---

## Step 5: Accessing the TorrentQrator Dashboard

Once all containers are running and indexers are configured in Prowlarr:

1. Open your web browser to: **`http://localhost:3000`**
2. You will be greeted by the TorrentQrator Web UI:
   - **Header VPN Protection Badge**: Displays real-time green shield badge ("Protected via Surfshark").
   - **Search Bar**: Type any release name (e.g., `Ubuntu 24.04`, `Debian`, `Blender`) and press **Search**.
   - **Download Button**: Click **Download** on any result to pick a destination host directory (`/downloads/Movies`, `/downloads/TV`, `/downloads/ISOs`, etc.).
   - **Active Downloads Drawer**: Click the download icon top-right to view live transfer progress (0-100%), download speed (MB/s), and ETA updated every 3 seconds.

---

## Running in Standalone Development Mode (Without Docker)

If you wish to run TorrentQrator locally for frontend/backend testing without Docker:

1. **Install Node.js**:
   - Download Node.js v20 LTS from [nodejs.org](https://nodejs.org/).
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Build Production Webpack Bundle**:
   ```bash
   npm run build
   ```
4. **Start the Express Server**:
   ```bash
   npm start
   ```
5. **(Optional) Run Webpack DevServer for Frontend HMR**:
   ```bash
   npm run dev:client
   ```
   - Webpack DevServer runs at `http://localhost:8080` with hot module replacement and proxies `/api` calls directly to `http://localhost:3000`.

---

## Troubleshooting & FAQs

### Q1: The VPN Badge says "Disconnected" or Gluetun container fails to start.
- **Cause**: Invalid WireGuard private key or address format.
- **Fix**: Check `docker compose logs gluetun`. Ensure `SURFSHARK_WIREGUARD_PRIVATE_KEY` and `SURFSHARK_WIREGUARD_ADDRESSES` in `.env` match your Surfshark account credentials.

### Q2: Port 3000, 8080, or 9696 is already in use.
- **Fix**: Change `PORT=3000` in `.env` to another available port (e.g. `PORT=3001`), or stop existing applications occupying those ports.

### Q3: Where are my downloaded files stored on my computer?
- Downloads are saved in the `./downloads` directory inside the project root folder. Any files downloaded to `/downloads/...` inside containers are persisted here on your host PC.

### Q4: How do I stop the app?
- Run `docker compose down` in your project folder to safely shut down all containers.

### Q5: VPN log shows `Public IP address is ...` but fails DNS lookup or healthcheck timeouts.
- **Cause**: Gluetun's default DNS-over-TLS (`DOT=on`) queries port 853, which is often blocked or throttled by local ISPs or firewalls.
- **Fix**: We have configured `DOT=off`, `DNS_PLAINTEXT_ADDRESS=1.1.1.1`, and `DNS_UPDATE_PERIOD=0` in `docker-compose.yml`. Restart Gluetun using `docker compose up -d gluetun`.

