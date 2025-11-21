#!/bin/bash

# Скрипт полного сброса и исправления PM2

echo "🚨 ПОЛНЫЙ СБРОС PM2 И ИСПРАВЛЕНИЕ КОНФИГУРАЦИИ"
echo "==============================================="

# Останавливаем и удаляем ВСЕ процессы
echo "🛑 Останавливаем все процессы PM2..."
pm2 stop all 2>/dev/null
pm2 delete all 2>/dev/null

# Полностью очищаем конфигурацию PM2
echo "🗑️ Очищаем конфигурацию PM2..."
pm2 flush 2>/dev/null  # Очищаем логи
rm -rf ~/.pm2 2>/dev/null  # Удаляем конфигурацию (Ubuntu/CentOS)
rm -rf /root/.pm2 2>/dev/null  # Удаляем конфигурацию (root пользователь)

# Ищем проект в всех возможных местах
echo "🔍 Ищем проект..."
PROJECT_PATHS=(
    "/root/gameAPI/apiGame"
    "/root/gameAPI"
    "/var/www/game-api" 
    "/root/game-api"
    "/var/www/gameAPI"
    "/home/*/game-api"
    "/root/apiGame"
)

PROJECT_DIR=""
for path in "${PROJECT_PATHS[@]}"; do
    expanded_path=$(eval echo $path)  # Раскрываем * если есть
    if [ -d "$expanded_path" ] && [ -f "$expanded_path/index-with-db.js" ]; then
        PROJECT_DIR="$expanded_path"
        echo "✅ Найден проект в: $PROJECT_DIR"
        break
    fi
done

if [ -z "$PROJECT_DIR" ]; then
    echo "❌ Проект не найден!"
    echo "🔍 Поищем все индексы с игровой тематикой..."
    find /root /var/www /home -name "index*.js" 2>/dev/null | grep -i game | head -10
    exit 1
fi

echo "📁 Переходим в директорию проекта..."
cd "$PROJECT_DIR"

# Проверяем файлы
echo "📋 Проверяем структуру проекта..."
ls -la

if [ ! -f "package.json" ]; then
    echo "❌ package.json не найден в $PROJECT_DIR"
    exit 1
fi

if [ ! -f "index-with-db.js" ]; then
    echo "❌ index-with-db.js не найден в $PROJECT_DIR"
    echo "Доступные файлы:"
    ls -la *.js
    exit 1
fi

# Устанавливаем зависимости
echo "📦 Переустанавливаем зависимости..."
npm install --production

# Проверяем переменные окружения
if [ ! -f ".env" ]; then
    echo "⚠️ .env не найден, создаем из примера..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "📝 Отредактируйте .env файл и добавьте ваши API ключи!"
    else
        echo "❌ .env.example тоже отсутствует!"
    fi
fi

echo "🚀 Запускаем сервер с ПРАВИЛЬНЫМ путем..."

# Используем АБСОЛЮТНЫЙ путь к index-with-db.js
START_SCRIPT="$PROJECT_DIR/index-with-db.js"
echo "📜 Запускаем: $START_SCRIPT"

# Запускаем с явным указанием интерпретатора node
pm2 start "$START_SCRIPT" --name game-api --interpreter node
pm2 save

echo "⏳ Ожидаем запуска (3 секунды)..."
sleep 3

echo "🧪 Тестируем API..."

# Проверяем статус PM2
echo "📊 Статус PM2:"
pm2 status

# Тестируем health endpoint
HEALTH=$(curl -s --connect-timeout 5 http://localhost:3002/health 2>/dev/null)
if echo "$HEALTH" | grep -q "OK"; then
    echo "✅ Сервер запущен и отвечает!"
    
    echo "🔍 Тестируем поиск игр..."
    SEARCH=$(curl -s --connect-timeout 5 "http://localhost:3002/search?query=witcher&limit=1" 2>/dev/null)
    
    if echo "$SEARCH" | grep -q "name"; then
        echo "✅ Поиск работает!"
        
        # Извлекаем ID игры
        GAME_ID=$(echo "$SEARCH" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
        if [ ! -z "$GAME_ID" ]; then
            echo "🎮 Тестируем детали игры: $GAME_ID"
            
            sleep 1
            GAME_DETAILS=$(curl -s --connect-timeout 5 "http://localhost:3002/games/$GAME_ID" 2>/dev/null)
            
            if echo "$GAME_DETAILS" | grep -q "\"$GAME_ID\""; then
                echo "✅ Детали игры работают корректно!"
                echo "🎉 ВСЕ РАБОТАЕТ ИСПРАВНО!"
            else
                echo "⚠️ Детали игры могут работать не полностью"
                echo "Ответ: $GAME_DETAILS"
            fi
        fi
    else
        echo "❌ Поиск не работает корректно"
    fi
else
    echo "❌ Сервер не отвечает"
    echo "📋 Последние ошибки PM2:"
    pm2 logs game-api --lines 20 --err
    exit 1
fi

echo ""
echo "🌐 ============================================"
echo "🌐 API ДОСТУПНО ПО АДРЕСУ: http://45.114.61.148:3002"
echo "🌐 ============================================"
echo ""
echo "📋 Управление сервером:"
echo "  pm2 status              - статус"
echo "  pm2 logs game-api       - логи"
echo "  pm2 restart game-api    - перезапуск"
echo "  pm2 stop game-api       - остановка"
echo ""
echo "🧪 Полезные команды тестирования:"
echo "  curl http://45.114.61.148:3002/health"
echo "  curl 'http://45.114.61.148:3002/search?query=witcher'"
echo ""
echo "✅ Исправление завершено!"
