const express = require('express');
const axios = require('axios');
const cors = require('cors');
const NodeCache = require('node-cache');
const admin = require('firebase-admin');
const {
  initDatabase,
  getGameById,
  searchGames,
  getPopularGames,
  getRandomGames,
  getGamesCount,
  saveGames
} = require('./db-setup');

const app = express();
const PORT = process.env.PORT || 3002;

// Use database flag
const USE_DATABASE = process.env.USE_DATABASE !== 'false'; // Default: true

// Firebase (optional - will skip if no credentials provided)
let db = null;
let firebaseEnabled = false;

try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  if (serviceAccount.project_id) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    db = admin.firestore();
    firebaseEnabled = true;
    console.log('✅ Firebase initialized');
  } else {
    console.log('⚠️ Firebase credentials not provided - auth features disabled');
  }
} catch (error) {
  console.log('⚠️ Firebase initialization failed - auth features disabled:', error.message);
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
    const res = await axios.get(steamAppsUrl, { timeout: 10000 });
    steamApps = res.data.applist.apps;
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

// API Data Fetchers (fallback when DB doesn't have data)
async function fetchRawgGames(endpoint, params = {}) {
  if (!RAWG_API_KEY) throw new Error('RAWG API key not configured');
  
  try {
    const response = await axios.get(`${rawgBaseUrl}${endpoint}`, {
      params: { key: RAWG_API_KEY, ...params },
      timeout: 10000
    });
    return response.data.results || [];
  } catch (err) {
    console.error('RAWG API error:', err.message);
    return [];
  }
}

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
    similar_games: []
  };
}

// Routes
app.get('/health', async (req, res) => {
  const dbCount = USE_DATABASE ? await getGamesCount().catch(() => 0) : 0;
  res.json({ 
    status: 'OK', 
    sources: ['RAWG', 'GiantBomb', 'Steam', 'TheGamesDB'],
    database: USE_DATABASE ? 'enabled' : 'disabled',
    games_in_db: dbCount
  });
});

app.get('/popular', async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  
  try {
    let games = [];
    
    // Try database first
    if (USE_DATABASE) {
      games = await getPopularGames(limit);
      console.log(`📊 Fetched ${games.length} popular games from database`);
    }
    
    // Fallback to API if database is empty or disabled
    if (games.length === 0) {
      console.log('📡 Fetching from RAWG API (database empty or disabled)');
      const rawgGames = await fetchRawgGames('/games', { 
        page_size: limit,
        ordering: '-metacritic'
      });
      games = await Promise.all(rawgGames.map(processRawgGame));
      
      // Save to database for future use
      if (USE_DATABASE && games.length > 0) {
        await saveGames(games).catch(err => console.error('Save error:', err));
      }
    }
    
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
    let results = [];
    
    // Try database first
    if (USE_DATABASE) {
      results = await searchGames(q, limit);
      console.log(`📊 Found ${results.length} games in database for "${q}"`);
    }
    
    // If not enough results, fetch from APIs
    if (results.length < limit) {
      console.log(`📡 Fetching additional results from APIs (need ${limit - results.length} more)`);
      
      // Search RAWG
      if (RAWG_API_KEY && results.length < limit) {
        const rawgResults = await fetchRawgGames('/games', { 
          search: q, 
          page_size: Math.min(5, limit - results.length)
        });
        const rawgGames = await Promise.all(rawgResults.map(processRawgGame));
        results.push(...rawgGames);
        
        // Save new games to database
        if (USE_DATABASE && rawgGames.length > 0) {
          await saveGames(rawgGames).catch(err => console.error('Save error:', err));
        }
      }
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
    let allGames = [];
    
    // Try database first
    if (USE_DATABASE) {
      allGames = await getRandomGames(50);
      console.log(`📊 Fetched ${allGames.length} random games from database`);
    }
    
    // Fallback to API if database is empty
    if (allGames.length === 0) {
      console.log('📡 Fetching from APIs (database empty)');
      const rawgGames = await fetchRawgGames('/games', { 
        page_size: 20,
        ordering: '-metacritic'
      });
      allGames = await Promise.all(rawgGames.map(processRawgGame));
      
      // Save to database
      if (USE_DATABASE && allGames.length > 0) {
        await saveGames(allGames).catch(err => console.error('Save error:', err));
      }
    }
    
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
    let gameData = null;
    
    // Try database first
    if (USE_DATABASE) {
      gameData = await getGameById(gameId);
      if (gameData) {
        console.log(`📊 Found game ${gameId} in database`);
      }
    }
    
    // Fallback to API if not in database
    if (!gameData) {
      console.log(`📡 Fetching game ${gameId} from API`);
      
      if (gameId.startsWith('rawg_')) {
        const rawgId = gameId.replace('rawg_', '');
        const response = await axios.get(`${rawgBaseUrl}/games/${rawgId}`, {
          params: { key: RAWG_API_KEY },
          timeout: 10000
        });
        gameData = await processRawgGame(response.data);
        
        // Save to database
        if (USE_DATABASE) {
          await saveGames([gameData]).catch(err => console.error('Save error:', err));
        }
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

// Favorite and Status routes
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

// API status
app.get('/api-status', async (req, res) => {
  const dbCount = USE_DATABASE ? await getGamesCount().catch(() => 0) : 0;
  
  const status = {
    RAWG: !!RAWG_API_KEY,
    GiantBomb: !!GIANT_BOMB_API_KEY,
    TheGamesDB: !!THEGAMESDB_API_KEY,
    Steam: true,
    Database: USE_DATABASE,
    GamesInDB: dbCount
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
  console.log('💾 Database:', USE_DATABASE ? '✅ Enabled' : '❌ Disabled');
  
  if (USE_DATABASE) {
    try {
      await initDatabase();
      const count = await getGamesCount();
      console.log(`📦 Database ready with ${count} games`);
      if (count === 0) {
        console.log('💡 Tip: Run "node populate-db.js" to populate the database');
      }
    } catch (e) {
      console.error('Database init ERROR:', e.message);
    }
  }
  
  try {
    await getSteamApps();
    console.log('📦 Steam apps cache loaded');
  } catch (e) {
    console.error('Startup ERROR:', e.message);
  }
});

module.exports = app;
