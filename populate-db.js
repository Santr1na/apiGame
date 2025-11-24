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

// IGDB API
let igdbToken = null;
let igdbTokenExpiry = null;

// Note: Steam API is temporarily disabled as the endpoint is no longer available
// const steamAppsUrl = 'https://api.steampowered.com/ISteamApps/GetAppList/v2/';
// const steamStoreUrl = 'https://store.steampowered.com/api/appdetails';

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

// Fetch games from IGDB
async function fetchIGDBGames(pages = 3) {
  if (!IGDB_CLIENT_ID || !IGDB_CLIENT_SECRET) {
    console.log('⚠️ IGDB credentials not configured, skipping...');
    return [];
  }

  console.log('📥 Fetching games from IGDB...');
  const games = [];

  try {
    for (let page = 1; page <= pages; page++) {
      console.log(`  Page ${page}/${pages}...`);
      
      await getIGDBToken();
      
      const query = `fields id,name,cover.url,rating,critic_rating,release_date,genres.name,platforms.name,summary; sort rating desc; limit 50; offset ${(page - 1) * 50};`;
      
      const response = await axios.post('https://api.igdb.com/v4/games', query, {
        headers: {
          'Authorization': `Bearer ${igdbToken}`,
          'Client-ID': IGDB_CLIENT_ID,
          'Content-Type': 'text/plain'
        },
        timeout: 15000
      });

      const results = response.data || [];
      
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

      // Rate limit protection
      await delay(1000);
    }

    console.log(`✅ Fetched ${games.length} games from IGDB`);
    return games;
  } catch (err) {
    console.error('❌ IGDB fetch error:', err.message);
    return games;
  }
}

// Fetch from RAWG
async function fetchRawgGames(pages = 5) {
  if (!RAWG_API_KEY) {
    console.log('⚠️ RAWG API key not configured, skipping...');
    return [];
  }

  console.log('📥 Fetching games from RAWG...');
  const games = [];

  try {
    for (let page = 1; page <= pages; page++) {
      console.log(`  Page ${page}/${pages}...`);
      const response = await axios.get(`${rawgBaseUrl}/games`, {
        params: {
          key: RAWG_API_KEY,
          page_size: 40,
          page: page,
          ordering: '-metacritic'
        },
        timeout: 15000
      });

      const results = response.data.results || [];
      
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

      // Rate limit protection
      await delay(1000);
    }

    console.log(`✅ Fetched ${games.length} games from RAWG`);
    return games;
  } catch (err) {
    console.error('❌ RAWG fetch error:', err.message);
    return games;
  }
}

// Fetch from Giant Bomb
async function fetchGiantBombGames(pages = 3) {
  if (!GIANT_BOMB_API_KEY) {
    console.log('⚠️ Giant Bomb API key not configured, skipping...');
    return [];
  }

  console.log('📥 Fetching games from Giant Bomb...');
  const games = [];

  try {
    for (let offset = 0; offset < pages * 100; offset += 100) {
      console.log(`  Offset ${offset}...`);
      const response = await axios.get(`${giantBombBaseUrl}/games`, {
        params: {
          api_key: GIANT_BOMB_API_KEY,
          format: 'json',
          limit: 100,
          offset: offset,
          sort: 'original_release_date:desc'
        },
        timeout: 15000
      });

      const results = response.data.results || [];
      
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

      // Rate limit protection (Giant Bomb has strict limits)
      await delay(2000);
    }

    console.log(`✅ Fetched ${games.length} games from Giant Bomb`);
    return games;
  } catch (err) {
    console.error('❌ Giant Bomb fetch error:', err.message);
    return games;
  }
}

// Fetch from Steam (TEMPORARILY DISABLED)
// Steam API endpoint is no longer available - GetAppList method not found
async function fetchSteamGames(limit = 500) {
  console.log('⚠️ Steam API is temporarily disabled (endpoint no longer available)');
  return [];
  /*
  // Previous implementation removed due to API endpoint being unavailable
  console.log('📥 Fetching games from Steam...');
  const games = [];

  try {
    // Get Steam apps list
    const response = await axios.get(steamAppsUrl, { timeout: 15000 });
    const steamApps = response.data.applist.apps || [];
    
    console.log(`  Found ${steamApps.length} Steam apps, selecting top ${limit}...`);
    
    // Filter out non-games and select popular ones
    const popularApps = steamApps
      .filter(app => app.name && app.name.length > 3)
      .slice(0, limit);

    for (let i = 0; i < popularApps.length; i++) {
      const app = popularApps[i];
      
      if (i % 50 === 0) {
        console.log(`  Processing ${i}/${popularApps.length}...`);
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

      // Small delay to avoid overwhelming the system
      if (i % 100 === 0) {
        await delay(500);
      }
    }

    console.log(`✅ Fetched ${games.length} games from Steam`);
    return games;
  } catch (err) {
    console.error('❌ Steam fetch error:', err.message);
    return games;
  }
  */
}

// Fetch from TheGamesDB
async function fetchTheGamesDbGames(pages = 3) {
  if (!THEGAMESDB_API_KEY) {
    console.log('⚠️ TheGamesDB API key not configured, skipping...');
    return [];
  }

  console.log('📥 Fetching games from TheGamesDB...');
  const games = [];

  try {
    for (let page = 1; page <= pages; page++) {
      console.log(`  Page ${page}/${pages}...`);
      const response = await axios.get(`${theGamesDbBaseUrl}/Games/ByGameName`, {
        params: {
          apikey: THEGAMESDB_API_KEY,
          name: 'a', // Search for common letter to get many results
          page: page
        },
        timeout: 15000
      });

      const results = response.data.data?.games || [];
      
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

      await delay(1500);
    }

    console.log(`✅ Fetched ${games.length} games from TheGamesDB`);
    return games;
  } catch (err) {
    console.error('❌ TheGamesDB fetch error:', err.message);
    return games;
  }
}

// Main population function
async function populateDatabase() {
  console.log('🚀 Starting database population...\n');

  try {
    // Initialize database
    await initDatabase();
    console.log('');

    // Fetch from all sources (Steam & IGDB temporarily disabled)
    const [rawgGames, giantBombGames, tgdbGames] = await Promise.all([
      fetchRawgGames(10),      // 10 pages = ~400 games (increased from 5)
      fetchGiantBombGames(3),  // 3 pages = ~300 games (increased from 2)
      // fetchSteamGames(300),   // Steam API disabled
      // fetchIGDBGames(3),      // IGDB disabled - requires App Access Token
      fetchTheGamesDbGames(3)  // 3 pages = ~150 games (increased from 2)
    ]);

    // Combine all games (Steam & IGDB temporarily disabled)
    const allGames = [
      ...rawgGames,
      ...giantBombGames,
      // ...steamGames,  // Steam API disabled
      // ...igdbGames,   // IGDB disabled - requires App Access Token
      ...tgdbGames
    ];

    console.log(`\n📊 Total games fetched: ${allGames.length}`);
    console.log('💾 Saving to database...');

    // Save in batches to avoid memory issues
    const batchSize = 50;
    for (let i = 0; i < allGames.length; i += batchSize) {
      const batch = allGames.slice(i, i + batchSize);
      await saveGames(batch);
      console.log(`  Saved ${Math.min(i + batchSize, allGames.length)}/${allGames.length} games`);
    }

    // Show statistics
    console.log('\n📈 Database Statistics:');
    const totalCount = await getGamesCount();
    const countBySource = await getCountBySource();
    
    console.log(`  Total games: ${totalCount}`);
    console.log('  By source:');
    Object.entries(countBySource).forEach(([source, count]) => {
      console.log(`    ${source}: ${count}`);
    });

    console.log('\n✅ Database population completed successfully!');
    console.log('💡 You can now use the database for fast queries without API calls');

  } catch (err) {
    console.error('❌ Population error:', err);
  } finally {
    await closeDatabase();
  }
}

// Run if called directly
if (require.main === module) {
  populateDatabase().catch(console.error);
}

module.exports = { populateDatabase };
