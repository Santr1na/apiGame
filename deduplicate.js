const {
  initDatabase,
  db,
  getGamesCount,
  getCountBySource,
  closeDatabase
} = require('./db-setup');

// Normalize game name for comparison
function normalizeGameName(name) {
  return name
    .toLowerCase()
    .replace(/[™®©]/g, '') // Remove trademark symbols
    .replace(/[:\-–—]/g, ' ') // Replace punctuation with space
    .replace(/\s+/g, ' ') // Normalize spaces
    .replace(/\bthe\b/g, '') // Remove "the"
    .replace(/\bgame of the year\b/gi, '') // Remove GOTY
    .replace(/\bedition\b/gi, '') // Remove edition
    .replace(/\bremastered\b/gi, '') // Remove remastered
    .trim();
}

// Find duplicate games
async function findDuplicates() {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT name, COUNT(*) as count, GROUP_CONCAT(id) as ids, GROUP_CONCAT(source) as sources
      FROM games
      GROUP BY LOWER(TRIM(name))
      HAVING count > 1
      ORDER BY count DESC
    `;
    
    db.all(query, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Merge duplicate games - keep the best version
async function mergeDuplicates() {
  console.log('🔍 Searching for duplicate games...\n');
  
  try {
    await initDatabase();
    
    const duplicates = await findDuplicates();
    console.log(`Found ${duplicates.length} games with duplicates\n`);
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!');
      return;
    }
    
    let mergedCount = 0;
    let deletedCount = 0;
    
    for (const dup of duplicates) {
      const ids = dup.ids.split(',');
      const sources = dup.sources.split(',');
      
      console.log(`📝 "${dup.name}" found in ${dup.count} sources: ${sources.join(', ')}`);
      
      // Get full details of all versions
      const versions = await Promise.all(
        ids.map(id => getGameDetails(id))
      );
      
      // Choose the best version (priority: IGDB > RAWG > Giant Bomb > Steam > TheGamesDB)
      const sourcePriority = { 'IGDB': 5, 'RAWG': 4, 'GiantBomb': 3, 'Steam': 2, 'TheGamesDB': 1 };
      
      versions.sort((a, b) => {
        // First by source priority
        const priorityDiff = (sourcePriority[b.source] || 0) - (sourcePriority[a.source] || 0);
        if (priorityDiff !== 0) return priorityDiff;
        
        // Then by rating
        return (b.rating || 0) - (a.rating || 0);
      });
      
      const bestVersion = versions[0];
      const toDelete = versions.slice(1);
      
      console.log(`  ✅ Keeping: ${bestVersion.id} (${bestVersion.source})`);
      console.log(`  ❌ Removing: ${toDelete.map(v => `${v.id} (${v.source})`).join(', ')}\n`);
      
      // Delete duplicates
      for (const game of toDelete) {
        await deleteGame(game.id);
        deletedCount++;
      }
      
      mergedCount++;
    }
    
    console.log('\n📊 Deduplication Summary:');
    console.log(`  Games merged: ${mergedCount}`);
    console.log(`  Duplicates removed: ${deletedCount}`);
    
    const finalCount = await getGamesCount();
    const countBySource = await getCountBySource();
    
    console.log(`\n📈 Final Database Statistics:`);
    console.log(`  Total unique games: ${finalCount.toLocaleString()}`);
    console.log('  By source:');
    Object.entries(countBySource).forEach(([source, count]) => {
      console.log(`    ${source}: ${count.toLocaleString()}`);
    });
    
    console.log('\n✅ Deduplication completed!');
    
  } catch (err) {
    console.error('❌ Error during deduplication:', err);
  } finally {
    await closeDatabase();
  }
}

// Get game details by ID
function getGameDetails(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM games WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve({
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
      });
    });
  });
}

// Delete game by ID
function deleteGame(id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM games WHERE id = ?', [id], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// Show duplicate statistics without merging
async function showDuplicateStats() {
  console.log('🔍 Analyzing duplicates...\n');
  
  try {
    await initDatabase();
    
    const duplicates = await findDuplicates();
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!');
      return;
    }
    
    console.log(`📊 Duplicate Statistics:\n`);
    console.log(`Total games with duplicates: ${duplicates.length}`);
    
    const totalDuplicates = duplicates.reduce((sum, dup) => sum + (dup.count - 1), 0);
    console.log(`Total duplicate entries: ${totalDuplicates}`);
    
    console.log(`\nTop 10 most duplicated games:\n`);
    duplicates.slice(0, 10).forEach((dup, i) => {
      console.log(`${i + 1}. "${dup.name}" - ${dup.count} versions (${dup.sources})`);
    });
    
    const currentCount = await getGamesCount();
    const uniqueCount = currentCount - totalDuplicates;
    
    console.log(`\n📈 Database Stats:`);
    console.log(`  Current total: ${currentCount.toLocaleString()}`);
    console.log(`  Unique games: ${uniqueCount.toLocaleString()}`);
    console.log(`  Duplicates: ${totalDuplicates.toLocaleString()}`);
    console.log(`  Space savings after dedup: ${((totalDuplicates / currentCount) * 100).toFixed(1)}%`);
    
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await closeDatabase();
  }
}

// Run based on command line argument
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'stats') {
    showDuplicateStats().catch(console.error);
  } else {
    mergeDuplicates().catch(console.error);
  }
}

module.exports = {
  findDuplicates,
  mergeDuplicates,
  showDuplicateStats,
  normalizeGameName
};
