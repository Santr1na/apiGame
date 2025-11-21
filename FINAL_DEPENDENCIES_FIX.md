# 🚨 ФИНАЛЬНОЕ РЕШЕНИЕ - Проблема с зависимостями

## ❌ Проблема диагностирована:
PM2 запускается, но **Node.js не может найти зависимости** (модули).
Ошибка: `MODULE_NOT_FOUND` указывает на отсутствие `node_modules/`.

## ✅ ПРИЧИНА:
В директории `/root/gameAPI/apiGame` отсутствуют:
- ❌ `node_modules/` - зависимости Node.js
- ❌ Или зависимости не установлены правильно

## 🚀 ФИНАЛЬНОЕ РЕШЕНИЕ:

**Запустите на сервере:**
```bash
chmod +x install-dependencies-fix.sh
./install-dependencies-fix.sh
```

**Что делает скрипт:**
1. 📁 Проверяет содержимое директории
2. 📦 Устанавливает зависимости через `npm install`
3. 🔍 Создает .env если нужно
4. 🚀 Запускает сервер с правильными зависимостями
5. 🧪 Тестирует API

---

## 🛠️ АЛЬТЕРНАТИВНОЕ РЕШЕНИЕ (если скрипт не поможет):

### Вариант 1: Ручная установка зависимостей
```bash
# На сервере
cd /root/gameAPI/apiGame

# Проверим что есть
ls -la

# Если нет package.json - копируем из репозитория
# Или ищем правильную директорию
find /root /var/www -name "package.json" -exec cp {} /root/gameAPI/apiGame/ \;

# Устанавливаем зависимости
npm install

# Проверяем .env
if [ ! -f ".env" ]; then
    cp .env.example .env 2>/dev/null || echo "Создайте .env файл"
fi

# Запускаем
pm2 delete all
pm2 start index-with-db.js --name game-api
pm2 save

# Тестируем
curl http://localhost:3002/health
```

### Вариант 2: Копирование готового проекта
```bash
# Создаем новую чистую директорию
mkdir -p /root/game-api
cd /root/game-api

# Скачиваем проект из Git
git clone https://github.com/Santr1na/apiGame.git .
# или
# wget -O project.tar.gz URL && tar -xzf project.tar.gz

# Устанавливаем зависимости
npm install

# Запускаем
pm2 delete all
pm2 start index-with-db.js --name game-api
pm2 save
```

### Вариант 3: Проверка и исправление структуры
```bash
# Проверяем что есть в директории
cd /root/gameAPI/apiGame
ls -la

echo "=== ФАЙЛЫ В ДИРЕКТОРИИ ==="
ls -1

echo "=== NODE MODULES ==="
ls -la node_modules/ 2>/dev/null || echo "node_modules отсутствует"

echo "=== PACKAGE.JSON ==="
cat package.json 2>/dev/null || echo "package.json отсутствует"

echo "=== ENV ФАЙЛ ==="
ls -la .env* 2>/dev/null || echo "Нет .env файлов"
```

---

## 🔍 ДИАГНОСТИКА:

### Если `package.json` отсутствует:
```bash
# Находим правильные файлы проекта
find /root /var/www -name "package.json" | grep -i game

# Копируем правильные файлы
cp /найденный/путь/* /root/gameAPI/apiGame/
```

### Если зависимости не устанавливаются:
```bash
# Очищаем npm кэш
npm cache clean --force

# Удаляем node_modules
rm -rf node_modules
rm -f package-lock.json

# Устанавливаем заново
npm install
```

### Если .env отсутствует:
```bash
# Создаем базовый .env
cat > .env << EOF
RAWG_API_KEY=ваш_rawg_ключ
GIANT_BOMB_API_KEY=ваш_giant_bomb_ключ
THEGAMESDB_API_KEY=ваш_tgdb_ключ
USE_DATABASE=false
PORT=3002
EOF
```

---

## 🧪 ПРОВЕРКА ПОСЛЕ ИСПРАВЛЕНИЯ:

После запуска скрипта должно появиться:
```
✅ package.json найден!
✅ .env файл найден
✅ УСПЕХ! API РАБОТАЕТ!
🌐 http://45.114.61.148:3002
✅ Поиск работает
```

**Статус PM2:**
```
┌────┬────────────┬─────────┬─────┬─────────┬────────┬─────────┐
│ id │ name       │ mode    │ ↺   │ status  │ cpu    │ memory  │
├────┼────────────┼─────────┼─────┼─────────┼────────┼─────────┤
│ 0  │ game-api   │ fork    │ 15  │ online  │ 0%     │ 25.6MB │
└────┴────────────┴─────────┴─────┴─────────┴────────┴─────────┘
```

---

## 📋 ФИНАЛЬНЫЙ ЧЕКЛИСТ:

- [ ] Скрипт запущен на сервере
- [ ] PM2 показывает `online` статус  
- [ ] `curl http://localhost:3002` отвечает
- [ ] `/health` возвращает `{"status":"OK"}`
- [ ] `/search` находит игры
- [ ] `/games/:id` возвращает данные игры

## 🎯 РЕЗУЛЬТАТ:

После успешного исправления:
```
🌐 ВАШ API ДОСТУПЕН: http://45.114.61.148:3002

Доступные эндпоинты:
GET /health                - Статус
GET /search?query=игра     - Поиск  
GET /games/:id            - Детали
GET /popular?limit=10     - Популярные
GET /games?limit=5        - Список
```

**Запустите скрипт и ваш API заработает!** 🚀
