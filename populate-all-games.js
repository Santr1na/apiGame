require('dotenv').config();
const axios = require('axios');
const {
  initDatabase,
  saveGames,
  getGamesCount,
  getCountBySource,
  closeDatabase
} = require('./db-setup');

// API Configuration
const IGDB_CLIENT_ID = process.env.IGDB_CLIENT_ID;
const IGDB_CLIENT_SECRET = process.env.IGDB_CLIENT_SECRET;
const RAWG_API_KEY = process.env.RAWG_API_KEY;
const GIANT_BOMB_API_KEY = process.env.GIANT_BOMB_API_KEY;
const THEGAMESDB_API_KEY = process.env.THEGAMESDB_API_KEY;

// API URLs
const rawgBaseUrl = 'https://api.rawg.io/api';
const giantBombBaseUrl = 'https://www.giantbomb.com/api';
const theGamesDbBaseUrl = 'https://api.thegamesdb.net/v1';
const steamAppsUrl = 'https://api.steampowered.com/ISteamApps/GetAppList/v2/';

// IGDB API
let igdbToken = null;
let igdbTokenExpiry = null;

// Delay helper to avoid rate limits
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// IGDB Token Management
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

// Fetch ALL games from IGDB
async function fetchAllIGDBGames() {
  if (!IGDB_CLIENT_ID || !IGDB_CLIENT_SECRET) {
    console.log('⚠️ IGDB credentials not configured, skipping...');
    return [];
  }

  console.log('📥 Fetching ALL games from IGDB...');
  const games = [];
  let offset = 0;
  const limit = 50; // IGDB max per request
  const maxRequests = 1000; // Maximum requests to avoid timeout

  try {
    for (let request = 0; request < maxRequests && offset < 50000; request++) {
      console.log(`  Request ${request + 1}/${maxRequests}, offset ${offset}...`);
      
      await getIGDBToken();
      
      const query = `fields id,name,cover.url,rating,critic_rating,release_date,genres.name,platforms.name,summary; limit ${limit}; offset ${offset};`;
      
      const response = await axios.post('https://api.igdb.com/v4/games', query, {
        headers: {
          'Authorization': `Bearer ${igdbToken}`,
          'Client-ID': IGDB_CLIENT_ID,
          'Content-Type': 'text/plain'
        },
        timeout: 15000
      });

      const results = response.data || [];
      
      if (results.length === 0) {
        console.log('  No more games available from IGDB');
        break;
      }
      
      for (const game of results) {
        games.push({
          id: `igdb_${game.id}`,
          source: 'IGDB',
          name: game.name,
          cover_image: game.cover?.url ? `https:${game.cover.url.replace('thumb', 'cover_big')}` : 'N/A',
          rating: game.rating || 0,
          critic_rating: game.critic_rating || 'N/A',
          release_year: game.release_date ? new Date(game.release_date * 1000).getFullYear() : 'N/A',
          main_genre: game.genres?.[0]?.name || 'N/A',
          platforms: game.platforms ? game.platforms.map(p => p.name) : [],
          description: game.summary || game.name
        });
      }

      offset += limit;

      // Save progress every 10 requests
      if (request % 10 === 0 && games.length > 0) {
        console.log(`  💾 Saving progress... (${games.length} games so far)`);
        await saveGames(games);
        games.length = 0; // Clear array to save memory
      }

      // Rate limit protection
      await delay(1000);
    }

    console.log(`✅ Fetched total from IGDB`);
    return games;
  } catch (err) {
    console.error('❌ IGDB fetch error:', err.message);
    return games;
  }
}

// Fetch ALL games from RAWG (up to API limits)
async function fetchAllRawgGames() {
  if (!RAWG_API_KEY) {
    console.log('⚠️ RAWG API key not configured, skipping...');
    return [];
  }

  console.log('📥 Fetching ALL games from RAWG...');
  const games = [];
  let page = 1;
  let hasMore = true;
  const maxPages = 1000; // Try to get as many as possible (RAWG has 350,000+ games)

  try {
    while (hasMore && page <= maxPages) {
      console.log(`  Page ${page}/${maxPages}...`);
      
      const response = await axios.get(`${rawgBaseUrl}/games`, {
        params: {
          key: RAWG_API_KEY,
          page_size: 40,
          page: page,
          ordering: '-added' // Get all games by date added
        },
        timeout: 15000
      });

      const results = response.data.results || [];
      
      if (results.length === 0) {
        hasMore = false;
        break;
      }

      for (const game of results) {
        games.push({
          id: `rawg_${game.id}`,
          source: 'RAWG',
          name: game.name,
          cover_image: game.background_image || 'N/A',
          rating: game.rating || 0,
          critic_rating: Math.round((game.rating || 0) * 20) || 'N/A',
          release_year: game.released ? new Date(game.released).getFullYear() : 'N/A',
          main_genre: game.genres?.[0]?.name || 'N/A',
          platforms: game.platforms ? game.platforms.map(p => p.platform.name) : [],
          description: game.description_raw || game.name
        });
      }

      page++;
      
      // Save progress every 10 pages
      if (page % 10 === 0) {
        console.log(`  💾 Saving progress... (${games.length} games so far)`);
        await saveGames(games);
        games.length = 0; // Clear array to save memory
      }

      // Rate limit protection (RAWG: 20,000 requests/day)
      await delay(1000);
    }

    console.log(`✅ Fetched total from RAWG`);
    return games;
  } catch (err) {
    console.error('❌ RAWG fetch error:', err.message);
    return games;
  }
}

// Fetch ALL games from Giant Bomb
async function fetchAllGiantBombGames() {
  if (!GIANT_BOMB_API_KEY) {
    console.log('⚠️ Giant Bomb API key not configured, skipping...');
    return [];
  }

  console.log('📥 Fetching ALL games from Giant Bomb...');
  const games = [];
  let offset = 0;
  let hasMore = true;
  const maxRequests = 400; // Try to get as many as possible (40,000+ games available)

  try {
    while (hasMore && offset < maxRequests * 100) {
      console.log(`  Offset ${offset}...`);
      
      const response = await axios.get(`${giantBombBaseUrl}/games`, {
        params: {
          api_key: GIANT_BOMB_API_KEY,
          format: 'json',
          limit: 100,
          offset: offset,
          sort: 'date_added:desc'
        },
        timeout: 15000
      });

      const results = response.data.results || [];
      
      if (results.length === 0) {
        hasMore = false;
        break;
      }

      for (const game of results) {
        games.push({
          id: `giantbomb_${game.id}`,
          source: 'GiantBomb',
          name: game.name,
          cover_image: game.image?.medium_url || 'N/A',
          rating: 0,
          critic_rating: 'N/A',
          release_year: game.original_release_date ? new Date(game.original_release_date).getFullYear() : 'N/A',
          main_genre: game.genres?.[0]?.name || 'N/A',
          platforms: game.platforms ? game.platforms.map(p => p.name) : [],
          description: game.deck || game.name
        });
      }

      offset += 100;

      // Save progress every 500 games
      if (games.length >= 500) {
        console.log(`  💾 Saving progress... (${games.length} games)`);
        await saveGames(games);
        games.length = 0;
      }

      // Rate limit protection (Giant Bomb has strict limits)
      await delay(3000);
    }

    console.log(`✅ Fetched total from Giant Bomb`);
    return games;
  } catch (err) {
    console.error('❌ Giant Bomb fetch error:', err.message);
    return games;
  }
}

// Fetch ALL games from Steam (TEMPORARILY DISABLED)
// Steam API endpoint is no longer available - GetAppList method not found
async function fetchAllSteamGames() {
  console.log('⚠️ Steam API is temporarily disabled (endpoint no longer available)');
  return [];
  /*
  // Previous implementation removed due to API endpoint being unavailable
  console.log('📥 Fetching ALL games from Steam...');
  const games = [];

  try {
    // Get complete Steam apps list
    const response = await axios.get(steamAppsUrl, { timeout: 15000 });
    const steamApps = response.data.applist.apps || [];
    
    console.log(`  Found ${steamApps.length} Steam apps total`);
    console.log(`  Processing all apps (this may take a while)...`);
    
    // Filter out non-games and process all
    const validApps = steamApps.filter(app => app.name && app.name.length > 2);
    
    for (let i = 0; i < validApps.length; i++) {
      const app = validApps[i];
      
      if (i % 1000 === 0) {
        console.log(`  Processing ${i}/${validApps.length}...`);
      }

      games.push({
        id: `steam_${app.appid}`,
        source: 'Steam',
        name: app.name,
        cover_image: `https://steamcdn-a.akamaihd.net/steam/apps/${app.appid}/library_600x900.jpg`,
        rating: 0,
        critic_rating: 'N/A',
        release_year: 'N/A',
        main_genre: 'N/A',
        platforms: ['PC'],
        description: app.name,
        steam_appid: app.appid
      });

      // Save progress every 5000 games
      if (games.length >= 5000) {
        console.log(`  💾 Saving progress... (${i} processed)`);
        await saveGames(games);
        games.length = 0;
      }
    }

    console.log(`✅ Fetched ${validApps.length} games from Steam`);
    return games;
  } catch (err) {
    console.error('❌ Steam fetch error:', err.message);
    return games;
  }
  */
}

// Fetch ALL games from TheGamesDB
async function fetchAllTheGamesDbGames() {
  if (!THEGAMESDB_API_KEY) {
    console.log('⚠️ TheGamesDB API key not configured, skipping...');
    return [];
  }

  console.log('📥 Fetching ALL games from TheGamesDB...');
  const games = [];
  
  // TheGamesDB requires specific search queries, we'll search by popular letters
  const searchTerms = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
  
  try {
    for (const term of searchTerms) {
      console.log(`  Searching for games starting with "${term}"...`);
      
      let page = 1;
      let hasMore = true;
      
      while (hasMore && page <= 100) { // Increase to get more games per search term
        try {
          const response = await axios.get(`${theGamesDbBaseUrl}/Games/ByGameName`, {
            params: {
              apikey: THEGAMESDB_API_KEY,
              name: term,
              page: page
            },
            timeout: 15000
          });

          const results = response.data.data?.games || [];
          
          if (results.length === 0) {
            hasMore = false;
            break;
          }

          for (const game of results) {
            games.push({
              id: `tgdb_${game.id}`,
              source: 'TheGamesDB',
              name: game.game_title,
              cover_image: 'N/A',
              rating: 0,
              critic_rating: 'N/A',
              release_year: game.release_date ? new Date(game.release_date).getFullYear() : 'N/A',
              main_genre: 'N/A',
              platforms: game.platform ? [game.platform.name] : [],
              description: game.overview || game.game_title
            });
          }

          page++;
          await delay(2000);
        } catch (err) {
          console.log(`    Error on page ${page}: ${err.message}`);
          hasMore = false;
        }
      }

      // Save progress after each letter
      if (games.length > 0) {
        console.log(`  💾 Saving ${games.length} games...`);
        await saveGames(games);
        games.length = 0;
      }
    }

    console.log(`✅ Fetched total from TheGamesDB`);
    return games;
  } catch (err) {
    console.error('❌ TheGamesDB fetch error:', err.message);
    return games;
  }
}

// Main population function
async function populateAllGames() {
  console.log('🚀 Starting FULL database population...');
  console.log('⚠️  This will take 1-3 hours depending on API limits\n');

  try {
    // Initialize database
    await initDatabase();
    console.log('');

    // Fetch from all sources sequentially to avoid overwhelming APIs (Steam & IGDB temporarily disabled)
    console.log('📊 Step 1/3: RAWG (estimated: 30-60 min)');
    const rawgGames = await fetchAllRawgGames();
    if (rawgGames.length > 0) await saveGames(rawgGames);
    console.log('');

    console.log('📊 Step 2/3: Giant Bomb (estimated: 10-20 min)');
    const giantBombGames = await fetchAllGiantBombGames();
    if (giantBombGames.length > 0) await saveGames(giantBombGames);
    console.log('');

    // Steam API disabled due to endpoint unavailability
    // IGDB disabled - requires App Access Token (separate from Client ID/Secret)
    console.log('📊 Step 3/3: TheGamesDB (estimated: 20-30 min)');
    const tgdbGames = await fetchAllTheGamesDbGames();
    if (tgdbGames.length > 0) await saveGames(tgdbGames);
    console.log('');

    // Show final statistics
    console.log('📈 Final Database Statistics:');
    const totalCount = await getGamesCount();
    const countBySource = await getCountBySource();
    
    console.log(`  Total games: ${totalCount.toLocaleString()}`);
    console.log('  By source:');
    Object.entries(countBySource).forEach(([source, count]) => {
      console.log(`    ${source}: ${count.toLocaleString()}`);
    });

    console.log('\n✅ FULL database population completed successfully!');
    console.log('💡 Your database now contains ALL available games from all sources');
    console.log('🚀 Start server with: npm run start:db');

  } catch (err) {
    console.error('❌ Population error:', err);
  } finally {
    await closeDatabase();
  }
}

// Run if called directly
if (require.main === module) {
  populateAllGames().catch(console.error);
}

module.exports = { populateAllGames };
