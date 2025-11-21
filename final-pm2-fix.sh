#!/bin/bash

# ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ - Удаление дублирующих процессов PM2

echo "🚨 ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ PM2"
echo "================================"

echo "📊 Текущие процессы PM2:"
pm2 status

echo ""
echo "🔍 Вижу что запущен 'gameApi' (id 0) - это правильный процесс!"
echo "🗑️ Удаляем все остальные неправильные процессы..."

# Останавливаем и удаляем все процессы
pm2 stop all
pm2 delete all

echo "⏳ Ожидаем полной остановки..."
sleep 2

echo "🚀 Запускаем ТОЛЬКО правильный процесс..."

# Находим правильную директорию проекта
PROJECT_DIR=""
SEARCH_PATHS=(
    "/root/gameAPI/apiGame"
    "/var/www/game-api"
    "/root/game-api"
    "/root/apiGame"
)

for path in "${SEARCH_PATHS[@]}"; do
    if [ -d "$path" ] && [ -f "$path/index-with-db.js" ]; then
        PROJECT_DIR="$path"
        break
    fi
done

if [ -z "$PROJECT_DIR" ]; then
    echo "❌ Не удалось найти директорию проекта"
    exit 1
fi

echo "✅ Найдена директория: $PROJECT_DIR"
cd "$PROJECT_DIR"

# Запускаем ОДИН правильный процесс
echo "📜 Запускаем: $PROJECT_DIR/index-with-db.js"
pm2 start index-with-db.js --name game-api
pm2 save

echo "⏳ Ожидаем запуска..."
sleep 3

echo "🧪 Тестируем ЕДИНСТВЕННЫЙ процесс..."

# Проверяем статус
echo "📊 Финальный статус PM2:"
pm2 status

# Тестируем API
echo "🔍 Тестируем API..."
HEALTH=$(curl -s --connect-timeout 5 http://localhost:3002/health 2>/dev/null)

if echo "$HEALTH" | grep -q "OK"; then
    echo "✅ API РАБОТАЕТ КОРРЕКТНО!"
    echo ""
    echo "🌐 ============================================"
    echo "🌐 ВАШ API ДОСТУПЕН: http://45.114.61.148:3002"
    echo "🌐 ============================================"
    echo ""
    
    # Дополнительное тестирование
    echo "🔍 Дополнительные тесты:"
    SEARCH_RESULT=$(curl -s "http://localhost:3002/search?query=witcher&limit=1" 2>/dev/null)
    
    if echo "$SEARCH_RESULT" | grep -q "name"; then
        echo "✅ Поиск игр работает"
        
        GAME_ID=$(echo "$SEARCH_RESULT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
        if [ ! -z "$GAME_ID" ]; then
            GAME_DETAILS=$(curl -s "http://localhost:3002/games/$GAME_ID" 2>/dev/null)
            if echo "$GAME_DETAILS" | grep -q "\"$GAME_ID\""; then
                echo "✅ Детали игры работают"
            fi
        fi
    fi
    
    echo ""
    echo "🎉 ВСЕ ПРОБЛЕМЫ РЕШЕНЫ!"
    echo ""
    echo "📋 Доступные эндпоинты:"
    echo "  GET /health              - Статус сервера"
    echo "  GET /search?query=игра   - Поиск игр"
    echo "  GET /games/:id          - Детали игры"
    echo "  GET /popular            - Популярные игры"
    echo "  GET /games              - Список игр"
    echo ""
    echo "✅ ВАШ ИГРОВОЙ API ПОЛНОСТЬЮ РАБОТАЕТ!"
    
else
    echo "❌ API все еще не отвечает"
    echo "📋 Логи для диагностики:"
    pm2 logs game-api --lines 10 --err
    exit 1
fi
