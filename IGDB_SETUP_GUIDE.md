# IGDB API Integration Guide

## ✅ **IGDB Support Added**

IGDB API поддержка была успешно добавлена в populate и deduplicate скрипты!

## 📋 **Что обновлено:**

### 1. **Environment Configuration** (.env)
```bash
# IGDB credentials (добавлено)
IGDB_CLIENT_ID=your_igdb_client_id_here
IGDB_CLIENT_SECRET=your_igdb_client_secret_here
```

### 2. **populate-db.js**
- ✅ IGDB API интеграция
- ✅ Автоматическое получение токена
- ✅ Загрузка 3 страниц игр (~150 игр)
- ✅ Приоритет IGDB в процессе populate

### 3. **populate-all-games.js**
- ✅ Полная загрузка игр из IGDB
- ✅ Последовательный процесс (IGDB → RAWG → Giant Bomb → TheGamesDB)
- ✅ Прогресс сохранения каждые 10 запросов
- ✅ Лимит 1000 запросов для безопасности

### 4. **deduplicate.js**
- ✅ IGDB приоритет: 5 (высший)
- ✅ Приоритетная схема: IGDB (5) > RAWG (4) > Giant Bomb (3) > Steam (2) > TheGamesDB (1)

## 🔑 **Получение IGDB Credentials:**

1. Перейдите на https://api.igdb.com/signup/
2. Создайте аккаунт
3. Получите Client ID и Client Secret
4. Обновите .env файл с реальными credentials

## 🚀 **Использование:**

### **Быстрое заполнение:**
```bash
npm run populate
# Включает IGDB (3 страницы) + RAWG (10 страниц) + Giant Bomb (3 страницы)
```

### **Полное заполнение:**
```bash
npm run populate:all
# Включает IGDB (до 50,000 игр) + все остальные источники
```

### **Удаление дубликатов:**
```bash
npm run deduplicate:stats    # Статистика
npm run deduplicate          # Удаление дубликатов (IGDB в приоритете)
```

## 📊 **Результат:**

После настройки IGDB credentials ваша база данных будет содержать:
- **IGDB**: Высококачественные игры с лучшими рейтингами
- **RAWG**: Популярные современные игры
- **Giant Bomb**: Классические и нишевые игры
- **TheGamesDB**: Дополнительные платформы

**Общий объем**: 50,000+ игр из всех источников