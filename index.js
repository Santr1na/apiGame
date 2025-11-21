require('dotenv').config();

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const NodeCache = require('node-cache');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 3002;

// Firebase (optional - will skip if no credentials provided)
let db = null;
let firebaseEnabled = false;

try {
  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
  console.log('🔍 Firebase credentials length:', serviceAccountRaw?.length || 0);
  
  if (serviceAccountRaw) {
    const serviceAccount = JSON.parse(serviceAccountRaw);
    console.log('🔍 Firebase project_id:', serviceAccount.project_id);
    
    if (serviceAccount.project_id) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      db = admin.firestore();
      firebaseEnabled = true;
      console.log('✅ Firebase initialized successfully');
    } else {
      console.log('⚠️ Firebase credentials invalid - project_id missing');
    }
  } else {
    console.log('⚠️ FIREBASE_SERVICE_ACCOUNT environment variable not found');
  }
} catch (error) {
  console.log('⚠️ Firebase initialization failed - auth features disabled:', error.message);
  console.log('🔍 Error details:', error);
}

// Middleware
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

// Cache
const cache = new NodeCache({ stdTTL: 86400 });
const historyCache = new NodeCache({ stdTTL: 604800 });
const historyKey = 'recent_games';

// API Configuration
const RAWG_API_KEY = process.env.RAWG_API_KEY;
const GIANT_BOMB_API_KEY = process.env.GIANT_BOMB_API_KEY;
const THEGAMESDB_API_KEY = process.env.THEGAMESDB_API_KEY;
const STEAM_API_KEY = process.env.STEAM_API_KEY;

// API URLs
const rawgBaseUrl = 'https://api.rawg.io/api';
const giantBombBaseUrl = 'https://www.giantbomb.com/api';
const theGamesDbBaseUrl = 'https://api.thegamesdb.net/v1';
const steamAppsUrl = 'https://api.steampowered.com/ISteamApps/GetAppList/v2/';
const steamStoreUrl = 'https://store.steampowered.com/api/appdetails';

// Cache for Steam apps
let steamApps = null;

// Steam apps list
async function getSteamApps() {
  if (steamApps) return steamApps;
  try {
    const res = await axios.get(steamAppsUrl, { timeout: 20000 });
    steamApps = res.data.applist.apps || [];
    console.log(`Loaded ${steamApps.length} Steam apps`);
    return steamApps;
  } catch (err) {
    console.error('Steam fetch error:', err.message);
    return [];
  }
}

// Auth middleware
async function authenticate(req, res, next) {
  if (!firebaseEnabled) {
    return res.status(503).json({ error: 'Authentication service unavailable' });
  }
  
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    req.user = await admin.auth().verifyIdToken(header.split('Bearer ')[1]);
    next();
  } catch (err) {
    console.error('Auth ERROR:', err.message);
    return res.status(403).json({ error: 'Invalid token' });
  }
}

// Firestore helpers
async function loadFavoriteCounts() {
  if (!firebaseEnabled || !db) return {};
  try {
    const doc = await db.collection('counters').doc('favorites').get();
    return doc.exists ? doc.data() : {};
  } catch (e) {
    console.error('Load fav ERROR:', e);
    return {};
  }
}
async function saveFavoriteCounts(c) {
  if (!firebaseEnabled || !db) return;
  try { await db.collection('counters').doc('favorites').set(c); } catch (e) { console.error('Save fav ERROR:', e); }
}
async function loadStatusCounts() {
  if (!firebaseEnabled || !db) return {};
  try {
    const doc = await db.collection('counters').doc('statuses').get();
    return doc.exists ? doc.data() : {};
  } catch (e) {
    console.error('Load status ERROR:', e);
    return {};
  }
}
async function saveStatusCounts(c) {
  if (!firebaseEnabled || !db) return;
  try { await db.collection('counters').doc('statuses').set(c); } catch (e) { console.error('Save status ERROR:', e); }
}

// Utils
function weightedShuffle(arr, hist) {
  return arr.map(g => ({ g, w: hist.includes(g.id) ? 0.01 : 1 * (Math.random() + 1) }))
    .sort((a, b) => b.w - a.w).map(i => i.g);
}
function updateHistory(ids) {
  let h = historyCache.get(historyKey) || [];
  h = [...new Set([...ids, ...h])].slice(0, 200);
  historyCache.set(historyKey, h);
}

// Enhanced image utilities
async function getSteamCover(name, appId) {
  if (!appId) return null;
  const key = `steam_cover_${appId}`;
  if (cache.get(key)) return cache.get(key);
  
  try {
    const url = `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/library_600x900.jpg`;
    cache.set(key, url, 86400);
    return url;
  } catch (err) {
    console.error('Steam cover fetch error:', err.message);
    return null;
  }
}

async function getMultipleImageSources(game) {
  const sources = [];
  
  // Steam cover
  if (game.steam_appid) {
    const steamCover = await getSteamCover(game.name, game.steam_appid);
    if (steamCover) sources.push(steamCover);
  }
  
  // RAWG background image
  if (game.background_image) {
    sources.push(game.background_image);
  }
  
  // Giant Bomb image
  if (game.image) {
    sources.push(game.image);
  }
  
  // TheGamesDB boxart
  if (game.boxart) {
    sources.push(game.boxart);
  }
  
  return sources[0] || 'N/A';
}

// API Data Fetchers
async function fetchRawgGames(endpoint, params = {}) {
  if (!RAWG_API_KEY) throw new Error('RAWG API key not configured');
  
  try {
    const response = await axios.get(`${rawgBaseUrl}${endpoint}`, {
      params: { key: RAWG_API_KEY, ...params },
      timeout: 10000
    });
    
    // Return single game for /games/id endpoint, array for other endpoints
    if (endpoint.startsWith('/games/')) {
      return response.data;
    }
    return response.data.results || [];
  } catch (err) {
    console.error('RAWG API error:', err.message);
    return endpoint.startsWith('/games/') ? null : [];
  }
}

async function fetchGiantBombGames(endpoint, params = {}) {
  if (!GIANT_BOMB_API_KEY) throw new Error('Giant Bomb API key not configured');
  
  try {
    const response = await axios.get(`${giantBombBaseUrl}${endpoint}`, {
      params: { api_key: GIANT_BOMB_API_KEY, format: 'json', ...params },
      timeout: 10000
    });
    return response.data.results || [];
  } catch (err) {
    console.error('Giant Bomb API error:', err.message);
    return [];
  }
}

async function fetchTheGamesDbGames(endpoint, params = {}) {
  if (!THEGAMESDB_API_KEY) throw new Error('TheGamesDB API key not configured');
  
  try {
    const response = await axios.get(`${theGamesDbBaseUrl}${endpoint}`, {
      params: { apikey: THEGAMESDB_API_KEY, ...params },
      timeout: 10000
    });
    return response.data.data || [];
  } catch (err) {
    console.error('TheGamesDB API error:', err.message);
    return [];
  }
}

async function fetchSteamGameDetails(appId) {
  if (!appId) return null;
  
  try {
    const response = await axios.get(steamStoreUrl, {
      params: { appids: appId, format: 'json' },
      timeout: 10000
    });
    const data = response.data[appId];
    if (data && data.success && data.data) {
      return data.data;
    }
  } catch (err) {
    console.error('Steam Store API error:', err.message);
  }
  return null;
}

// Data Processors
async function processRawgGame(game) {
  const image = await getMultipleImageSources(game);
  
  return {
    id: `rawg_${game.id}`,
    source: 'RAWG',
    name: game.name,
    cover_image: image,
    rating: game.rating || 0,
    critic_rating: Math.round((game.rating || 0) * 20) || 'N/A',
    release_year: game.released ? new Date(game.released).getFullYear() : 'N/A',
    main_genre: game.genres?.[0]?.name || 'N/A',
    platforms: game.platforms ? game.platforms.map(p => p.platform.name) : [],
    description: game.description_raw || 'N/A'
  };
}

async function processGiantBombGame(game) {
  const platforms = game.platforms ? game.platforms.map(p => p.name) : [];
  
  return {
    id: `giantbomb_${game.id}`,
    source: 'GiantBomb',
    name: game.name,
    cover_image: game.image?.original || 'N/A',
    rating: game.score || 0,
    critic_rating: game.score || 'N/A',
    release_year: game.original_release_date ? new Date(game.original_release_date).getFullYear() : 'N/A',
    main_genre: game.genres?.[0]?.name || 'N/A',
    platforms: platforms,
    description: game.deck || 'N/A'
  };
}

async function processTheGamesDbGame(game) {
  return {
    id: `tgdb_${game.id}`,
    source: 'TheGamesDB',
    name: game.game_title,
    cover_image: game.boxart || 'N/A',
    rating: 0,
    critic_rating: 'N/A',
    release_year: game.release_date ? new Date(game.release_date).getFullYear() : 'N/A',
    main_genre: game.genres?.[0] || 'N/A',
    platforms: game.platform ? [game.platform] : [],
    description: game.overview || 'N/A'
  };
}

async function processSteamGame(game) {
  const steamDetails = await fetchSteamGameDetails(game.appid);
  
  return {
    id: `steam_${game.appid}`,
    source: 'Steam',
    name: game.name,
    cover_image: await getSteamCover(game.name, game.appid),
    rating: 0,
    critic_rating: steamDetails?.metacritic?.score || 'N/A',
    release_year: steamDetails?.release_date?.date ? new Date(steamDetails.release_date.date).getFullYear() : 'N/A',
    main_genre: steamDetails?.genres?.[0]?.description || 'N/A',
    platforms: ['PC'],
    description: steamDetails?.short_description || 'N/A',
    steam_appid: game.appid
  };
}

async function processDetailedGame(gameData) {
  const favs = await loadFavoriteCounts();
  const stats = await loadStatusCounts();
  const st = stats[gameData.id] || {};
  
  return {
    ...gameData,
    favorite: favs[gameData.id] || 0,
    playing: st.playing || 0,
    ill_play: st.ill_play || 0,
    passed: st.passed || 0,
    postponed: st.postponed || 0,
    abandoned: st.abandoned || 0,
    similar_games: [] // Can be enhanced with cross-API recommendations
  };
}

// Combined API Fetcher
async function getAllGames(limit = 50) {
  const games = [];
  
  try {
    // Fetch from RAWG
    const rawgGames = await fetchRawgGames('/games', { 
      page_size: Math.min(20, limit),
      ordering: '-metacritic'
    });
    games.push(...await Promise.all(rawgGames.map(processRawgGame)));
    
    // Fetch from Giant Bomb (if we still need more games)
    if (games.length < limit) {
      const giantBombGames = await fetchGiantBombGames('/games', { 
        limit: Math.min(15, limit - games.length),
        sort_field: 'score',
        sort_type: 'desc'
      });
      games.push(...await Promise.all(giantBombGames.map(processGiantBombGame)));
    }
    
    // Fetch from Steam (if we still need more games)
    if (games.length < limit) {
      const steamGames = await getSteamApps();
      const randomSteamGames = steamGames
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(15, limit - games.length))
        .map(app => ({ appid: app.appid, name: app.name }));
      
      games.push(...await Promise.all(randomSteamGames.map(processSteamGame)));
    }
    
    // Fetch from TheGamesDB (if we still need more games)
    if (games.length < limit) {
      const tgdbGames = await fetchTheGamesDbGames('/games', { 
        limit: Math.min(10, limit - games.length)
      });
      games.push(...await Promise.all(tgdbGames.map(processTheGamesDbGame)));
    }
    
    return games.slice(0, limit);
  } catch (err) {
    console.error('getAllGames error:', err.message);
    return [];
  }
}

// Routes
app.get('/health', (req, res) => res.json({ status: 'OK', sources: ['RAWG', 'GiantBomb', 'Steam', 'TheGamesDB'] }));

app.get('/popular', async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  
  try {
    const rawgGames = await fetchRawgGames('/games', { 
      page_size: limit,
      ordering: '-metacritic'
    });
    
    const games = await Promise.all(rawgGames.map(processRawgGame));
    res.json(games);
  } catch (err) {
    console.error('/popular ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch popular games' });
  }
});

app.get('/search', async (req, res) => {
  const q = req.query.query;
  const limit = parseInt(req.query.limit) || 10;
  
  if (!q) return res.status(400).json({ error: 'Query required' });
  
  try {
    const results = [];
    
    // Search RAWG
    const rawgResults = await fetchRawgGames('/games', { 
      search: q, 
      page_size: Math.min(5, limit)
    });
    const rawgGames = await Promise.all(rawgResults.map(processRawgGame));
    results.push(...rawgGames);
    
    // Search Giant Bomb (if we need more results)
    if (results.length < limit) {
      const giantBombResults = await fetchGiantBombGames('/games', { 
        search: q,
        limit: Math.min(5, limit - results.length)
      });
      const giantBombGames = await Promise.all(giantBombResults.map(processGiantBombGame));
      results.push(...giantBombGames);
    }
    
    // Search Steam by name matching
    if (results.length < limit) {
      const steamApps = await getSteamApps();
      const matchingSteamGames = steamApps
        .filter(app => app.name.toLowerCase().includes(q.toLowerCase()))
        .slice(0, Math.min(3, limit - results.length))
        .map(app => ({ appid: app.appid, name: app.name }));
      
      const steamGames = await Promise.all(matchingSteamGames.map(processSteamGame));
      results.push(...steamGames);
    }
    
    res.json(results.slice(0, limit));
  } catch (err) {
    console.error('/search ERROR:', err.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

app.get('/games', async (req, res) => {
  const limit = parseInt(req.query.limit) || 5;
  const page = parseInt(req.query.page) || 1;
  const hist = historyCache.get(historyKey) || [];
  
  try {
    // Get games from all sources
    const allGames = await getAllGames(50);
    
    if (!allGames.length) {
      return res.status(404).json({ error: 'No games available' });
    }
    
    // Apply history-based weighting and pagination
    const shuffled = weightedShuffle(allGames, hist);
    const startIndex = (page - 1) * limit;
    const selected = shuffled.slice(startIndex, startIndex + limit);
    
    // Update history
    updateHistory(selected.map(g => g.id));
    
    // Process detailed games
    const games = await Promise.all(selected.map(processDetailedGame));
    res.json(games);
  } catch (err) {
    console.error('/games ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

app.get('/games/:id', async (req, res) => {
  const gameId = req.params.id;
  
  try {
    // Parse the ID to determine source
    let gameData = null;
    
    if (gameId.startsWith('rawg_')) {
      const rawgId = gameId.replace('rawg_', '');
      const rawgGame = await fetchRawgGames(`/games/${rawgId}`);
      if (rawgGame) {
        gameData = await processRawgGame(rawgGame);
      }
    } else if (gameId.startsWith('giantbomb_')) {
      const gbId = gameId.replace('giantbomb_', '');
      const gbGames = await fetchGiantBombGames(`/game/${gbId}`);
      if (gbGames.length > 0) {
        gameData = await processGiantBombGame(gbGames[0]);
      }
    } else if (gameId.startsWith('steam_')) {
      const steamAppId = gameId.replace('steam_', '');
      const steamApps = await getSteamApps();
      const steamApp = steamApps.find(app => app.appid.toString() === steamAppId);
      
      if (steamApp) {
        gameData = await processSteamGame(steamApp);
      }
    } else if (gameId.startsWith('tgdb_')) {
      const tgdbId = gameId.replace('tgdb_', '');
      const tgdbGame = await fetchTheGamesDbGames(`/games/${tgdbId}`);
      if (tgdbGame.length > 0) {
        gameData = await processTheGamesDbGame(tgdbGame[0]);
      }
    }
    
    if (!gameData) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    // Get detailed game info
    const detailedGame = await processDetailedGame(gameData);
    res.json(detailedGame);
  } catch (err) {
    console.error('/games/:id ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch game details' });
  }
});

// Favorite and Status routes remain the same
app.get('/games/:id/favorite', authenticate, async (req, res) => {
  try {
    const counts = await loadFavoriteCounts();
    res.json({ favorite: counts[req.params.id] || 0 });
  } catch (err) {
    console.error('Favorite GET ERROR:', err.message);
    res.status(500).json({ error: 'Firestore error' });
  }
});

app.post('/games/:id/favorite', authenticate, async (req, res) => {
  try {
    const counts = await loadFavoriteCounts();
    counts[req.params.id] = (counts[req.params.id] || 0) + 1;
    await saveFavoriteCounts(counts);
    res.json({ favorite: counts[req.params.id] });
  } catch (err) {
    console.error('Favorite POST ERROR:', err.message);
    res.status(500).json({ error: 'Firestore error' });
  }
});

app.delete('/games/:id/favorite', authenticate, async (req, res) => {
  try {
    const counts = await loadFavoriteCounts();
    counts[req.params.id] = Math.max((counts[req.params.id] || 0) - 1, 0);
    await saveFavoriteCounts(counts);
    res.json({ favorite: counts[req.params.id] });
  } catch (err) {
    console.error('Favorite DELETE ERROR:', err.message);
    res.status(500).json({ error: 'Firestore error' });
  }
});

const validStatuses = ['playing', 'ill_play', 'passed', 'postponed', 'abandoned'];
app.post('/games/:id/status/:status', authenticate, async (req, res) => {
  const status = req.params.status.toLowerCase();
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  
  try {
    const counts = await loadStatusCounts();
    counts[req.params.id] = counts[req.params.id] || {};
    counts[req.params.id][status] = (counts[req.params.id][status] || 0) + 1;
    await saveStatusCounts(counts);
    res.json({ [status]: counts[req.params.id][status] });
  } catch (err) {
    console.error('Status POST ERROR:', err.message);
    res.status(500).json({ error: 'Firestore error' });
  }
});

app.delete('/games/:id/status/:status', authenticate, async (req, res) => {
  const status = req.params.status.toLowerCase();
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  
  try {
    const counts = await loadStatusCounts();
    counts[req.params.id] = counts[req.params.id] || {};
    counts[req.params.id][status] = Math.max((counts[req.params.id][status] || 0) - 1, 0);
    await saveStatusCounts(counts);
    res.json({ [status]: counts[req.params.id][status] });
  } catch (err) {
    console.error('Status DELETE ERROR:', err.message);
    res.status(500).json({ error: 'Firestore error' });
  }
});

// New route to get API status
app.get('/api-status', async (req, res) => {
  const status = {
    RAWG: !!RAWG_API_KEY,
    GiantBomb: !!GIANT_BOMB_API_KEY,
    TheGamesDB: !!THEGAMESDB_API_KEY,
    Steam: true, // Steam doesn't require API key for app list
    firebase: firebaseEnabled
  };
  
  res.json(status);
});

// Start server
const server = app.listen(PORT, async () => {
  console.log(`🚀 Games API Server started on port ${PORT}`);
  console.log('📊 Available sources:', {
    RAWG: !!RAWG_API_KEY ? '✅ Configured' : '❌ Missing API Key',
    GiantBomb: !!GIANT_BOMB_API_KEY ? '✅ Configured' : '❌ Missing API Key',
    TheGamesDB: !!THEGAMESDB_API_KEY ? '✅ Configured' : '❌ Missing API Key',
    Steam: '✅ Available'
  });
  console.log('🔐 Firebase Auth:', firebaseEnabled ? '✅ Enabled' : '❌ Disabled');
  
  try {
    await getSteamApps();
    console.log('📦 Steam apps cache loaded');
  } catch (e) {
    console.error('Startup ERROR:', e.message);
  }
});

module.exports = app;