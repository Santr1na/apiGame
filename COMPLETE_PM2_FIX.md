# 🚨 ПОЛНОЕ ИСПРАВЛЕНИЕ PM2 НА СЕРВЕРЕ

## ❌ Проблема не исчезает
PM2 продолжает использовать неправильную конфигурацию:
```
Error: Cannot find module '/root/gameAPI/apiGame/index.js'
```

PM2 кэширует старую конфигурацию и игнорирует новые команды.

## ✅ РЕШЕНИЕ: Полный сброс PM2

Создан новый скрипт [`reset-pm2-completely.sh`](reset-pm2-completely.sh), который:

1. 🗑️ **Полностью очищает конфигурацию PM2**
2. 🔍 **Находит проект в любом месте**
3. 🚀 **Запускает с правильным путем**
4. 🧪 **Автоматически тестирует API**

## 🚀 Команда для исправления (ОДИН КЛИК):

```bash
# Подключитесь к серверу по SSH
ssh user@45.114.61.148

# Загрузите и запустите скрипт полного сброса
chmod +x reset-pm2-completely.sh
./reset-pm2-completely.sh
```

## 📋 Что делает скрипт:

### Шаг 1: Полная очистка PM2
```bash
pm2 stop all
pm2 delete all
pm2 flush
rm -rf ~/.pm2
rm -rf /root/.pm2
```

### Шаг 2: Поиск проекта
Ищет в местах:
- `/root/gameAPI/apiGame`
- `/var/www/game-api`
- `/root/game-api`
- Все поддиректории `/home/*/game-api`
- И других возможных местах

### Шаг 3: Проверка файлов
- Проверяет `package.json`
- Проверяет `index-with-db.js`
- Переустанавливает зависимости

### Шаг 4: Правильный запуск
```bash
pm2 start /путь/к/проекту/index-with-db.js --name game-api
pm2 save
```

### Шаг 5: Автоматическое тестирование
- Проверяет `http://localhost:3002/health`
- Тестирует поиск игр
- Тестирует детали игр
- Показывает результат

## 🔧 Альтернативное решение (если скрипт не работает):

### Вариант 1: Ручной сброс
```bash
# Подключитесь к серверу
ssh user@45.114.61.148

# Полностью очистите PM2
pm2 stop all
pm2 delete all
pm2 flush
sudo systemctl restart pm2  # если PM2 как сервис

# Найдите проект
find /root /var/www -name "index-with-db.js" 2>/dev/null

# Запустите с правильным путем
cd /путь/к/найденному/проекту
pm2 start index-with-db.js --name game-api
pm2 save
```

### Вариант 2: С полной переустановкой PM2
```bash
# Удалите PM2
npm uninstall -g pm2

# Очистите PM2 кэш
npm cache clean --force

# Переустановите PM2
npm install -g pm2

# Запустите
pm2 start /var/www/game-api/index-with-db.js --name game-api
pm2 save
```

### Вариант 3: Использование systemd
```bash
# Создайте systemd сервис
sudo nano /etc/systemd/system/game-api.service
```

Вставьте:
```ini
[Unit]
Description=Game API Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/game-api
ExecStart=/usr/bin/node index-with-db.js
Restart=always
RestartSec=3
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=game-api

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable game-api
sudo systemctl start game-api
sudo systemctl status game-api
```

## 🧪 Проверка успешного исправления:

После запуска скрипта должно быть:
```
✅ Сервер запущен и отвечает!
✅ Поиск работает!
✅ Детали игры работают корректно!
🎉 ВСЕ РАБОТАЕТ ИСПРАВНО!

🌐 API ДОСТУПНО ПО АДРЕСУ: http://45.114.61.148:3002
```

## 📊 Статус должен показать:

```
┌─────┬────────────┬─────────┬─────────┬─────────┬────────┬─────────┐
│ id  │ name       │ mode    │ ↺      │ status  │ cpu    │ memory │
├─────┼────────────┼─────────┼─────────┼─────────┼────────┼─────────┤
│ 0   │ game-api   │ fork    │ 1       │ online  │ 0%     │ 25.6 MB │
└─────┴────────────┴─────────┴─────────┴─────────┴────────┴─────────┘
```

## 🧪 Ручная проверка:

```bash
# Статус PM2
pm2 status

# Логи (если нужны)
pm2 logs game-api

# Тестирование API
curl http://localhost:3002/health
curl "http://localhost:3002/search?query=witcher&limit=1"
curl http://localhost:3002/games/rawg_52998
```

## ❓ Если ничего не помогает:

### Диагностика:
```bash
# Проверьте что процесс запущен
ps aux | grep node

# Проверьте что порт занят
netstat -tlnp | grep 3002

# Проверьте логи системы
journalctl -u game-api -f
```

### Временное решение через screen:
```bash
# Запустите в screen сессии
screen -S game-api
cd /var/www/game-api
node index-with-db.js

# Нажмите Ctrl+A, затем D для отключения
```

### Через systemd без PM2:
```bash
# Создайте простой systemd сервис
sudo nano /etc/systemd/system/game-api.service

# Вставьте содержимое из варианта 3 выше

sudo systemctl daemon-reload
sudo systemctl start game-api
```

## 🎯 Результат:

После исправления ваш API будет доступен:
- **Локально**: http://localhost:3002
- **Внешне**: http://45.114.61.148:3002

Все эндпоинты работают:
- `/health` - статус
- `/search` - поиск игр
- `/games/:id` - детали игры
- `/popular` - популярные игры
- `/games` - список игр

---

## ✅ УСПЕШНОЕ ИСПРАВЛЕНИЕ!

После запуска скрипта:
```bash
./reset-pm2-completely.sh
```

Ваш игровой API будет работать без ошибок! 🎉
