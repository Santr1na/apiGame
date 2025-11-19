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

// Mock data for demonstration
const mockGames = [
  {
    id: 'steam_570',
    source: 'Steam',
    name: 'Dota 2',
    cover_image: 'https://steamcdn-a.akamaihd.net/steam/apps/570/library_600x900.jpg',
    rating: 4.1,
    critic_rating: 91,
    release_year: 2013,
    main_genre: 'MOBA',
    platforms: ['PC'],
    description: 'A competitive multiplayer battle arena game where two teams of five players compete to destroy the enemy ancient.',
    steam_appid: 570
  },
  {
    id: 'steam_730',
    source: 'Steam',
    name: 'Counter-Strike 2',
    cover_image: 'https://steamcdn-a.akamaihd.net/steam/apps/730/library_600x900.jpg',
    rating: 4.5,
    critic_rating: 88,
    release_year: 2023,
    main_genre: 'FPS',
    platforms: ['PC'],
    description: 'The sequel to Counter-Strike: Global Offensive with improved graphics and gameplay mechanics.',
    steam_appid: 730
  },
  {
    id: 'steam_440',
    source: 'Steam',
    name: 'Team Fortress 2',
    cover_image: 'https://steamcdn-a.akamaihd.net/steam/apps/440/library_600x900.jpg',
    rating: 4.3,
    critic_rating: 93,
    release_year: 2007,
    main_genre: 'FPS',
    platforms: ['PC'],
    description: 'A team-based multiplayer first-person shooter with nine distinct character classes.',
    steam_appid: 440
  },
  {
    id: 'steam_4000',
    source: 'Steam',
    name: 'Garry\'s Mod',
    cover_image: 'https://steamcdn-a.akamaihd.net/steam/apps/4000/library_600x900.jpg',
    rating: 4.4,
    critic_rating: 85,
    release_year: 2004,
    main_genre: 'Sandbox',
    platforms: ['PC'],
    description: 'A physics sandbox game where players can create and share content on Steam Workshop.',
    steam_appid: 4000
  },
  {
    id: 'steam_550',
    source: 'Steam',
    name: 'Left 4 Dead 2',
    cover_image: 'https://steamcdn-a.akamaihd.net/steam/apps/550/library_600x900.jpg',
    rating: 4.6,
    critic_rating: 89,
    release_year: 2009,
    main_genre: 'Survival Horror',
    platforms: ['PC'],
    description: 'A cooperative first-person shooter game where players fight against hordes of zombies.',
    steam_appid: 550
  },
  {
    id: 'steam_620',
    source: 'Steam',
    name: 'Portal 2',
    cover_image: 'https://steamcdn-a.akamaihd.net/steam/apps/620/library_600x900.jpg',
    rating: 4.8,
    critic_rating: 95,
    release_year: 2011,
    main_genre: 'Puzzle',
    platforms: ['PC'],
    description: 'A puzzle-platform game that expands on the original Portal with new gameplay mechanics and story.',
    steam_appid: 620
  },
  {
    id: 'steam_240',
    source: 'Steam',
    name: 'Counter-Strike: Source',
    cover_image: 'https://steamcdn-a.akamaihd.net/steam/apps/240/library_600x900.jpg',
    rating: 4.2,
    critic_rating: 88,
    release_year: 2004,
    main_genre: 'FPS',
    platforms: ['PC'],
    description: 'A remake of Counter-Strike and Counter-Strike: Condition Zero using the Source engine.',
    steam_appid: 240
  },
  {
    id: 'steam_240320',
    source: 'Steam',
    name: 'PAYDAY 2',
    cover_image: 'https://steamcdn-a.akamaihd.net/steam/apps/218620/library_600x900.jpg',
    rating: 4.1,
    critic_rating: 79,
    release_year: 2013,
    main_genre: 'Action',
    platforms: ['PC'],
    description: 'A cooperative first-person shooter game where players take on the role of bank robbers.',
    steam_appid: 218620
  }
];

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
app.get('/health', (req, res) => res.json({ 
  status: 'OK', 
  sources: ['RAWG', 'GiantBomb', 'Steam', 'TheGamesDB'],
  mode: RAWG_API_KEY ? 'full' : 'demo'
}));

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

app.get('/popular', async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  
  try {
    // If we have RAWG API key, use it; otherwise return demo data
    if (RAWG_API_KEY) {
      // Would fetch from RAWG in production
      const response = await axios.get(`${rawgBaseUrl}/games`, {
        params: { key: RAWG_API_KEY, page_size: limit, ordering: '-metacritic' },
        timeout: 10000
      });
      // Process RAWG data here
      const games = await Promise.all(response.data.results.map(async (game) => ({
        id: `rawg_${game.id}`,
        source: 'RAWG',
        name: game.name,
        cover_image: game.background_image,
        rating: game.rating || 0,
        critic_rating: Math.round((game.rating || 0) * 20) || 'N/A',
        release_year: game.released ? new Date(game.released).getFullYear() : 'N/A',
        main_genre: game.genres?.[0]?.name || 'N/A',
        platforms: game.platforms ? game.platforms.map(p => p.platform.name) : [],
        description: game.description_raw || 'N/A'
      })));
      res.json(games);
    } else {
      // Return demo data
      const demoGames = mockGames.slice(0, limit);
      res.json(demoGames);
    }
  } catch (err) {
    console.error('/popular ERROR:', err.message);
    // Fallback to demo data
    const demoGames = mockGames.slice(0, limit);
    res.json(demoGames);
  }
});

app.get('/search', async (req, res) => {
  const q = req.query.query;
  const limit = parseInt(req.query.limit) || 10;
  
  if (!q) return res.status(400).json({ error: 'Query required' });
  
  try {
    const results = [];
    
    // Search mock data first
    const mockResults = mockGames.filter(game => 
      game.name.toLowerCase().includes(q.toLowerCase())
    ).slice(0, limit);
    
    results.push(...mockResults);
    
    // If we have RAWG API key, search it too
    if (RAWG_API_KEY && results.length < limit) {
      try {
        const response = await axios.get(`${rawgBaseUrl}/games`, {
          params: { 
            key: RAWG_API_KEY, 
            search: q, 
            page_size: Math.min(5, limit - results.length)
          },
          timeout: 10000
        });
        
        const rawgResults = response.data.results.map(game => ({
          id: `rawg_${game.id}`,
          source: 'RAWG',
          name: game.name,
          cover_image: game.background_image,
          rating: game.rating || 0,
          critic_rating: Math.round((game.rating || 0) * 20) || 'N/A',
          release_year: game.released ? new Date(game.released).getFullYear() : 'N/A',
          main_genre: game.genres?.[0]?.name || 'N/A',
          platforms: game.platforms ? game.platforms.map(p => p.platform.name) : [],
          description: game.description_raw || 'N/A'
        }));
        
        results.push(...rawgResults);
      } catch (rawgError) {
        console.log('RAWG search failed, using mock data only');
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
    // Use mock data for demonstration
    const allGames = mockGames;
    
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
    // Find game by ID in mock data
    const gameData = mockGames.find(game => game.id === gameId);
    
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

// Favorite and Status routes remain the same but with Firebase checks
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

// Start server
const server = app.listen(PORT, async () => {
  console.log(`🚀 Games API Server started on port ${PORT}`);
  console.log('📊 Available sources:', {
    RAWG: !!RAWG_API_KEY ? '✅ Configured' : '❌ Missing API Key (Demo Mode)',
    GiantBomb: !!GIANT_BOMB_API_KEY ? '✅ Configured' : '❌ Missing API Key',
    TheGamesDB: !!THEGAMESDB_API_KEY ? '✅ Configured' : '❌ Missing API Key',
    Steam: '✅ Available'
  });
  console.log('🔐 Firebase Auth:', firebaseEnabled ? '✅ Enabled' : '❌ Disabled');
  console.log('🎮 Mode:', RAWG_API_KEY ? 'Full API' : 'Demo (Mock Data)');
  
  try {
    await getSteamApps();
    console.log('📦 Steam apps cache loaded');
  } catch (e) {
    console.error('Startup ERROR:', e.message);
  }
});

module.exports = app;