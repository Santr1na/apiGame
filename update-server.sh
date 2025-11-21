#!/bin/bash

# Скрипт обновления сервера с игровым API

echo "🚀 Начинаем обновление сервера..."

# Переходим в директорию с проектом
cd /var/www/game-api || exit 1

echo "📥 Загружаем обновления..."
git pull origin main

echo "🔧 Перезапускаем сервер..."

# Останавливаем текущий процесс
pm2 stop game-api || echo "Сервер не запущен через PM2"

# Перезапускаем
npm install --production
pm2 start index-with-db.js --name game-api
pm2 save

echo "🧪 Тестируем API..."

# Ждем 5 секунд для запуска
sleep 5

# Проверяем health endpoint
curl -s http://localhost:3002/health > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Сервер запущен успешно!"
    
    # Тестируем поиск
    echo "🔍 Тестируем поиск игр..."
    RESULT=$(curl -s "http://localhost:3002/search?query=witcher&limit=1")
    
    if echo "$RESULT" | grep -q "name"; then
        echo "✅ Поиск работает!"
        
        # Извлекаем ID первой игры
        GAME_ID=$(echo "$RESULT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
        echo "🎮 Тестируем детали игры: $GAME_ID"
        
        # Тестируем детали игры
        GAME_DETAILS=$(curl -s "http://localhost:3002/games/$GAME_ID")
        
        if echo "$GAME_DETAILS" | grep -q "id"; then
            echo "✅ Детали игры работают!"
            echo "🎉 Обновление завершено успешно!"
        else
            echo "❌ Детали игры не работают"
            echo "Ответ: $GAME_DETAILS"
        fi
    else
        echo "❌ Поиск не работает"
    fi
else
    echo "❌ Сервер не запущен"
    echo "📋 Логи PM2:"
    pm2 logs game-api --lines 20
fi

echo "📊 Статус сервера:"
pm2 status

echo "🌐 API доступно по адресу: http://45.114.61.148:3002"
