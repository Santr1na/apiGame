#!/bin/bash

# КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ - Установка зависимостей и запуск

echo "🚨 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ - Устанавливаем зависимости"
echo "======================================================="

echo "📁 Проверяем что находится в директории проекта..."
cd /root/gameAPI/apiGame
ls -la

echo ""
echo "🔍 Проверяем package.json..."
if [ ! -f "package.json" ]; then
    echo "❌ package.json не найден!"
    echo "📋 Давайте найдем правильную директорию с проектом..."
    
    # Поищем project с правильными файлами
    find /root /var/www -name "package.json" -path "*game*" 2>/dev/null | head -5
    
    echo ""
    echo "🔍 Поищем index-with-db.js..."
    find /root /var/www -name "index-with-db.js" 2>/dev/null | head -5
    
    echo ""
    echo "🛠️ ВОЗМОЖНЫЕ ДЕЙСТВИЯ:"
    echo "1. Скопировать правильный проект в /root/gameAPI/apiGame/"
    echo "2. Запустить из правильной директории с package.json"
    echo "3. Установить зависимости вручную"
    exit 1
else
    echo "✅ package.json найден!"
fi

echo ""
echo "📦 Устанавливаем зависимости..."
npm install

echo ""
echo "🔍 Проверяем .env файл..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "📄 Найден .env.example, создаем .env..."
        cp .env.example .env
        echo "⚠️ ВАЖНО: Отредактируйте .env и добавьте API ключи!"
    else
        echo "❌ Нет .env и .env.example"
    fi
else
    echo "✅ .env файл найден"
fi

echo ""
echo "🚀 Запускаем сервер..."
pm2 delete all 2>/dev/null

# Проверяем что файл существует
if [ ! -f "index-with-db.js" ]; then
    echo "❌ index-with-db.js не найден!"
    echo "📋 Доступные файлы:"
    ls -la *.js
    exit 1
fi

echo "📜 Запускаем index-with-db.js"
pm2 start index-with-db.js --name game-api
pm2 save

echo "⏳ Ожидаем запуска..."
sleep 5

echo "🧪 Тестируем..."
echo "📊 Статус PM2:"
pm2 status

echo ""
echo "🔍 Тестируем API..."
HEALTH=$(curl -s --connect-timeout 5 http://localhost:3002/health 2>/dev/null)

if echo "$HEALTH" | grep -q "OK"; then
    echo "✅ УСПЕХ! API РАБОТАЕТ!"
    echo "🌐 http://45.114.61.148:3002"
    
    # Дополнительные тесты
    echo ""
    echo "🔍 Дополнительные тесты..."
    SEARCH=$(curl -s "http://localhost:3002/search?query=witcher&limit=1" 2>/dev/null)
    if echo "$SEARCH" | grep -q "name"; then
        echo "✅ Поиск работает"
    fi
    
else
    echo "❌ API не отвечает"
    echo "📋 Последние ошибки:"
    pm2 logs game-api --lines 10 --err
fi
