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

// Video and Media Helpers
async function getGameTrailers(game, source) {
  const trailers = [];
  
  try {
    if (source === 'RAWG' && game.clip) {
      trailers.push({
        type: 'trailer',
        url: game.clip.clip,
        thumbnail: game.clip.preview,
        title: `${game.name} Trailer`
      });
    }
    
    if (source === 'steam' && game.steam_appid) {
      const steamDetails = await fetchSteamGameDetails(game.steam_appid);
      if (steamDetails?.movies) {
        trailers.push(...steamDetails.movies.map(movie => ({
          type: 'trailer',
          url: `https://www.youtube.com/watch?v=${movie.id}`,
          thumbnail: movie.thumbnail,
          title: movie.name || `${game.name} Trailer`
        })));
      }
    }
    
    // Add YouTube search as fallback
    if (trailers.length === 0) {
      const searchQuery = `${game.name} official trailer`.replace(/\s+/g, '+');
      trailers.push({
        type: 'search',
        url: `https://www.youtube.com/results?search_query=${searchQuery}`,
        thumbnail: null,
        title: `Search for ${game.name} trailers`
      });
    }
    
    return trailers;
  } catch (error) {
    console.error('Error fetching trailers:', error.message);
    return [{
      type: 'search',
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(game.name + ' official trailer')}`,
      thumbnail: null,
      title: `Search for ${game.name} trailers`
    }];
  }
}

// Enhanced Similar Games Fetcher (IGDB Priority)
async function getSimilarGames(gameData, limit = 6) {
  const similar = [];
  
  try {
    // Get similar games from IGDB if available (Priority 1)
    if (gameData.source === 'IGDB') {
      const igdbId = gameData.id.replace('igdb_', '');
      const igdbSimilar = await fetchIGDBGames(`/games/${igdbId}/suggested`, { 
        limit: limit 
      });
      
      if (igdbSimilar && igdbSimilar.length > 0) {
        const processedGames = await Promise.all(
          igdbSimilar.slice(0, limit).map(processIGDBGame)
        );
        const detailedSimilar = await Promise.all(
          processedGames.map(processDetailedGame)
        );
        similar.push(...detailedSimilar);
      }
    }
    
    // Get similar games from RAWG if available (Priority 2)
    if (gameData.source === 'RAWG' && similar.length < limit) {
      const rawgId = gameData.id.replace('rawg_', '');
      const similarGames = await fetchRawgGames(`/games/${rawgId}/suggested`, { 
        page_size: limit 
      });
      
      if (similarGames && similarGames.results) {
        const processedGames = await Promise.all(
          similarGames.results.slice(0, limit - similar.length).map(processRawgGame)
        );
        const detailedSimilar = await Promise.all(
          processedGames.map(processDetailedGame)
        );
        similar.push(...detailedSimilar);
      }
    }
    
    // If we don't have enough similar games, get games by genre (IGDB first)
    if (similar.length < limit && gameData.main_genre && gameData.main_genre !== 'N/A') {
      // Try IGDB first
      const igdbGenreGames = await fetchIGDBGames('/games', {
        limit: limit * 2
      });
      
      if (igdbGenreGames && igdbGenreGames.length > 0) {
        const processedGames = await Promise.all(
          igdbGenreGames
            .filter(g => g.name !== gameData.name) // Exclude current game
            .filter(g => g.genres && g.genres.some(genre => genre.name === gameData.main_genre))
            .slice(0, limit - similar.length)
            .map(processIGDBGame)
        );
        const detailedSimilar = await Promise.all(
          processedGames.map(processDetailedGame)
        );
        similar.push(...detailedSimilar);
      }
      
      // Fallback to RAWG if still need more
      if (similar.length < limit) {
        const rawgGenreGames = await fetchRawgGames('/games', {
          genres: gameData.main_genre.toLowerCase().replace(/\s+/g, '-'),
          page_size: limit * 2,
          ordering: '-rating'
        });
        
        if (rawgGenreGames && rawgGenreGames.length > 0) {
          const processedGames = await Promise.all(
            rawgGenreGames
              .filter(g => g.name !== gameData.name) // Exclude current game
              .slice(0, limit - similar.length)
              .map(processRawgGame)
          );
          const detailedSimilar = await Promise.all(
            processedGames.map(processDetailedGame)
          );
          similar.push(...detailedSimilar);
        }
      }
    }
    
    return similar.slice(0, limit);
  } catch (error) {
    console.error('Error fetching similar games:', error.message);
    return [];
  }
}

// Enhanced Data Processors
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
    description: game.description_raw || 'N/A',
    developers: game.developers ? game.developers.map(d => d.name) : [],
    publishers: game.publishers ? game.publishers.map(p => p.name) : [],
    tags: game.tags ? game.tags.slice(0, 10).map(tag => tag.name) : [],
    background_image: game.background_image || null
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
    description: game.deck || 'N/A',
    developers: game.developers ? [game.developers.name] : [],
    publishers: game.publishers ? [game.publishers.name] : [],
    tags: game.genres ? game.genres.map(g => g.name) : [],
    background_image: null
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
    description: game.overview || 'N/A',
    developers: [],
    publishers: [],
    tags: game.genres ? [game.genres[0]] : [],
    background_image: null
  };
}

async function processIGDBGame(game) {
  const coverImage = game.cover?.url ? `https:${game.cover.url.replace('thumb', 'cover_big')}` : 'N/A';
  
  return {
    id: `igdb_${game.id}`,
    source: 'IGDB',
    name: game.name,
    cover_image: coverImage,
    rating: game.rating || 0,
    critic_rating: game.critic_rating || 'N/A',
    release_year: game.release_date ? new Date(game.release_date).getFullYear() : 'N/A',
    main_genre: game.genres?.[0]?.name || 'N/A',
    platforms: game.platforms ? game.platforms.map(p => p.name) : [],
    description: game.summary || 'N/A',
    developers: game.developers ? game.developers.map(d => d.name) : [],
    publishers: game.publishers ? game.publishers.map(p => p.name) : [],
    tags: game.tags ? game.tags.slice(0, 10).map(tag => tag.name) : [],
    background_image: game.cover?.url ? `https:${game.cover.url}` : null
  };
}

async function processSteamGame(game) {
  const steamDetails = await fetchSteamGameDetails(game.appid);
  
  return {
    id: `steam_${game.appid}`,
    source: 'Steam',
    name: game.name,
    cover_image: await getSteamCover(game.name, game.appid),
    rating: steamDetails?.metacritic?.score || 0,
    critic_rating: steamDetails?.metacritic?.score || 'N/A',
    release_year: steamDetails?.release_date?.date ? new Date(steamDetails.release_date.date).getFullYear() : 'N/A',
    main_genre: steamDetails?.genres?.[0]?.description || 'N/A',
    platforms: ['PC'],
    description: steamDetails?.short_description || 'N/A',
    steam_appid: game.appid,
    developers: steamDetails?.developers || [],
    publishers: steamDetails?.publishers ? [steamDetails.publishers] : [],
    tags: steamDetails?.genres ? steamDetails.genres.map(g => g.description) : [],
    background_image: steamDetails?.header_image || null
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
    // Исправляем дублирование https:
    if (fallbackUrl.startsWith('https:https://')) {
      return fallbackUrl.replace('https:https://', 'https://');
    }
    if (fallbackUrl.startsWith('http:http://')) {
      return fallbackUrl.replace('http:http://', 'http://');
    }
    // Если URL уже правильный, возвращаем как есть
    if (fallbackUrl.startsWith('http://') || fallbackUrl.startsWith('https://')) {
      return fallbackUrl;
    }
    // Добавляем протокол только если его нет
    return `https:${fallbackUrl}`;
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
    similar_games: [] // Can be enhanced with cross-API recommendations
  };
}

// Combined API Fetcher (IGDB Priority)
async function getAllGames(limit = 50) {
  const games = [];
  
  try {
    // Fetch from IGDB (Priority 1)
    const igdbGames = await fetchIGDBGames('/games', { 
      limit: Math.min(25, limit)
    });
    games.push(...await Promise.all(igdbGames.map(processIGDBGame)));
    
    // Fetch from RAWG (Priority 2)
    if (games.length < limit) {
      const rawgGames = await fetchRawgGames('/games', { 
        page_size: Math.min(20, limit - games.length),
        ordering: '-metacritic'
      });
      games.push(...await Promise.all(rawgGames.map(processRawgGame)));
    }
    
    // Fetch from Giant Bomb (Priority 3)
    if (games.length < limit) {
      const giantBombGames = await fetchGiantBombGames('/games', { 
        limit: Math.min(15, limit - games.length),
        sort_field: 'score',
        sort_type: 'desc'
      });
      games.push(...await Promise.all(giantBombGames.map(processGiantBombGame)));
    }
    
    // Fetch from Steam (Priority 4)
    if (games.length < limit) {
      const steamGames = await getSteamApps();
      const randomSteamGames = steamGames
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(10, limit - games.length))
        .map(app => ({ appid: app.appid, name: app.name }));
      
      games.push(...await Promise.all(randomSteamGames.map(processSteamGame)));
    }
    
    // Fetch from TheGamesDB (Priority 5)
    if (games.length < limit) {
      const tgdbGames = await fetchTheGamesDbGames('/games', { 
        limit: Math.min(8, limit - games.length)
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
app.get('/health', (req, res) => res.json({ status: 'OK', sources: ['IGDB', 'RAWG', 'GiantBomb', 'Steam', 'TheGamesDB'] }));

app.get('/popular', async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  
  try {
    // IGDB first priority for popular games
    const igdbGames = await fetchIGDBGames('/games', { 
      limit: limit
    });
    
    if (igdbGames.length > 0) {
      const games = await Promise.all(igdbGames.map(processIGDBGame));
      res.json(games);
    } else {
      // Fallback to RAWG if IGDB fails
      const rawgGames = await fetchRawgGames('/games', { 
        page_size: limit,
        ordering: '-metacritic'
      });
      
      const games = await Promise.all(rawgGames.map(processRawgGame));
      res.json(games);
    }
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
    
    // Search RAWG first (Priority 1 for search)
    const rawgResults = await fetchRawgGames('/games', { 
      search: q, 
      page_size: Math.min(6, limit)
    });
    const rawgGames = await Promise.all(rawgResults.map(processRawgGame));
    results.push(...rawgGames);
    
    // Search IGDB (Priority 2)
    if (results.length < limit) {
      const igdbResults = await fetchIGDBGames('/games', { 
        search: q,
        limit: Math.min(4, limit - results.length)
      });
      const igdbGames = await Promise.all(igdbResults.map(processIGDBGame));
      results.push(...igdbGames);
    }
    
    // Search Giant Bomb (if we need more results)
    if (results.length < limit) {
      const giantBombResults = await fetchGiantBombGames('/games', { 
        search: q,
        limit: Math.min(3, limit - results.length)
      });
      const giantBombGames = await Promise.all(giantBombResults.map(processGiantBombGame));
      results.push(...giantBombGames);
    }
    
    // Search Steam by name matching
    if (results.length < limit) {
      const steamApps = await getSteamApps();
      const matchingSteamGames = steamApps
        .filter(app => app.name.toLowerCase().includes(q.toLowerCase()))
        .slice(0, Math.min(2, limit - results.length))
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
    let rawGameData = null;
    
    if (gameId.startsWith('igdb_')) {
      const igdbId = gameId.replace('igdb_', '');
      const igdbGames = await fetchIGDBGames(`/games/${igdbId}`);
      if (igdbGames.length > 0) {
        rawGameData = igdbGames[0];
        gameData = await processIGDBGame(igdbGames[0]);
      }
    } else if (gameId.startsWith('rawg_')) {
      const rawgId = gameId.replace('rawg_', '');
      const rawgGame = await fetchRawgGames(`/games/${rawgId}`);
      if (rawgGame) {
        rawGameData = rawgGame;
        gameData = await processRawgGame(rawgGame);
      }
    } else if (gameId.startsWith('giantbomb_')) {
      const gbId = gameId.replace('giantbomb_', '');
      const gbGames = await fetchGiantBombGames(`/game/${gbId}`);
      if (gbGames.length > 0) {
        rawGameData = gbGames[0];
        gameData = await processGiantBombGame(gbGames[0]);
      }
    } else if (gameId.startsWith('steam_')) {
      const steamAppId = gameId.replace('steam_', '');
      const steamApps = await getSteamApps();
      const steamApp = steamApps.find(app => app.appid.toString() === steamAppId);
      
      if (steamApp) {
        rawGameData = steamApp;
        gameData = await processSteamGame(steamApp);
      }
    } else if (gameId.startsWith('tgdb_')) {
      const tgdbId = gameId.replace('tgdb_', '');
      const tgdbGame = await fetchTheGamesDbGames(`/games/${tgdbId}`);
      if (tgdbGame.length > 0) {
        rawGameData = tgdbGame[0];
        gameData = await processTheGamesDbGame(tgdbGame[0]);
      }
    }
    
    if (!gameData) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    // Get detailed game info with enhanced features
    const detailedGame = await processDetailedGame(gameData);
    
    // Add enhanced features
    try {
      const trailers = await getGameTrailers(rawGameData, gameData.source);
      const similarGames = await getSimilarGames(gameData, 6);
      
      // Enhanced response with additional information
      const enhancedGame = {
        ...detailedGame,
        videos: trailers,
        similar_games: similarGames,
        external_links: {
          steam_store: gameData.steam_appid ? `https://store.steampowered.com/app/${gameData.steam_appid}/` : null,
          rawg_page: gameData.source === 'RAWG' ? `https://rawg.io/games/${gameData.id.replace('rawg_', '')}` : null,
          youtube_search: `https://www.youtube.com/results?search_query=${encodeURIComponent(gameData.name + ' game')}`
        },
        technical_info: {
          requirements: gameData.steam_appid ? (await fetchSteamGameDetails(gameData.steam_appid))?.pc_requirements || null : null,
          metacritic_score: gameData.critic_rating,
          esrb_rating: rawGameData?.esrb_rating || null
        }
      };
      
      res.json(enhancedGame);
    } catch (enhancedError) {
      console.error('Enhanced features error:', enhancedError.message);
      // Return basic info if enhanced features fail
      res.json(detailedGame);
    }
  } catch (err) {
    console.error('/games/:id ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch game details' });
  }
});

// New endpoint with the exact processGame structure
app.get('/games/:id/processed', async (req, res) => {
  const gameId = req.params.id;
  
  try {
    let gameData = null;
    
    if (gameId.startsWith('igdb_')) {
      const igdbId = gameId.replace('igdb_', '');
      const igdbGames = await fetchIGDBGames(`/games/${igdbId}`);
      if (igdbGames.length > 0) {
        // Enhance the game data with similar games for the processGame function
        const enhancedGame = {
          ...igdbGames[0],
          similar_games: await fetchIGDBGames(`/games/${igdbId}/suggested`, { limit: 3 }) || [],
          videos: [], // Would need additional API call to get videos
          age_ratings: [], // Would need additional API call to get age ratings
          involved_companies: igdbGames[0].involved_companies || []
        };
        gameData = await processGame(enhancedGame);
      }
    } else {
      // For other sources, try to convert to IGDB-like format
      if (gameId.startsWith('rawg_')) {
        const rawgId = gameId.replace('rawg_', '');
        const rawgGame = await fetchRawgGames(`/games/${rawgId}`);
        if (rawgGame) {
          // Convert RAWG format to IGDB-like format for processGame
          const convertedGame = {
            id: rawgGame.id,
            name: rawgGame.name,
            cover: { url: rawgGame.background_image?.replace('media/', 'media/crop/600/400/') },
            rating: rawgGame.rating,
            aggregated_rating: rawgGame.metacritic,
            release_dates: rawgGame.released ? [{ date: Math.floor(new Date(rawgGame.released).getTime() / 1000) }] : [],
            genres: rawgGame.genres?.map(g => ({ name: g.name })) || [],
            platforms: rawgGame.platforms?.map(p => ({ name: p.platform.name })) || [],
            summary: rawgGame.description_raw || '',
            videos: rawgGame.clip ? [{ video_id: rawgGame.clip.clip?.split('v=')[1] }] : [],
            age_ratings: [],
            involved_companies: rawgGame.developers?.map(d => ({ company: { name: d.name } })) || [],
            similar_games: [] // Would need additional API call
          };
          gameData = await processGame(convertedGame);
        }
      }
    }
    
    if (!gameData) {
      return res.status(404).json({ error: 'Game not found or format not supported' });
    }
    
    res.json(gameData);
  } catch (err) {
    console.error('/games/:id/processed ERROR:', err.message);
    res.status(500).json({ error: 'Failed to process game data' });
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
    IGDB: !!IGDB_CLIENT_ID && !!IGDB_CLIENT_SECRET,
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
  
  try {
    await getSteamApps();
    console.log('📦 Steam apps cache loaded');
  } catch (e) {
    console.error('Startup ERROR:', e.message);
  }
});

module.exports = app;