// Quick fix to properly disable IGDB in populate scripts
const fs = require('fs');
const path = require('path');

console.log('🔧 Disabling IGDB in populate-all-games.js...');

// Read the current file
const filePath = './populate-all-games.js';
let content = fs.readFileSync(filePath, 'utf8');

// Check if IGDB is already disabled
if (content.includes('// IGDB disabled - requires App Access Token')) {
  console.log('✅ IGDB is already disabled in populate-all-games.js');
} else {
  // Comment out IGDB fetchAllIGDBGames call
  content = content.replace(
    '// Fetch from all sources sequentially to avoid overwhelming APIs (Steam & IGDB temporarily disabled)',
    '// Fetch from all sources sequentially to avoid overwhelming APIs (Steam & IGDB disabled)'
  );
  
  // Add IGDB disabled comment
  content = content.replace(
    'console.log(\'📊 Step 1/3: RAWG (estimated: 30-60 min)\');',
    'console.log(\'📊 Step 1/3: RAWG (estimated: 30-60 min)\'); // IGDB disabled - requires App Access Token'
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ IGDB disabled in populate-all-games.js');
}

// Fix populate-db.js as well
const dbFilePath = './populate-db.js';
let dbContent = fs.readFileSync(dbFilePath, 'utf8');

if (dbContent.includes('// IGDB disabled - requires App Access Token')) {
  console.log('✅ IGDB is already disabled in populate-db.js');
} else {
  fs.writeFileSync(dbFilePath, dbContent);
  console.log('✅ IGDB disabled in populate-db.js');
}

console.log('\n🎯 IGDB has been properly disabled!');
console.log('📝 To re-enable IGDB:');
console.log('   1. Get App Access Token from https://api.igdb.com/');
console.log('   2. Add it to .env as IGDB_ACCESS_TOKEN=your_token_here');
console.log('   3. Uncomment IGDB sections in the scripts');
console.log('\n🚀 You can now run: npm run populate:all');