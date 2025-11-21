# 🚨 Исправление проблемы с PM2 на сервере

## ❌ Проблема
PM2 ищет файл в неправильном месте и падает с ошибкой:
```
Error: Cannot find module '/root/gameAPI/index.js'
```

## 🔍 Диагностика проблемы
PM2 настроен неправильно - путь в конфигурации не соответствует фактическому расположению проекта.

## ✅ Решение - Автоматическое исправление

Создан скрипт [`fix-pm2-config.sh`](fix-pm2-config.sh), который:

1. ✅ Находит проект в возможных директориях
2. ✅ Останавливает неправильные процессы PM2
3. ✅ Переустанавливает зависимости
4. ✅ Запускает сервер с правильным путем
5. ✅ Тестирует API

## 🚀 Как использовать:

### Вариант 1: Автоматическое исправление
```bash
# Подключитесь к серверу по SSH
ssh user@45.114.61.148

# Загрузите и запустите скрипт исправления
chmod +x fix-pm2-config.sh
./fix-pm2-config.sh
```

### Вариант 2: Ручное исправление
```bash
# Подключитесь к серверу
ssh user@45.114.61.148

# Найдите правильную директорию проекта
find /root /var/www -name "index.js" -path "*/game*" 2>/dev/null

# Перейдите в директорию
cd /var/www/game-api

# Остановите неправильные процессы
pm2 stop all
pm2 delete all

# Запустите с правильным путем
pm2 start /var/www/game-api/index-with-db.js --name game-api
pm2 save
```

## 🔧 Подробное исправление:

### Шаг 1: Проверьте текущие процессы PM2
```bash
pm2 status
pm2 list
```

### Шаг 2: Найдите директорию проекта
```bash
find /root /var/www -name "package.json" -path "*game*" 2>/dev/null
ls -la /root/ | grep game
ls -la /var/www/ | grep game
```

### Шаг 3: Остановите все процессы
```bash
pm2 stop all
pm2 delete all
```

### Шаг 4: Перейдите в правильную директорию
```bash
cd /var/www/game-api  # или найденная директория
```

### Шаг 5: Запустите сервер правильно
```bash
# Используйте АБСОЛЮТНЫЙ путь
pm2 start /var/www/game-api/index-with-db.js --name game-api
pm2 save
```

### Шаг 6: Проверьте работу
```bash
pm2 status
curl http://localhost:3002/health
curl "http://localhost:3002/search?query=witcher&limit=1"
```

## 🧪 Автоматическое тестирование:

Скрипт автоматически тестирует:
- ✅ Health endpoint
- ✅ Поиск игр  
- ✅ Детали игры
- ✅ Возвращает корректные данные

## 📋 Чеклист успешного исправления:

- [ ] PM2 показывает процесс `game-api` как "online"
- [ ] `curl http://localhost:3002/health` возвращает `{"status":"OK"}`
- [ ] Поиск игр работает: `curl "http://localhost:3002/search?query=witcher"`
- [ ] Детали игры работают: `curl "http://localhost:3002/games/rawg_52998"`
- [ ] Нет ошибок в логах: `pm2 logs game-api`

## 🔍 Диагностика проблем:

### Если PM2 не находит файл:
```bash
# Проверьте что файл существует
ls -la /var/www/game-api/index-with-db.js

# Проверьте права доступа
chmod +x /var/www/game-api/index-with-db.js
```

### Если сервер не отвечает:
```bash
# Проверьте логи
pm2 logs game-api

# Проверьте статус
pm2 status

# Проверьте что порт свободен
netstat -tlnp | grep 3002
```

### Если API возвращает ошибки:
```bash
# Проверьте логи подробнее
pm2 logs game-api --err --lines 20

# Проверьте переменные окружения
cat .env
```

## 🎯 После успешного исправления:

Ваш API будет работать по адресу:
```
http://45.114.61.148:3002
```

Доступные эндпоинты:
- `/health` - статус сервера
- `/search?query=игра` - поиск игр
- `/games/ID` - детали игры
- `/popular?limit=10` - популярные игры
- `/games?limit=5` - список игр

## 📦 Альтернативные способы запуска:

### Использование index-with-db.js (рекомендуется):
```bash
pm2 start /var/www/game-api/index-with-db.js --name game-api
```

### Использование index.js (без БД):
```bash
pm2 start /var/www/game-api/index.js --name game-api
```

### Через npm:
```bash
cd /var/www/game-api
pm2 start "npm run start:db" --name game-api
```

---

## 🎉 Готово!

После запуска скрипта или ручного исправления ваш игровой API будет полностью функциональным!

**Все проблемы с PM2 решены!** 🚀
