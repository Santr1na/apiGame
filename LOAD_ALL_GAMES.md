# 🎮 Загрузка ВСЕХ игр в базу данных

## Два варианта заполнения БД

### Вариант 1: Быстрая загрузка (~800 игр, 5-10 минут)
```bash
npm run populate
```
**Что загрузится:**
- RAWG: ~200 игр
- Giant Bomb: ~200 игр  
- Steam: ~300 игр
- TheGamesDB: ~100 игр
- **Итого: ~800 игр**

### Вариант 2: Полная загрузка (ВСЕ игры, 1-3 часа) ⭐
```bash
npm run populate:all
```
**Что загрузится:**
- RAWG: ~4,000 игр (100 страниц)
- Giant Bomb: ~10,000 игр (100 запросов)
- Steam: ~50,000+ игр (все доступные)
- TheGamesDB: ~5,000+ игр (поиск по всем буквам)
- **Итого: ~60,000-70,000 игр** 🚀

---

## ⚠️ Важная информация

### Лимиты API (бесплатные тарифы):
- **RAWG**: 20,000 запросов/день
- **Giant Bomb**: 200 запросов/день
- **TheGamesDB**: 1,000 запросов/час
- **Steam**: Без лимитов

### Время загрузки (полная):
1. **RAWG**: 30-60 минут (100 страниц × 1 сек задержка)
2. **Giant Bomb**: 10-20 минут (100 запросов × 3 сек задержка)
3. **Steam**: 5-10 минут (загрузка всего списка)
4. **TheGamesDB**: 20-30 минут (поиск по 36 символам)

**Общее время: 1-3 часа**

### Размер базы данных:
- ~1,000 игр = 2-5 MB
- ~10,000 игр = 20-50 MB
- ~60,000 игр = 200-500 MB

---

## 🚀 Пошаговая инструкция

### Шаг 1: Подготовка
```bash
# Установите зависимости
npm install

# Настройте .env файл с API ключами
cp .env.example .env
# Отредактируйте .env и добавьте ваши ключи
```

### Шаг 2: Запустите загрузку
```bash
# Для полной загрузки ВСЕХ игр
npm run populate:all
```

### Шаг 3: Мониторинг процесса
Вы увидите прогресс в консоли:
```
🚀 Starting FULL database population...
⚠️  This will take 1-3 hours depending on API limits

📊 Step 1/4: RAWG (estimated: 30-60 min)
📥 Fetching ALL games from RAWG...
  Page 1/100...
  Page 2/100...
  💾 Saving progress... (400 games so far)
  ...

📊 Step 2/4: Giant Bomb (estimated: 10-20 min)
📥 Fetching ALL games from Giant Bomb...
  Offset 0...
  Offset 100...
  ...

📊 Step 3/4: Steam (estimated: 5-10 min)
📥 Fetching ALL games from Steam...
  Found 150000 Steam apps total
  Processing 0/150000...
  Processing 1000/150000...
  ...

📊 Step 4/4: TheGamesDB (estimated: 20-30 min)
📥 Fetching ALL games from TheGamesDB...
  Searching for games starting with "a"...
  Searching for games starting with "b"...
  ...

📈 Final Database Statistics:
  Total games: 65,432
  By source:
    RAWG: 4,000
    GiantBomb: 10,000
    Steam: 48,432
    TheGamesDB: 3,000

✅ FULL database population completed successfully!
```

### Шаг 4: Запустите сервер
```bash
npm run start:db
```

---

## 💡 Советы и рекомендации

### Если процесс прервался:
Не волнуйтесь! Скрипт сохраняет прогресс каждые несколько сотен игр. Просто запустите снова:
```bash
npm run populate:all
```
Дубликаты не будут созданы (используется `INSERT OR REPLACE`).

### Если хотите загрузить еще больше:
Отредактируйте [`populate-all-games.js`](populate-all-games.js):
```javascript
// Строка 32: увеличьте maxPages
const maxPages = 200; // Было 100 → стало 200

// Строка 98: увеличьте maxRequests  
const maxRequests = 200; // Было 100 → стало 200
```

### Если API лимит исчерпан:
Подождите 24 часа и продолжите:
```bash
# Скрипт продолжит с того места, где остановился
npm run populate:all
```

### Оптимизация для продакшена:
```bash
# 1. Загрузите все игры локально
npm run populate:all

# 2. Сожмите базу данных
sqlite3 games.db "VACUUM;"

# 3. Создайте бэкап
cp games.db games.db.backup

# 4. Загрузите на сервер
scp games.db user@server:/path/to/app/
```

---

## 📊 Сравнение вариантов

| Параметр | Быстрая загрузка | Полная загрузка |
|----------|------------------|-----------------|
| Команда | `npm run populate` | `npm run populate:all` |
| Время | 5-10 минут | 1-3 часа |
| Игр | ~800 | ~60,000+ |
| Размер БД | ~5 MB | ~300 MB |
| Использование API | Минимальное | Максимальное |
| Рекомендуется для | Тестирования | Продакшена |

---

## 🔧 Устранение проблем

### Ошибка "Rate limit exceeded"
```bash
# Подождите 24 часа или используйте быструю загрузку
npm run populate
```

### Ошибка "SQLITE_BUSY"
```bash
# Остановите все процессы Node.js
pkill node

# Удалите lock файлы
rm games.db-journal games.db-shm games.db-wal

# Запустите снова
npm run populate:all
```

### Недостаточно места на диске
```bash
# Проверьте свободное место (нужно минимум 1 GB)
df -h

# Или используйте быструю загрузку
npm run populate
```

---

## 🎯 Рекомендации

**Для разработки:**
```bash
npm run populate  # Быстро, достаточно для тестов
```

**Для продакшена:**
```bash
npm run populate:all  # Полная база, максимальное покрытие
```

**Для демо:**
```bash
npm run demo  # Без загрузки, использует mock данные
```

---

## ✅ Чеклист полной загрузки

- [ ] Установлены зависимости (`npm install`)
- [ ] Настроен `.env` с API ключами
- [ ] Достаточно места на диске (~1 GB)
- [ ] Стабильное интернет-соединение
- [ ] Запущена команда `npm run populate:all`
- [ ] Процесс завершился успешно
- [ ] Проверено количество игр в БД
- [ ] Запущен сервер `npm run start:db`
- [ ] Протестирован поиск `/search?query=test`

**Готово!** Теперь у вас полная база данных игр! 🎮

---

**Время начала загрузки:** Запишите время, чтобы отслеживать прогресс  
**Ожидаемое завершение:** Через 1-3 часа

Удачи! 🚀
