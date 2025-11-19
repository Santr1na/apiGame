const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create database connection
const dbPath = path.join(__dirname, 'games.db');
const db = new sqlite3.Database(dbPath);

// Initialize database schema
function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Games table
      db.run(`
        CREATE TABLE IF NOT EXISTS games (
          id TEXT PRIMARY KEY,
          source TEXT NOT NULL,
          name TEXT NOT NULL,
          cover_image TEXT,
          rating REAL,
          critic_rating TEXT,
          release_year TEXT,
          main_genre TEXT,
          platforms TEXT,
          description TEXT,
          steam_appid INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('Error creating games table:', err);
          reject(err);
        }
      });

      // Search index for faster queries
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_games_name ON games(name COLLATE NOCASE)
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_games_source ON games(source)
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_games_genre ON games(main_genre)
      `);

      // Cache metadata table
      db.run(`
        CREATE TABLE IF NOT EXISTS cache_metadata (
          key TEXT PRIMARY KEY,
          value TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('Error creating cache_metadata table:', err);
          reject(err);
        } else {
          console.log('✅ Database initialized successfully');
          resolve();
        }
      });
    });
  });
}

// Save game to database
function saveGame(game) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO games 
      (id, source, name, cover_image, rating, critic_rating, release_year, 
       main_genre, platforms, description, steam_appid, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    stmt.run(
      game.id,
      game.source,
      game.name,
      game.cover_image,
      game.rating,
      game.critic_rating,
      game.release_year,
      game.main_genre,
      JSON.stringify(game.platforms || []),
      game.description,
      game.steam_appid || null,
      (err) => {
        if (err) {
          console.error('Error saving game:', err);
          reject(err);
        } else {
          resolve();
        }
      }
    );

    stmt.finalize();
  });
}

// Save multiple games
async function saveGames(games) {
  const promises = games.map(game => saveGame(game));
  return Promise.all(promises);
}

// Get game by ID
function getGameById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM games WHERE id = ?', [id], (err, row) => {
      if (err) {
        reject(err);
      } else if (row) {
        resolve(parseGameRow(row));
      } else {
        resolve(null);
      }
    });
  });
}

// Search games by name
function searchGames(query, limit = 10) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM games 
       WHERE name LIKE ? 
       ORDER BY rating DESC 
       LIMIT ?`,
      [`%${query}%`, limit],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(parseGameRow));
        }
      }
    );
  });
}

// Get popular games (by rating)
function getPopularGames(limit = 10) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM games 
       WHERE rating > 0 
       ORDER BY rating DESC, critic_rating DESC 
       LIMIT ?`,
      [limit],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(parseGameRow));
        }
      }
    );
  });
}

// Get random games
function getRandomGames(limit = 10) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM games 
       ORDER BY RANDOM() 
       LIMIT ?`,
      [limit],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(parseGameRow));
        }
      }
    );
  });
}

// Get games by source
function getGamesBySource(source, limit = 10) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM games 
       WHERE source = ? 
       ORDER BY rating DESC 
       LIMIT ?`,
      [source, limit],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(parseGameRow));
        }
      }
    );
  });
}

// Get total games count
function getGamesCount() {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM games', (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row.count);
      }
    });
  });
}

// Get count by source
function getCountBySource() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT source, COUNT(*) as count 
       FROM games 
       GROUP BY source`,
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const counts = {};
          rows.forEach(row => {
            counts[row.source] = row.count;
          });
          resolve(counts);
        }
      }
    );
  });
}

// Parse database row to game object
function parseGameRow(row) {
  return {
    id: row.id,
    source: row.source,
    name: row.name,
    cover_image: row.cover_image,
    rating: row.rating,
    critic_rating: row.critic_rating,
    release_year: row.release_year,
    main_genre: row.main_genre,
    platforms: JSON.parse(row.platforms || '[]'),
    description: row.description,
    steam_appid: row.steam_appid
  };
}

// Set cache metadata
function setCacheMetadata(key, value) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR REPLACE INTO cache_metadata (key, value, updated_at) 
       VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [key, JSON.stringify(value)],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

// Get cache metadata
function getCacheMetadata(key) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT value FROM cache_metadata WHERE key = ?',
      [key],
      (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          resolve(JSON.parse(row.value));
        } else {
          resolve(null);
        }
      }
    );
  });
}

// Close database connection
function closeDatabase() {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        reject(err);
      } else {
        console.log('Database connection closed');
        resolve();
      }
    });
  });
}

module.exports = {
  db,
  initDatabase,
  saveGame,
  saveGames,
  getGameById,
  searchGames,
  getPopularGames,
  getRandomGames,
  getGamesBySource,
  getGamesCount,
  getCountBySource,
  setCacheMetadata,
  getCacheMetadata,
  closeDatabase
};
