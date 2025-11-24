// Скрипт для тестирования IGDB App Access Token
require('dotenv').config();
const axios = require('axios');

const IGDB_CLIENT_ID = process.env.IGDB_CLIENT_ID;
const IGDB_CLIENT_SECRET = process.env.IGDB_CLIENT_SECRET;
const IGDB_ACCESS_TOKEN = process.env.IGDB_ACCESS_TOKEN;

console.log('🔍 Тестирование IGDB подключения...\n');

// Проверяем наличие всех необходимых credentials
if (!IGDB_CLIENT_ID) {
  console.log('❌ IGDB_CLIENT_ID не найден в .env');
  process.exit(1);
}
if (!IGDB_CLIENT_SECRET) {
  console.log('❌ IGDB_CLIENT_SECRET не найден в .env');
  process.exit(1);
}
if (!IGDB_ACCESS_TOKEN) {
  console.log('❌ IGDB_ACCESS_TOKEN не найден в .env');
  console.log('📝 Для получения токена:');
  console.log('   1. Перейдите на https://api.igdb.com/');
  console.log('   2. Войдите с IGDB credentials');
  console.log('   3. Сгенерируйте App Access Token');
  console.log('   4. Добавьте его в .env как IGDB_ACCESS_TOKEN=ваш_токен');
  process.exit(1);
}

console.log('✅ IGDB credentials найдены в .env');
console.log(`   Client ID: ${IGDB_CLIENT_ID.substring(0, 10)}...`);
console.log(`   Access Token: ${IGDB_ACCESS_TOKEN.substring(0, 10)}...`);

async function testIGDBConnection() {
  try {
    console.log('\n🔄 Тестируем запрос к IGDB API...');
    
    // Тестовый запрос - получаем 1 игру
    const query = 'fields id,name; limit 1;';
    const response = await axios.post('https://api.igdb.com/v4/games', query, {
      headers: {
        'Authorization': `Bearer ${IGDB_ACCESS_TOKEN}`,
        'Client-ID': IGDB_CLIENT_ID,
        'Content-Type': 'text/plain'
      },
      timeout: 10000
    });

    if (response.data && response.data.length > 0) {
      console.log('✅ IGDB подключение успешно!');
      console.log(`📋 Тестовая игра: ${response.data[0].name} (ID: ${response.data[0].id})`);
      return true;
    } else {
      console.log('⚠️ IGDB ответ получен, но данные пустые');
      return false;
    }
  } catch (error) {
    console.log('❌ Ошибка подключения к IGDB:');
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Message: ${error.response.data.message || error.response.statusText}`);
      if (error.response.data.Tip_1) {
        console.log(`   Tip: ${error.response.data.Tip_1}`);
      }
      if (error.response.data.Tip_2) {
        console.log(`   Tip: ${error.response.data.Tip_2}`);
      }
      if (error.response.data.Tip_3) {
        console.log(`   Tip: ${error.response.data.Tip_3}`);
      }
    } else {
      console.log(`   ${error.message}`);
    }
    return false;
  }
}

// Проверяем, является ли токен временным (client credentials)
async function testTokenType() {
  try {
    console.log('\n🔍 Проверяем тип токена...');
    
    const response = await axios.post('https://api.igdb.com/oauth2/token', 
      new URLSearchParams({
        client_id: IGDB_CLIENT_ID,
        client_secret: IGDB_CLIENT_SECRET,
        grant_type: 'client_credentials'
      }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 5000
    });

    console.log('⚠️ Предупреждение: используется client credentials токен');
    console.log('   Это может быть недостаточно для полного доступа к API');
    console.log('   Рекомендуется использовать App Access Token');
    
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ App Access Token обнаружен (не client credentials)');
    } else {
      console.log('ℹ️ Не удалось определить тип токена');
    }
  }
}

// Основная функция
async function main() {
  const isWorking = await testIGDBConnection();
  await testTokenType();
  
  console.log('\n📋 Рекомендации:');
  if (isWorking) {
    console.log('🎉 IGDB настроен правильно! Можно включать в populate скрипты.');
  } else {
    console.log('🔧 Требуется исправить IGDB настройки перед включением.');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testIGDBConnection };