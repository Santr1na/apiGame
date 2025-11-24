// Скрипт для включения IGDB в populate скрипты
const fs = require('fs');

console.log('🔧 Включаем IGDB в populate скрипты...\n');

// Обновляем populate-all-games.js
const allGamesPath = './populate-all-games.js';
let allGamesContent = fs.readFileSync(allGamesPath, 'utf8');

// Включаем IGDB в основной функции populate-all-games.js
allGamesContent = allGamesContent.replace(
  '    // Fetch from all sources sequentially to avoid overwhelming APIs (Steam & IGDB disabled)',
  '    // Fetch from all sources sequentially to avoid overwhelming APIs (Steam disabled, IGDB enabled)'
);

allGamesContent = allGamesContent.replace(
  "    console.log('📊 Step 1/3: RAWG (estimated: 30-60 min)');",
  "    console.log('📊 Step 1/4: IGDB (estimated: 15-30 min)');\n    const igdbGames = await fetchAllIGDBGames();\n    if (igdbGames.length > 0) await saveGames(igdbGames);\n    console.log('');\n\n    console.log('📊 Step 2/4: RAWG (estimated: 30-60 min)');"
);

allGamesContent = allGamesContent.replace(
  "    console.log('📊 Step 2/3: Giant Bomb (estimated: 10-20 min)');",
  "    console.log('📊 Step 3/4: Giant Bomb (estimated: 10-20 min)');"
);

allGamesContent = allGamesContent.replace(
  "    console.log('📊 Step 3/3: TheGamesDB (estimated: 20-30 min)');",
  "    console.log('📊 Step 4/4: TheGamesDB (estimated: 20-30 min)');"
);

fs.writeFileSync(allGamesPath, allGamesContent);
console.log('✅ IGDB включен в populate-all-games.js');

// Обновляем populate-db.js
const dbPath = './populate-db.js';
let dbContent = fs.readFileSync(dbPath, 'utf8');

// Включаем IGDB в основной функции populate-db.js
dbContent = dbContent.replace(
  '    // Fetch from all sources (Steam & IGDB temporarily disabled)',
  '    // Fetch from all sources (Steam disabled, IGDB enabled)'
);

dbContent = dbContent.replace(
  '    const [rawgGames, giantBombGames, tgdbGames] = await Promise.all([',
  '    const [igdbGames, rawgGames, giantBombGames, tgdbGames] = await Promise.all(['
);

dbContent = dbContent.replace(
  '      fetchRawgGames(10),      // 10 pages = ~400 games (increased from 5)',
  '      fetchIGDBGames(3),       // 3 pages = ~150 games\n      fetchRawgGames(10),      // 10 pages = ~400 games (increased from 5)'
);

dbContent = dbContent.replace(
  '      // ...igdbGames,   // IGDB disabled - requires App Access Token',
  '      ...igdbGames,     // IGDB enabled with App Access Token'
);

fs.writeFileSync(dbPath, dbContent);
console.log('✅ IGDB включен в populate-db.js');

console.log('\n🎉 IGDB успешно включен в оба скрипта!');
console.log('\n📊 Новый порядок populate (populate-all-games.js):');
console.log('   1. IGDB (15-30 мин) - ✅ Включен');
console.log('   2. RAWG (30-60 мин)');
console.log('   3. Giant Bomb (10-20 мин)');
console.log('   4. TheGamesDB (20-30 мин)');

console.log('\n📊 Новый порядок populate (populate-db.js):');
console.log('   1. IGDB (3 страницы) - ✅ Включен');
console.log('   2. RAWG (10 страниц)');
console.log('   3. Giant Bomb (3 страницы)');
console.log('   4. TheGamesDB (3 страницы)');

console.log('\n🚀 Теперь можете запускать:');
console.log('   npm run populate:all    # Полная загрузка с IGDB');
console.log('   npm run populate        # Быстрая загрузка с IGDB');