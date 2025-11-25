const axios = require('axios');

const API_BASE = 'http://localhost:3002';
const API_DB_BASE = 'http://localhost:3003'; // Assuming different port for DB version

async function testProcessedEndpoint(baseUrl, name) {
  console.log(`\nTesting ${name} - ${baseUrl}`);

  // Test with some sample game IDs (you may need to adjust these based on your actual data)
  const testIds = [
    'igdb_732',  // The Witcher 3 (example)
    'rawg_123',  // Example RAWG ID
  ];

  for (const gameId of testIds) {
    try {
      console.log(`\n=== Testing ${gameId} ===`);
      
      // Test the new processed endpoint
      const processedResponse = await axios.get(`${baseUrl}/games/${gameId}/processed`);
      const processedData = processedResponse.data;
      
      console.log('✅ Processed endpoint response:');
      console.log(`- ID: ${processedData.id}`);
      console.log(`- Name: ${processedData.name}`);
      console.log(`- Genres: ${processedData.genres.join(', ')}`);
      console.log(`- Platforms: ${processedData.platforms.join(', ')}`);
      console.log(`- Release Date: ${processedData.release_date}`);
      console.log(`- Rating: ${processedData.rating} (${processedData.rating_type})`);
      console.log(`- Cover Image: ${processedData.cover_image}`);
      console.log(`- Age Ratings: ${processedData.age_ratings.join(', ')}`);
      console.log(`- Summary: ${processedData.summary.substring(0, 100)}...`);
      console.log(`- Developers: ${processedData.developers.join(', ')}`);
      console.log(`- Videos: ${processedData.videos.length} videos`);
      console.log(`- Similar Games: ${processedData.similar_games.length} games`);
      console.log(`- Favorite Count: ${processedData.favorite}`);
      console.log(`- Status Counts: Playing=${processedData.playing}, Will Play=${processedData.ill_play}, Passed=${processedData.passed}`);
      
      // Validate structure
      if (validateStructure(processedData)) {
        console.log('✅ Structure validation passed');
      }
      
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`❌ Game ${gameId} not found (expected for demo IDs)`);
      } else if (error.code === 'ECONNREFUSED') {
        console.log(`❌ ${name} server not running. Please start the server first.`);
      } else {
        console.log(`❌ Error testing ${gameId}:`, error.response?.data || error.message);
      }
    }
  }
}

// Test the structure matches the expected format
function validateStructure(data) {
  const expectedFields = [
    'id', 'name', 'genres', 'platforms', 'release_date', 'rating', 
    'rating_type', 'cover_image', 'age_ratings', 'summary', 'developers', 
    'videos', 'similar_games', 'favorite', 'playing', 'ill_play', 
    'passed', 'postponed', 'abandoned'
  ];

  const missingFields = expectedFields.filter(field => !(field in data));
  
  if (missingFields.length > 0) {
    console.log(`❌ Missing fields: ${missingFields.join(', ')}`);
    return false;
  }
  
  // Validate data types
  if (!Array.isArray(data.genres) || !Array.isArray(data.platforms) || !Array.isArray(data.age_ratings)) {
    console.log('❌ Arrays are not properly formatted');
    return false;
  }
  
  if (typeof data.favorite !== 'number' || typeof data.rating !== 'number') {
    console.log('❌ Numeric fields are not properly formatted');
    return false;
  }
  
  console.log('✅ All required fields present and correctly formatted');
  return true;
}

async function runTests() {
  console.log('🎮 Game Endpoint Structure Test Suite');
  console.log('=====================================\n');
  
  // Test regular API server
  await testProcessedEndpoint(API_BASE, 'Regular API Server');
  
  // Test database API server
  await testProcessedEndpoint(API_DB_BASE, 'Database API Server');
  
  console.log('\n📋 Test completed!');
  console.log('\nTo manually test the endpoints:');
  console.log('1. Start the regular server: node index.js');
  console.log('2. Start the database server: node index-with-db.js');
  console.log('3. Test regular endpoint: curl http://localhost:3002/games/rawg_123/processed');
  console.log('4. Test database endpoint: curl http://localhost:3003/games/rawg_123/processed');
  console.log('\nBoth servers support the same /games/:id/processed endpoint structure!');
}

if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testProcessedEndpoint, validateStructure };