# 🗄️ Использование локальной базы данных

## Зачем нужна база данных?

Вместо того чтобы каждый раз обращаться к внешним API (RAWG, Giant Bomb, Steam, TheGamesDB), вы можете:
- ✅ **Загрузить игры один раз** в локальную базу данных
- ✅ **Быстрые запросы** без задержек API
- ✅ **Экономия лимитов** API (особенно важно для бесплатных тарифов)
- ✅ **Работа офлайн** - не зависите от доступности внешних API
- ✅ **Легко развернуть** на любом сервере

## 📦 Установка

1. **Установите зависимости:**
```bash
npm install
```

Это установит `sqlite3` - легковесную файловую базу данных.

## 🚀 Быстрый старт

### Шаг 1: Заполните базу данных

```bash
# Убедитесь, что у вас есть API ключи в .env файле
npm run populate
```

Этот скрипт:
- Загрузит ~800-1000 игр из всех источников
- Сохранит их в файл `games.db`
- Займет 5-10 минут (зависит от скорости API)

**Что будет загружено:**
- 📊 RAWG: ~200 игр (5 страниц по 40 игр)
- 📊 Giant Bomb: ~200 игр (2 страницы по 100 игр)
- 📊 Steam: ~300 популярных игр
- 📊 TheGamesDB: ~100 игр

### Шаг 2: Запустите сервер с базой данных

```bash
npm run start:db
```

Сервер будет использовать базу данных для всех запросов!

## 🔄 Режимы работы

### Режим 1: Только API (по умолчанию)
```bash
npm start
# или
node index.js
```
- Каждый запрос идет к внешним API
- Медленнее, но всегда свежие данные

### Режим 2: База данных + API (рекомендуется)
```bash
npm run start:db
# или
node index-with-db.js
```
- Сначала ищет в базе данных
- Если не находит - обращается к API
- Новые игры автоматически сохраняются в БД

### Режим 3: Только база данных
```bash
USE_DATABASE=true node index-with-db.js
```
- Работает только с локальными данными
- Максимальная скорость
- Не делает запросы к API

## 📊 Структура базы данных

### Таблица `games`
```sql
CREATE TABLE games (
  id TEXT PRIMARY KEY,           -- rawg_123, steam_456, etc.
  source TEXT NOT NULL,          -- RAWG, Steam, GiantBomb, TheGamesDB
  name TEXT NOT NULL,            -- Название игры
  cover_image TEXT,              -- URL обложки
  rating REAL,                   -- Рейтинг (0-5)
  critic_rating TEXT,            -- Оценка критиков
  release_year TEXT,             -- Год выпуска
  main_genre TEXT,               -- Основной жанр
  platforms TEXT,                -- JSON массив платформ
  description TEXT,              -- Описание
  steam_appid INTEGER,           -- Steam App ID (если есть)
  created_at DATETIME,           -- Дата добавления
  updated_at DATETIME            -- Дата обновления
)
```

### Индексы для быстрого поиска
- `idx_games_name` - поиск по названию
- `idx_games_source` - фильтр по источнику
- `idx_games_genre` - фильтр по жанру

## 🛠️ Управление базой данных

### Проверить количество игр
```bash
node -e "require('./db-setup').initDatabase().then(() => require('./db-setup').getGamesCount()).then(c => console.log('Games:', c))"
```

### Очистить и заполнить заново
```bash
rm games.db
npm run populate
```

### Добавить больше игр
Отредактируйте [`populate-db.js`](populate-db.js:23-26):
```javascript
// Увеличьте количество страниц
const [rawgGames, giantBombGames, steamGames, tgdbGames] = await Promise.all([
  fetchRawgGames(10),      // Было 5 → стало 10 (400 игр)
  fetchGiantBombGames(5),  // Было 2 → стало 5 (500 игр)
  fetchSteamGames(1000),   // Было 300 → стало 1000
  fetchTheGamesDbGames(5)  // Было 2 → стало 5 (250 игр)
]);
```

## 🌐 Развертывание на сервере

### Вариант 1: С предзаполненной БД (рекомендуется)

1. **Локально заполните базу:**
```bash
npm run populate
```

2. **Загрузите на сервер:**
```bash
# Скопируйте файлы на сервер
scp -r * user@your-server:/path/to/app/
```

3. **На сервере запустите:**
```bash
npm install --production
npm run start:db
```

### Вариант 2: Заполнение на сервере

1. **Загрузите код на сервер**
2. **Установите зависимости:**
```bash
npm install
```

3. **Настройте .env с API ключами**
4. **Заполните базу:**
```bash
npm run populate
```

5. **Запустите сервер:**
```bash
npm run start:db
```

### Вариант 3: Docker (самый простой)

Создайте `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --production

COPY . .

# Заполнить БД при сборке (опционально)
# RUN npm run populate

EXPOSE 3002
CMD ["npm", "run", "start:db"]
```

Запустите:
```bash
docker build -t game-api .
docker run -p 3002:3002 -v $(pwd)/games.db:/app/games.db game-api
```

## 📈 Производительность

### Без базы данных (только API):
- `/search?query=witcher` → **2-5 секунд** ⏱️
- `/popular` → **1-3 секунды** ⏱️
- Лимит запросов: **20,000/день** (RAWG)

### С базой данных:
- `/search?query=witcher` → **10-50 мс** ⚡
- `/popular` → **5-20 мс** ⚡
- Лимит запросов: **неограничен** ♾️

## 🔍 API эндпоинты с БД

Все эндпоинты работают так же, но быстрее:

```bash
# Поиск (сначала в БД, потом API)
GET /search?query=dota&limit=10

# Популярные игры (из БД)
GET /popular?limit=20

# Случайные игры (из БД)
GET /games?limit=5&page=1

# Детали игры (из БД или API)
GET /games/rawg_3498

# Статус базы данных
GET /api-status
# Ответ:
{
  "RAWG": true,
  "GiantBomb": true,
  "TheGamesDB": true,
  "Steam": true,
  "Database": true,
  "GamesInDB": 847
}
```

## 🔧 Настройка

### Переменные окружения (.env)

```env
# API ключи (для заполнения БД)
RAWG_API_KEY=your_key
GIANT_BOMB_API_KEY=your_key
THEGAMESDB_API_KEY=your_key

# Использовать базу данных (по умолчанию true)
USE_DATABASE=true

# Порт сервера
PORT=3002

# Firebase (опционально)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
```

## 🐛 Решение проблем

### База данных не создается
```bash
# Проверьте права на запись
ls -la games.db

# Пересоздайте базу
rm games.db
node -e "require('./db-setup').initDatabase().then(() => console.log('OK'))"
```

### Ошибка "SQLITE_BUSY"
База данных заблокирована другим процессом:
```bash
# Остановите все процессы Node.js
pkill node

# Перезапустите сервер
npm run start:db
```

### База данных пустая
```bash
# Проверьте количество игр
node -e "require('./db-setup').initDatabase().then(() => require('./db-setup').getGamesCount()).then(c => console.log('Games:', c))"

# Если 0 - заполните
npm run populate
```

## 📝 Примеры использования

### Пример 1: Быстрый поиск
```javascript
const { searchGames } = require('./db-setup');

// Поиск в базе данных
const results = await searchGames('witcher', 10);
console.log(`Found ${results.length} games`);
```

### Пример 2: Получить популярные игры
```javascript
const { getPopularGames } = require('./db-setup');

const popular = await getPopularGames(20);
console.log('Top 20 games:', popular);
```

### Пример 3: Добавить игру вручную
```javascript
const { saveGame } = require('./db-setup');

await saveGame({
  id: 'custom_1',
  source: 'Custom',
  name: 'My Game',
  cover_image: 'https://example.com/cover.jpg',
  rating: 4.5,
  critic_rating: '90',
  release_year: '2024',
  main_genre: 'Action',
  platforms: ['PC', 'PS5'],
  description: 'Amazing game!'
});
```

## 🎯 Рекомендации

1. **Для разработки**: используйте `npm start` (API режим)
2. **Для продакшена**: используйте `npm run start:db` (БД режим)
3. **Обновляйте БД**: раз в месяц запускайте `npm run populate`
4. **Бэкап**: регулярно копируйте файл `games.db`

## 📦 Размер базы данных

- **~1000 игр**: ~2-5 MB
- **~10,000 игр**: ~20-50 MB
- **~100,000 игр**: ~200-500 MB

SQLite отлично работает до 1 млн записей!

## 🚀 Что дальше?

- ✅ База данных настроена
- ✅ Игры загружены
- ✅ Сервер работает быстро
- 🎮 Наслаждайтесь быстрым API!

---

**Вопросы?** Проверьте логи сервера или создайте issue на GitHub.
