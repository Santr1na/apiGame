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
const IGDB_CLIENT_ID = process.env.IGDB_CLIENT_ID;
const IGDB_CLIENT_SECRET = process.env.IGDB_CLIENT_SECRET;
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

// IGDB API
let igdbToken = null;
let igdbTokenExpiry = null;

async function initializeIGDB() {
  if (!IGDB_CLIENT_ID || !IGDB_CLIENT_SECRET) {
    console.log('⚠️ IGDB credentials not configured');
    return false;
  }

  try {
    // Test IGDB connection by getting a token
    await getIGDBToken();
    console.log('✅ IGDB client initialized');
    return true;
  } catch (error) {
    console.error('❌ IGDB initialization failed:', error.message);
    return false;
  }
}

async function getIGDBToken() {
  if (igdbToken && igdbTokenExpiry && Date.now() < igdbTokenExpiry) {
    return igdbToken;
  }

  try {
    const response = await axios.post('https://api.igdb.com/oauth2/token', 
      new URLSearchParams({
        client_id: IGDB_CLIENT_ID,
        client_secret: IGDB_CLIENT_SECRET,
        grant_type: 'client_credentials'
      }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000
    });

    igdbToken = response.data.access_token;
    igdbTokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // 1 minute buffer
    
    console.log('✅ IGDB token refreshed');
    return igdbToken;
  } catch (error) {
    console.error('❌ IGDB token fetch failed:', error.message);
    throw error;
  }
}

async function fetchIGDBGames(endpoint, params = {}) {
  if (!IGDB_CLIENT_ID || !IGDB_CLIENT_SECRET) {
    console.log('⚠️ IGDB credentials not configured, skipping IGDB');
    return [];
  }
  
  try {
    await getIGDBToken();
    
    let query = '';
    if (endpoint.startsWith('/games/')) {
      // Get specific game by ID with all required fields for processGame
      const gameId = endpoint.replace('/games/', '');
      query = `fields id,name,genres.name,platforms.name,release_dates.date,aggregated_rating,rating,cover.url,age_ratings.rating,summary,involved_companies.company.name,videos.video_id,similar_games.id,similar_games.name,similar_games.cover.url,similar_games.aggregated_rating,similar_games.release_dates.date,similar_games.genres.name,similar_games.platforms.name; where id = ${gameId}; limit 1;`;
    } else {
      // Get games list
      query = `fields id,name,genres.name,platforms.name,release_dates.date,aggregated_rating,rating,cover.url,age_ratings.rating,summary,involved_companies.company.name,videos.video_id,similar_games.id,similar_games.name,similar_games.cover.url,similar_games.aggregated_rating,similar_games.release_dates.date,similar_games.genres.name,similar_games.platforms.name;`;
      if (params.search) {
        query += ` search "${params.search}";`;
      } else {
        query += ` sort rating desc;`;
      }
      if (params.limit) {
        query += ` limit ${params.limit};`;
      }
    }
    
    const response = await axios.post('https://api.igdb.com/v4/games', query, {
      headers: {
        'Authorization': `Bearer ${igdbToken}`,
        'Client-ID': IGDB_CLIENT_ID,
        'Content-Type': 'text/plain'
      },
      timeout: 10000
    });
    
    return response.data || [];
  } catch (err) {
    console.error('IGDB API error:', err.message);
    return [];
  }
}

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

// Process game data according to the specified structure
async function processGame(g) {
  const favs = await loadFavoriteCounts();
  const stats = await loadStatusCounts();
  const st = stats[g.id] || {};
  const cover = g.cover ? `https:${g.cover.url}` : 'N/A';
  const plats = g.platforms ? g.platforms.map(p => p.name) : [];
  const genres = g.genres ? g.genres.map(gg => gg.name) : [];
  const similar = g.similar_games?.length ? await Promise.all(g.similar_games.slice(0, 3).map(async s => {
    const sc = s.cover ? `https:${s.cover.url}` : 'N/A';
    const sp = s.platforms ? s.platforms.map(p => p.name) : [];
    return { 
      id: s.id, 
      name: s.name, 
      cover_image: await getGameCover(s.name, sp, sc), 
      critic_rating: Math.round(s.aggregated_rating || 0) || 'N/A', 
      release_year: s.release_dates?.[0]?.date ? new Date(s.release_dates[0].date * 1000).getFullYear() : 'N/A', 
      main_genre: s.genres?.[0]?.name || 'N/A', 
      platforms: sp 
    };
  })) : [];
  
  // Исправленная обработка рейтинга - IGDB aggregated_rating может быть в разных форматах
  let processedRating = 0;
  if (g.aggregated_rating) {
    // IGDB aggregated_rating часто возвращает значения в формате 0-1000 или 0-100
    // Нужно нормализовать до 0-100
    if (g.aggregated_rating > 100) {
      processedRating = Math.round(g.aggregated_rating / 10); // 850 -> 85
    } else {
      processedRating = Math.round(g.aggregated_rating);
    }
  } else if (g.rating) {
    processedRating = Math.round(g.rating);
  }
  
  return {
    id: g.id, 
    name: g.name, 
    genres, 
    platforms: plats,
    release_date: g.release_dates?.[0]?.date ? new Date(g.release_dates[0].date * 1000).toISOString().split('T')[0] : 'N/A',
    rating: processedRating || 'N/A',
    rating_type: g.aggregated_rating ? 'Critics' : 'Users',
    cover_image: await getGameCover(g.name, plats, cover),
    age_ratings: g.age_ratings ? g.age_ratings.map(r => ({1:'ESRB: EC',2:'ESRB: E',3:'ESRB: E10+',4:'ESRB: T',5:'ESRB: M',6:'ESRB: AO',7:'PEGI: 3',8:'PEGI: 7',9:'PEGI: 12',10:'PEGI: 16',11:'PEGI: 18'}[r.rating] || 'N/A')) : ['N/A'],
    summary: g.summary || 'N/A',
    developers: g.involved_companies ? g.involved_companies.map(c => c.company.name) : ['N/A'],
    videos: g.videos ? g.videos.map(v => `https://www.youtube.com/watch?v=${v.video_id}`).slice(0,3) : ['N/A'],
    similar_games: similar,
    favorite: favs[g.id] || 0,
    playing: st.playing || 0, 
    ill_play: st.ill_play || 0, 
    passed: st.passed || 0, 
    postponed: st.postponed || 0, 
    abandoned: st.abandoned || 0
  };
}

// Helper function to get game cover image
async function getGameCover(name, platforms, fallbackUrl) {
  // If we have a good fallback URL, use it
  if (fallbackUrl && fallbackUrl !== 'N/A') {
    return fallbackUrl;
  }
  
  // Try to find on Steam if available
  if (platforms.includes('PC')) {
    const steamApps = await getSteamApps();
    const steamApp = steamApps.find(app => app.name.toLowerCase() === name.toLowerCase());
    if (steamApp) {
      return await getSteamCover(name, steamApp.appid);
    }
  }
  
  return 'N/A';
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

// New endpoint with the exact processGame structure (database-first approach)
app.get('/games/:id/processed', async (req, res) => {
  const gameId = req.params.id;
  
  try {
    let gameData = null;
    
    // Try database first
    if (USE_DATABASE) {
      gameData = await getGameById(gameId);
      if (gameData) {
        console.log(`📊 Found game ${gameId} in database for processGame`);
        
        // Convert database format to IGDB-like format for processGame
        const convertedGame = {
          id: gameData.id,
          name: gameData.name,
          cover: { url: gameData.cover_image?.replace('media/', 'media/crop/600/400/') },
          rating: gameData.rating,
          aggregated_rating: gameData.critic_rating,
          release_dates: gameData.release_year ? [{ date: Math.floor(new Date(`${gameData.release_year}-01-01`).getTime() / 1000) }] : [],
          genres: gameData.main_genre ? [{ name: gameData.main_genre }] : [],
          platforms: gameData.platforms ? gameData.platforms.map(p => ({ name: p })) : [],
          summary: gameData.description || 'N/A',
          videos: [], // Database doesn't store videos
          age_ratings: [], // Database doesn't store age ratings
          involved_companies: gameData.developers ? gameData.developers.map(d => ({ company: { name: d } })) : [],
          similar_games: [] // Database doesn't store similar games
        };
        
        const processedGame = await processGame(convertedGame);
        res.json(processedGame);
        return;
      }
    }
    
    // Fallback to API if not in database
    console.log(`📡 Fetching game ${gameId} from API for processGame`);
    
    if (gameId.startsWith('igdb_')) {
      const igdbId = gameId.replace('igdb_', '');
      const igdbGames = await fetchIGDBGames(`/games/${igdbId}`);
      
      if (igdbGames.length > 0) {
        const enhancedGame = {
          ...igdbGames[0],
          similar_games: igdbGames[0].similar_games || [],
          videos: igdbGames[0].videos || [],
          age_ratings: igdbGames[0].age_ratings || [],
          involved_companies: igdbGames[0].involved_companies || []
        };
        gameData = await processGame(enhancedGame);
        
        // Save to database for future use
        if (USE_DATABASE) {
          const dbGameData = await processRawgGame({ 
            id: igdbGames[0].id, 
            name: igdbGames[0].name,
            background_image: igdbGames[0].cover?.url,
            rating: igdbGames[0].rating,
            metacritic: igdbGames[0].aggregated_rating,
            released: igdbGames[0].release_dates?.[0]?.date ? new Date(igdbGames[0].release_dates[0].date * 1000).toISOString().split('T')[0] : null,
            genres: igdbGames[0].genres?.map(g => ({ name: g.name })) || [],
            platforms: igdbGames[0].platforms?.map(p => ({ platform: { name: p.name } })) || [],
            description_raw: igdbGames[0].summary || '',
            developers: igdbGames[0].involved_companies?.map(c => ({ name: c.company.name })) || []
          });
          dbGameData.id = `igdb_${igdbId}`;
          dbGameData.source = 'IGDB';
          await saveGames([dbGameData]).catch(err => console.error('Save error:', err));
        }
        
        res.json(gameData);
      } else {
        res.status(404).json({ error: 'IGDB game not found' });
      }
    } else if (gameId.startsWith('rawg_')) {
      const rawgId = gameId.replace('rawg_', '');
      const response = await axios.get(`${rawgBaseUrl}/games/${rawgId}`, {
        params: { key: RAWG_API_KEY },
        timeout: 10000
      });
      
      // Convert RAWG format to IGDB-like format for processGame
      const convertedGame = {
        id: response.data.id,
        name: response.data.name,
        cover: { url: response.data.background_image?.replace('media/', 'media/crop/600/400/') },
        rating: response.data.rating,
        aggregated_rating: response.data.metacritic,
        release_dates: response.data.released ? [{ date: Math.floor(new Date(response.data.released).getTime() / 1000) }] : [],
        genres: response.data.genres?.map(g => ({ name: g.name })) || [],
        platforms: response.data.platforms?.map(p => ({ name: p.platform.name })) || [],
        summary: response.data.description_raw || '',
        videos: response.data.clip ? [{ video_id: response.data.clip.clip?.split('v=')[1] }] : [],
        age_ratings: [],
        involved_companies: response.data.developers?.map(d => ({ company: { name: d.name } })) || [],
        similar_games: [] // Would need additional API call
      };
      
      gameData = await processGame(convertedGame);
      
      // Save to database
      if (USE_DATABASE) {
        const dbGameData = await processRawgGame(response.data);
        await saveGames([dbGameData]).catch(err => console.error('Save error:', err));
      }
      
      res.json(gameData);
    } else {
      res.status(404).json({ error: 'Game not found or format not supported' });
    }
  } catch (err) {
    console.error('/games/:id/processed ERROR:', err.message);
    res.status(500).json({ error: 'Failed to process game data' });
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
  
  // Initialize IGDB
  await initializeIGDB();
  
  console.log('📊 Available sources:', {
    IGDB: !!IGDB_CLIENT_ID && !!IGDB_CLIENT_SECRET ? '✅ Configured' : '❌ Missing Credentials',
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
