# 🚀 Быстрый запуск на локальном сервере

## Вариант 1: Быстрый тест (БЕЗ API ключей, 2 минуты)

Если хотите просто протестировать API без настройки:

```bash
# 1. Установите зависимости
npm install

# 2. Запустите демо-сервер (использует mock данные)
npm run demo
```

**Готово!** Сервер запущен на http://localhost:3002

Протестируйте:
```bash
# Проверка здоровья
curl http://localhost:3002/health

# Популярные игры
curl http://localhost:3002/popular?limit=5

# Поиск
curl http://localhost:3002/search?query=dota

# Случайные игры
curl http://localhost:3002/games?limit=3
```

---

## Вариант 2: С базой данных (БЕЗ загрузки, 5 минут)

Если хотите использовать БД, но без долгой загрузки:

```bash
# 1. Установите зависимости
npm install

# 2. Быстрая загрузка (~800 игр, 5-10 минут)
npm run populate

# 3. Запустите сервер с БД
npm run start:db
```

**Готово!** Сервер с базой данных на http://localhost:3002

---

## Вариант 3: Полная настройка (С API ключами, 30 минут)

### Шаг 1: Установка зависимостей
```bash
npm install
```

### Шаг 2: Настройка API ключей

Создайте файл `.env`:
```bash
cp .env.example .env
```

Отредактируйте `.env` и добавьте ваши API ключи:
```env
# Получите бесплатные ключи:
# RAWG: https://rawg.io/apidocs
# Giant Bomb: https://www.giantbomb.com/api/
# TheGamesDB: https://www.thegamesdb.net/

RAWG_API_KEY=ваш_ключ_rawg
GIANT_BOMB_API_KEY=ваш_ключ_giant_bomb
THEGAMESDB_API_KEY=ваш_ключ_thegamesdb

# Опционально
STEAM_API_KEY=ваш_ключ_steam
USE_DATABASE=true
PORT=3002
```

### Шаг 3: Загрузка игр (выберите один вариант)

**Вариант A: Быстрая загрузка (~800 игр, 5-10 минут)**
```bash
npm run populate
```

**Вариант B: Полная загрузка (~120,000 игр, 1-2 часа)**
```bash
npm run populate:all
```

### Шаг 4: Дедупликация (опционально)
```bash
# Проверить дубликаты
npm run deduplicate:stats

# Удалить дубликаты
npm run deduplicate
```

### Шаг 5: Запуск сервера
```bash
npm run start:db
```

**Готово!** Полноценный API на http://localhost:3002

---

## 🧪 Тестирование API

### В браузере:
Откройте в браузере:
- http://localhost:3002/health
- http://localhost:3002/popular?limit=10
- http://localhost:3002/search?query=witcher
- http://localhost:3002/games?limit=5

### С помощью curl:
```bash
# Проверка статуса
curl http://localhost:3002/health

# Популярные игры
curl http://localhost:3002/popular?limit=10

# Поиск игры
curl http://localhost:3002/search?query=witcher&limit=5

# Случайные игры
curl http://localhost:3002/games?limit=5&page=1

# Детали игры (замените ID на реальный)
curl http://localhost:3002/games/rawg_3498

# Статус API
curl http://localhost:3002/api-status
```

### С помощью JavaScript (fetch):
```javascript
// Поиск игр
fetch('http://localhost:3002/search?query=witcher&limit=5')
  .then(res => res.json())
  .then(data => console.log(data));

// Популярные игры
fetch('http://localhost:3002/popular?limit=10')
  .then(res => res.json())
  .then(data => console.log(data));
```

---

## 📊 Проверка базы данных

### Количество игр в БД:
```bash
node -e "require('./db-setup').initDatabase().then(() => require('./db-setup').getGamesCount()).then(c => console.log('Games:', c))"
```

### Статистика по источникам:
```bash
node -e "require('./db-setup').initDatabase().then(() => require('./db-setup').getCountBySource()).then(c => console.log(c))"
```

### Прямой доступ к SQLite:
```bash
# Установите sqlite3 (если нет)
# Ubuntu/Debian: sudo apt install sqlite3
# macOS: brew install sqlite3

# Откройте БД
sqlite3 games.db

# SQL запросы
SELECT COUNT(*) FROM games;
SELECT source, COUNT(*) FROM games GROUP BY source;
SELECT * FROM games LIMIT 5;
.quit
```

---

## 🔧 Решение проблем

### Ошибка "Cannot find module"
```bash
# Переустановите зависимости
rm -rf node_modules package-lock.json
npm install
```

### Ошибка "EADDRINUSE" (порт занят)
```bash
# Измените порт в .env
PORT=3003

# Или остановите процесс на порту 3002
lsof -ti:3002 | xargs kill -9
```

### Ошибка "API key not configured"
```bash
# Проверьте .env файл
cat .env

# Убедитесь что ключи добавлены
# Или используйте демо режим
npm run demo
```

### База данных пустая
```bash
# Проверьте количество игр
node -e "require('./db-setup').initDatabase().then(() => require('./db-setup').getGamesCount()).then(c => console.log('Games:', c))"

# Если 0 - загрузите игры
npm run populate
```

---

## 📝 Рекомендуемый порядок для первого запуска

### Самый быстрый способ (2 минуты):
```bash
npm install
npm run demo
# Откройте http://localhost:3002/health
```

### С базой данных (15 минут):
```bash
npm install
cp .env.example .env
# Добавьте API ключи в .env
npm run populate
npm run start:db
# Откройте http://localhost:3002/search?query=test
```

### Полная настройка (2 часа):
```bash
npm install
cp .env.example .env
# Добавьте API ключи в .env
npm run populate:all
npm run deduplicate
npm run start:db
# Откройте http://localhost:3002/api-status
```

---

## ✅ Чеклист быстрого запуска

- [ ] Установлен Node.js (v14+)
- [ ] Выполнено `npm install`
- [ ] Выбран вариант запуска (demo/populate/populate:all)
- [ ] Сервер запущен
- [ ] Протестирован endpoint `/health`
- [ ] Протестирован поиск `/search?query=test`

**Готово!** Ваш игровой API работает! 🎮

---

## 🌐 Следующие шаги

1. **Интеграция с фронтендом** - используйте API в вашем приложении
2. **Развертывание** - разместите на сервере (Heroku, DigitalOcean, AWS)
3. **Кастомизация** - добавьте свои эндпоинты
4. **Мониторинг** - настройте логирование и аналитику

Документация:
- [README.md](README.md) - общая информация
- [DATABASE_GUIDE.md](DATABASE_GUIDE.md) - работа с БД
- [QUICK_START.md](QUICK_START.md) - быстрый старт
