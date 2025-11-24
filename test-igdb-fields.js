// Тестирование валидных полей IGDB
require('dotenv').config();
const axios = require('axios');

const IGDB_CLIENT_ID = process.env.IGDB_CLIENT_ID;
const IGDB_ACCESS_TOKEN = process.env.IGDB_ACCESS_TOKEN;

async function testValidFields() {
  console.log('🔍 Тестируем валидные поля IGDB...\n');

  const fields = [
    'id', 'name', 'cover.url', 'rating', 'summary',
    'first_release_date', 'genres', 'platforms', 'game_engines'
  ];

  for (const field of fields) {
    try {
      console.log(`🧪 Тестируем поле: ${field}`);
      const query = `fields ${field}; limit 1;`;
      const response = await axios.post('https://api.igdb.com/v4/games', query, {
        headers: {
          'Authorization': `Bearer ${IGDB_ACCESS_TOKEN}`,
          'Client-ID': IGDB_CLIENT_ID,
          'Content-Type': 'text/plain'
        },
        timeout: 5000
      });
      console.log(`   ✅ ${field} - валидное поле`);
      await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
    } catch (error) {
      if (error.response?.status === 400) {
        console.log(`   ❌ ${field} - невалидное поле: ${error.response.data[0]?.cause}`);
      } else {
        console.log(`   ⚠️ ${field} - ошибка: ${error.message}`);
      }
    }
  }

  // Тест с подполями
  console.log('\n🔍 Тестируем подполя...');
  const subFields = ['genres.name', 'platforms.name', 'cover.url'];
  
  for (const field of subFields) {
    try {
      console.log(`🧪 Тестируем подполе: ${field}`);
      const query = `fields ${field}; limit 1;`;
      const response = await axios.post('https://api.igdb.com/v4/games', query, {
        headers: {
          'Authorization': `Bearer ${IGDB_ACCESS_TOKEN}`,
          'Client-ID': IGDB_CLIENT_ID,
          'Content-Type': 'text/plain'
        },
        timeout: 5000
      });
      console.log(`   ✅ ${field} - валидное подполе`);
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      if (error.response?.status === 400) {
        console.log(`   ❌ ${field} - невалидное подполе: ${error.response.data[0]?.cause}`);
      } else {
        console.log(`   ⚠️ ${field} - ошибка: ${error.message}`);
      }
    }
  }

  console.log('\n📝 Рекомендации:');
  console.log('   Используйте только валидные поля в IGDB запросах');
}

if (require.main === module) {
  testValidFields().catch(console.error);
}