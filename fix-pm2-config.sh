#!/bin/bash

# Скрипт исправления конфигурации PM2 и обновления сервера

echo "🔧 Исправляем конфигурацию PM2..."

# Проверяем где находится проект
PROJECT_PATHS=(
    "/root/gameAPI"
    "/var/www/game-api" 
    "/root/game-api"
    "/var/www/gameAPI"
)

PROJECT_DIR=""
for path in "${PROJECT_PATHS[@]}"; do
    if [ -d "$path" ] && [ -f "$path/index.js" ]; then
        PROJECT_DIR="$path"
        echo "✅ Найден проект в: $PROJECT_DIR"
        break
    fi
done

if [ -z "$PROJECT_DIR" ]; then
    echo "❌ Проект не найден в ожидаемых местах"
    echo "Проверяем директории..."
    ls -la /root/ | grep game
    ls -la /var/www/ | grep game 2>/dev/null || echo "/var/www не существует или пуст"
    exit 1
fi

cd "$PROJECT_DIR"

echo "🔄 Останавливаем все процессы PM2..."
pm2 stop all 2>/dev/null || echo "Нет запущенных процессов"

echo "🗑️ Удаляем неправильные процессы..."
pm2 delete all 2>/dev/null || echo "Процессы уже удалены"

echo "📦 Переустанавливаем зависимости..."
npm install --production

echo "🚀 Запускаем сервер с правильным путем..."
pm2 start "$PROJECT_DIR/index-with-db.js" --name game-api
pm2 save

echo "⏳ Ожидаем запуска..."
sleep 3

echo "🧪 Тестируем API..."

# Проверяем health endpoint
HEALTH=$(curl -s http://localhost:3002/health 2>/dev/null)
if echo "$HEALTH" | grep -q "OK"; then
    echo "✅ Сервер запущен успешно!"
    echo "📊 Статус PM2:"
    pm2 status
    
    echo "🔍 Тестируем поиск..."
    SEARCH=$(curl -s "http://localhost:3002/search?query=witcher&limit=1" 2>/dev/null)
    
    if echo "$SEARCH" | grep -q "name"; then
        echo "✅ Поиск работает!"
        
        # Извлекаем ID игры для тестирования деталей
        GAME_ID=$(echo "$SEARCH" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
        if [ ! -z "$GAME_ID" ]; then
            echo "🎮 Тестируем детали игры: $GAME_ID"
            
            GAME_DETAILS=$(curl -s "http://localhost:3002/games/$GAME_ID" 2>/dev/null)
            
            if echo "$GAME_DETAILS" | grep -q "\"$GAME_ID\""; then
                echo "✅ Детали игры работают корректно!"
                echo "🎉 Все исправлено и работает!"
            else
                echo "⚠️ Детали игры могут работать не полностью корректно"
                echo "Ответ: $GAME_DETAILS"
            fi
        fi
    else
        echo "❌ Поиск не работает"
    fi
else
    echo "❌ Сервер не запустился"
    echo "📋 Последние логи PM2:"
    pm2 logs game-api --lines 10
    exit 1
fi

echo ""
echo "🌐 API доступно по адресу: http://45.114.61.148:3002"
echo "📋 Команды для управления:"
echo "  pm2 status                - статус сервера"
echo "  pm2 logs game-api         - логи"
echo "  pm2 restart game-api      - перезапуск"
echo "  pm2 stop game-api         - остановка"
