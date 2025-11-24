// Диагностика IGDB запроса
require('dotenv').config();
const axios = require('axios');

const IGDB_CLIENT_ID = process.env.IGDB_CLIENT_ID;
const IGDB_ACCESS_TOKEN = process.env.IGDB_ACCESS_TOKEN;

async function testIGDBQuery() {
  console.log('🔍 Тестируем IGDB запрос пошагово...\n');

  try {
    // Тест 1: Простейший запрос
    console.log('1️⃣ Тест простого запроса...');
    const query1 = 'fields id,name; limit 1;';
    const response1 = await axios.post('https://api.igdb.com/v4/games', query1, {
      headers: {
        'Authorization': `Bearer ${IGDB_ACCESS_TOKEN}`,
        'Client-ID': IGDB_CLIENT_ID,
        'Content-Type': 'text/plain'
      },
      timeout: 10000
    });
    console.log('✅ Простой запрос работает');
    console.log(`   Результат: ${JSON.stringify(response1.data[0], null, 2)}\n`);

    // Тест 2: Запрос с cover
    console.log('2️⃣ Тест с полем cover...');
    const query2 = 'fields id,name,cover.url; limit 1;';
    const response2 = await axios.post('https://api.igdb.com/v4/games', query2, {
      headers: {
        'Authorization': `Bearer ${IGDB_ACCESS_TOKEN}`,
        'Client-ID': IGDB_CLIENT_ID,
        'Content-Type': 'text/plain'
      },
      timeout: 10000
    });
    console.log('✅ Запрос с cover работает\n');

    // Тест 3: Запрос с offset
    console.log('3️⃣ Тест с offset...');
    const query3 = 'fields id,name; limit 1; offset 0;';
    const response3 = await axios.post('https://api.igdb.com/v4/games', query3, {
      headers: {
        'Authorization': `Bearer ${IGDB_ACCESS_TOKEN}`,
        'Client-ID': IGDB_CLIENT_ID,
        'Content-Type': 'text/plain'
      },
      timeout: 10000
    });
    console.log('✅ Запрос с offset работает\n');

    // Тест 4: Полный запрос как в populate
    console.log('4️⃣ Тест полного запроса...');
    const query4 = 'fields id,name,cover.url,rating,release_date,genres.name,platforms.name,summary; limit 50; offset 0;';
    const response4 = await axios.post('https://api.igdb.com/v4/games', query4, {
      headers: {
        'Authorization': `Bearer ${IGDB_ACCESS_TOKEN}`,
        'Client-ID': IGDB_CLIENT_ID,
        'Content-Type': 'text/plain'
      },
      timeout: 10000
    });
    console.log('✅ Полный запрос работает');
    console.log(`   Получено игр: ${response4.data.length}\n`);

    console.log('🎉 Все тесты прошли успешно!');

  } catch (error) {
    console.log('❌ Ошибка в тесте:');
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.log(`   ${error.message}`);
    }
  }
}

if (require.main === module) {
  testIGDBQuery().catch(console.error);
}