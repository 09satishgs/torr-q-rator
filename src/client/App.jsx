import React, { useState, useEffect, useCallback } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import Header from "./components/Header";
import DiscoverySection from "./components/DiscoverySection";
import WatchlistBar from "./components/WatchlistBar";
import SearchSection from "./components/SearchSection";
import MetricsBar from "./components/MetricsBar";
import ResultsSection from "./components/ResultsSection";
import DownloadModal from "./components/DownloadModal";
import TransfersDrawer from "./components/TransfersDrawer";
import TextSelectTooltip from "./components/TextSelectTooltip";
import Toast from "./components/Toast";
import { logger } from "./services/logger";
import {
  searchTorrents,
  fetchDirectories,
  addDownload,
  fetchTorrentsList,
  checkVpnStatus,
  fetchWatchlist,
  addWatchlistItem,
  removeWatchlistItem,
  setBackendDebug,
} from "./services/api";

export default function App() {
  const navigate = useNavigate();

  // Debug Mode State
  const [isDebug, setIsDebug] = useState(() => logger.isDebugEnabled());

  // Multi-Source MDH Persisted State with Isolated Per-Source Objects
  const [mdhState, setMdhState] = useState({
    activeSource: "tmdb", // 'tmdb' | 'anime' | 'omdb'
    sources: {
      tmdb: {
        query: "",
        language: "te",
        year: "",
        sort: "popularity.desc",
        page: 1,
        totalPages: 1,
        results: [],
        loading: false,
        initialLoaded: false,
      },
      anime: {
        query: "",
        genre: "",
        format: "ALL",
        sort: "POPULARITY_DESC",
        page: 1,
        totalPages: 1,
        results: [],
        loading: false,
        initialLoaded: false,
      },
      omdb: {
        query: "2024",
        type: "all",
        year: "",
        page: 1,
        totalPages: 1,
        results: [],
        loading: false,
        initialLoaded: false,
      },
    },
  });

  // UTS Persisted State across routes
  const [utsState, setUtsState] = useState({
    query: "",
    results: [],
    loading: false,
    hasSearched: false,
    viewMode: "table",
    sortBy: "seeders-desc",
  });

  const [directories, setDirectories] = useState([]);
  const [defaultDir, setDefaultDir] = useState("/downloads");
  const [selectedTorrent, setSelectedTorrent] = useState(null);

  const [watchlist, setWatchlist] = useState([]);
  const [torrents, setTorrents] = useState([]);
  const [vpnStatus, setVpnStatus] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const handleToggleDebug = async () => {
    const nextState = !isDebug;
    setIsDebug(nextState);
    logger.setDebugMode(nextState);
    await setBackendDebug(nextState);
    addToast(
      nextState
        ? "Debug Mode ENABLED: Detailed logs active in Console & Terminal"
        : "Debug Mode DISABLED",
      nextState ? "success" : "info"
    );
  };

  const updateMdhState = (sourceOrKey, partial) => {
    if (sourceOrKey === "ACTIVE_SOURCE") {
      setMdhState((prev) => ({ ...prev, activeSource: partial }));
      return;
    }

    setMdhState((prev) => ({
      ...prev,
      sources: {
        ...prev.sources,
        [sourceOrKey]: {
          ...prev.sources[sourceOrKey],
          ...partial,
        },
      },
    }));
  };

  const updateUtsState = (partial) => {
    setUtsState((prev) => ({ ...prev, ...partial }));
  };

  const loadTorrentsAndVpn = useCallback(async () => {
    try {
      const torrentsData = await fetchTorrentsList();
      if (torrentsData && Array.isArray(torrentsData.torrents)) {
        setTorrents(torrentsData.torrents);
      }
    } catch (err) {
      logger.warn("App:Poll", `Failed to poll torrent list: ${err.message}`);
    }

    try {
      const vpnData = await checkVpnStatus();
      setVpnStatus(vpnData);
    } catch (err) {
      logger.warn("App:Poll", `Failed to check VPN status: ${err.message}`);
    }
  }, []);

  const loadWatchlistData = useCallback(async () => {
    try {
      const data = await fetchWatchlist();
      if (data && Array.isArray(data.watchlist)) {
        setWatchlist(data.watchlist);
      }
    } catch (err) {
      logger.warn("App:Watchlist", `Failed to load watchlist: ${err.message}`);
    }
  }, []);

  useEffect(() => {
    fetchDirectories()
      .then((data) => {
        if (data && Array.isArray(data.directories)) {
          setDirectories(data.directories);
          if (data.defaultDir) setDefaultDir(data.defaultDir);
        }
      })
      .catch((err) => logger.warn("App:Dirs", `Failed to load directories: ${err.message}`));

    loadTorrentsAndVpn();
    loadWatchlistData();

    const interval = setInterval(loadTorrentsAndVpn, 3000);
    return () => clearInterval(interval);
  }, [loadTorrentsAndVpn, loadWatchlistData]);

  /**
   * Execute Torrent Search and Navigate to /search HashRoute
   */
  const handleSearch = async (query) => {
    if (!query) return;

    navigate("/search");
    updateUtsState({ query, loading: true, hasSearched: true });

    try {
      const data = await searchTorrents(query, 30);
      if (data && Array.isArray(data.results)) {
        updateUtsState({ results: data.results, loading: false });
        if (data.results.length === 0) {
          addToast(`No torrent releases found for "${query}"`, "info");
        } else {
          addToast(
            `Found ${data.results.length} release(s) for "${query}"`,
            "info"
          );
        }
      } else {
        updateUtsState({ results: [], loading: false });
      }
    } catch (err) {
      logger.error("App:Search", `Search error: ${err.message}`);
      addToast(err.message || "Error performing torrent search", "error");
      updateUtsState({ results: [], loading: false });
    }
  };

  const getSortedResults = () => {
    return [...utsState.results].sort((a, b) => {
      if (utsState.sortBy === "seeders-desc") return b.seeders - a.seeders;
      if (utsState.sortBy === "size-desc") return b.size - a.size;
      if (utsState.sortBy === "size-asc") return a.size - b.size;
      if (utsState.sortBy === "title-asc")
        return a.title.localeCompare(b.title);
      return 0;
    });
  };

  const handleAddToWishlist = async (itemData) => {
    const title =
      typeof itemData === "string" ? itemData : itemData.title || itemData.name;
    if (!title) return;

    addToast(
      `Adding "${title}" to Wishlist & pre-fetching top 3 torrents...`,
      "info"
    );

    try {
      const payload =
        typeof itemData === "string" ? { title: itemData } : itemData;
      const resp = await addWatchlistItem(payload);
      if (resp && resp.item) {
        addToast(`"${title}" saved! Top 3 torrents pre-fetched.`, "success");
        loadWatchlistData();
      }
    } catch (err) {
      addToast(err.message || "Failed to add item to Wishlist", "error");
    }
  };

  const handleRemoveFromWishlist = async (id) => {
    try {
      await removeWatchlistItem(id);
      addToast("Item removed from Wishlist", "info");
      loadWatchlistData();
    } catch (err) {
      addToast(err.message || "Failed to remove item", "error");
    }
  };

  const handleSelectDownload = (torrent) => {
    setSelectedTorrent(torrent);
  };

  const handleConfirmDownload = async (torrent, savePath) => {
    const source =
      torrent.magnetUrl ||
      torrent.downloadUrl ||
      (typeof torrent.id === "string" && torrent.id.startsWith("magnet:")
        ? torrent.id
        : null);

    if (!source) {
      addToast(
        "No valid magnet link or download URL for this release",
        "error"
      );
      return;
    }

    try {
      const result = await addDownload(source, savePath, torrent, torrent.indexer);
      if (result && result.ok) {
        addToast(`Torrent queued to ${savePath}`, "success");
        setSelectedTorrent(null);
        loadTorrentsAndVpn();
        setIsDrawerOpen(true);
      } else {
        addToast(result.error || "Failed to start torrent download", "error");
      }
    } catch (err) {
      logger.error("App:Download", `Download trigger error: ${err.message}`);
      addToast(err.message || "Error queuing torrent download", "error");
    }
  };

  return (
    <>
      <Header
        vpnStatus={vpnStatus}
        activeCount={torrents.length}
        onToggleDrawer={() => setIsDrawerOpen(true)}
        isDebug={isDebug}
        onToggleDebug={handleToggleDebug}
      />

      <main className="app-main">
        <div className="container">
          <Routes>
            {/* Route 1: Media Discovery Hub (MDH) - Default Home Page at /#/ */}
            <Route
              path="/"
              element={
                <>
                  <DiscoverySection
                    mdhState={mdhState}
                    onMdhStateChange={updateMdhState}
                    onSearchTorrent={handleSearch}
                    onAddToWishlist={handleAddToWishlist}
                    addToast={addToast}
                  />

                  <WatchlistBar
                    watchlist={watchlist}
                    onSearchTitle={handleSearch}
                    onSelectDownload={handleSelectDownload}
                    onRemoveItem={handleRemoveFromWishlist}
                  />
                </>
              }
            />

            {/* Route 2: Unified Torrent Search (UTS) Page at /#/search */}
            <Route
              path="/search"
              element={
                <>
                  <WatchlistBar
                    watchlist={watchlist}
                    onSearchTitle={handleSearch}
                    onSelectDownload={handleSelectDownload}
                    onRemoveItem={handleRemoveFromWishlist}
                  />

                  <SearchSection
                    initialQuery={utsState.query}
                    onSearch={handleSearch}
                    sortBy={utsState.sortBy}
                    onSortChange={(newSort) =>
                      updateUtsState({ sortBy: newSort })
                    }
                  />

                  <MetricsBar torrents={torrents} vpnStatus={vpnStatus} />

                  <ResultsSection
                    results={getSortedResults()}
                    loading={utsState.loading}
                    viewMode={utsState.viewMode}
                    onViewModeChange={(newMode) =>
                      updateUtsState({ viewMode: newMode })
                    }
                    onSelectDownload={handleSelectDownload}
                    hasSearched={utsState.hasSearched}
                  />
                </>
              }
            />
          </Routes>
        </div>
      </main>

      <DownloadModal
        torrent={selectedTorrent}
        directories={directories}
        defaultDir={defaultDir}
        onClose={() => setSelectedTorrent(null)}
        onConfirm={handleConfirmDownload}
      />

      <TransfersDrawer
        isOpen={isDrawerOpen}
        torrents={torrents}
        onClose={() => setIsDrawerOpen(false)}
      />

      <TextSelectTooltip onSaveText={handleAddToWishlist} />

      <Toast toasts={toasts} />
    </>
  );
}
