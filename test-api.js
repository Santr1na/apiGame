const axios = require('axios');

const BASE_URL = 'http://localhost:3002';

// Test configuration
const TEST_DELAY = 1000; // 1 second delay between requests

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testEndpoint(name, url, expectedStatus = 200) {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    console.log(`📡 GET ${url}`);
    
    const response = await axios.get(`${BASE_URL}${url}`, { timeout: 10000 });
    
    if (response.status === expectedStatus) {
      console.log(`✅ SUCCESS: ${response.status}`);
      
      // Show sample data
      const data = response.data;
      if (Array.isArray(data)) {
        console.log(`📊 Response: Array with ${data.length} items`);
        if (data.length > 0) {
          console.log(`   Sample item:`, {
            id: data[0].id,
            name: data[0].name,
            source: data[0].source
          });
        }
      } else {
        console.log(`📊 Response: Object`, Object.keys(data));
      }
      
      return { success: true, data, status: response.status };
    } else {
      console.log(`⚠️ UNEXPECTED STATUS: ${response.status}`);
      return { success: false, status: response.status, data: response.data };
    }
  } catch (error) {
    console.log(`❌ FAILED: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Data: ${error.response.data}`);
    }
    return { success: false, error: error.message, status: error.response?.status };
  }
}

async function runTests() {
  console.log('🎮 Multi-Source Games API Test Suite');
  console.log('=====================================');
  
  const results = [];
  
  // Test 1: Health Check
  results.push(await testEndpoint('Health Check', '/health'));
  await sleep(TEST_DELAY);
  
  // Test 2: API Status
  results.push(await testEndpoint('API Status', '/api-status'));
  await sleep(TEST_DELAY);
  
  // Test 3: Popular Games
  results.push(await testEndpoint('Popular Games (default)', '/popular'));
  await sleep(TEST_DELAY);
  
  // Test 4: Popular Games with limit
  results.push(await testEndpoint('Popular Games (limited)', '/popular?limit=3'));
  await sleep(TEST_DELAY);
  
  // Test 5: Games List
  results.push(await testEndpoint('Games List', '/games'));
  await sleep(TEST_DELAY);
  
  // Test 6: Games List with pagination
  results.push(await testEndpoint('Games List (page 2)', '/games?page=2&limit=3'));
  await sleep(TEST_DELAY);
  
  // Test 7: Search Games
  results.push(await testEndpoint('Search: "witcher"', '/search?query=witcher&limit=3'));
  await sleep(TEST_DELAY);
  
  // Test 8: Search Games (different term)
  results.push(await testEndpoint('Search: "minecraft"', '/search?query=minecraft&limit=3'));
  await sleep(TEST_DELAY);
  
  // Test 9: Search Games (empty query - should fail)
  results.push(await testEndpoint('Search: Empty Query', '/search', 400));
  await sleep(TEST_DELAY);
  
  // Summary
  console.log('\n📋 Test Results Summary');
  console.log('=======================');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.length - passed;
  
  results.forEach((result, index) => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${index + 1}. ${status} - ${result.status || 'ERROR'}`);
  });
  
  console.log(`\n📊 Overall Results:`);
  console.log(`   Total Tests: ${results.length}`);
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Success Rate: ${Math.round((passed / results.length) * 100)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! The API is working correctly.');
    console.log('\n💡 Note: Some endpoints may require API keys to return full data.');
    console.log('   - Popular games require RAWG API key');
    console.log('   - Search results may be limited without API keys');
    console.log('   - Steam data should work without API keys');
  } else {
    console.log('\n⚠️ Some tests failed. Check the API configuration and network connectivity.');
  }
  
  console.log('\n🔧 Configuration Tips:');
  console.log('   - Set RAWG_API_KEY for full popular games functionality');
  console.log('   - Set GIANT_BOMB_API_KEY for enhanced search results');
  console.log('   - Set THEGAMESDB_API_KEY for additional game coverage');
  console.log('   - STEAM works without API key for basic functionality');
}

// Check if server is running
async function checkServer() {
  try {
    await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('🔍 Checking if server is running...');
  
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.log('❌ Server is not running on localhost:3002');
    console.log('\n💡 To start the server, run:');
    console.log('   npm start');
    console.log('\n   Or directly:');
    console.log('   node index.js');
    return;
  }
  
  console.log('✅ Server is running!');
  await runTests();
}

// Run the tests
main().catch(console.error);