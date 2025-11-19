# 🚀 Деплой на сервер

## Вариант 1: Docker (рекомендуется)

### Быстрый деплой:
```bash
# 1. Клонируйте репозиторий
git clone https://github.com/your-username/game-api.git
cd game-api

# 2. Создайте .env файл
cp .env.example .env
# Отредактируйте .env и добавьте API ключи

# 3. Запустите с Docker Compose
docker-compose up -d

# 4. Проверьте статус
curl http://localhost:3002/health
```

### Заполнение базы данных:
```bash
# Войдите в контейнер
docker exec -it game-api sh

# Заполните БД
npm run populate

# Или полная загрузка
npm run populate:all

# Выйдите
exit
```

### Управление контейнером:
```bash
# Остановить
docker-compose down

# Перезапустить
docker-compose restart

# Логи
docker-compose logs -f

# Пересобрать
docker-compose up -d --build
```

---

## Вариант 2: PM2 (без Docker)

### Установка:
```bash
# 1. Установите PM2 глобально
npm install -g pm2

# 2. Клонируйте репозиторий
git clone https://github.com/your-username/game-api.git
cd game-api

# 3. Установите зависимости
npm install --production

# 4. Создайте .env файл
cp .env.example .env
# Отредактируйте .env

# 5. Заполните БД
npm run populate

# 6. Запустите с PM2
pm2 start index-with-db.js --name game-api

# 7. Сохраните конфигурацию
pm2 save
pm2 startup
```

### Управление PM2:
```bash
# Статус
pm2 status

# Логи
pm2 logs game-api

# Перезапуск
pm2 restart game-api

# Остановка
pm2 stop game-api
```

---

## Вариант 3: Systemd (Linux)

### Создайте service файл:
```bash
sudo nano /etc/systemd/system/game-api.service
```

```ini
[Unit]
Description=Game API Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/game-api
ExecStart=/usr/bin/node index-with-db.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=game-api
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### Запуск:
```bash
sudo systemctl daemon-reload
sudo systemctl enable game-api
sudo systemctl start game-api
sudo systemctl status game-api
```

---

## Вариант 4: Heroku

### Деплой на Heroku:
```bash
# 1. Установите Heroku CLI
# https://devcenter.heroku.com/articles/heroku-cli

# 2. Логин
heroku login

# 3. Создайте приложение
heroku create your-game-api

# 4. Добавьте переменные окружения
heroku config:set RAWG_API_KEY=your_key
heroku config:set GIANT_BOMB_API_KEY=your_key
heroku config:set THEGAMESDB_API_KEY=your_key
heroku config:set USE_DATABASE=true

# 5. Деплой
git push heroku main

# 6. Откройте приложение
heroku open
```

### Procfile для Heroku:
```
web: node index-with-db.js
```

---

## Вариант 5: DigitalOcean App Platform

### Настройка:
1. Создайте аккаунт на DigitalOcean
2. Перейдите в App Platform
3. Подключите GitHub репозиторий
4. Настройте переменные окружения
5. Деплой автоматический при push

---

## 🔧 Настройка Nginx (reverse proxy)

### Конфигурация:
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL с Let's Encrypt:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

---

## 📊 Мониторинг

### Проверка здоровья:
```bash
# Локально
curl http://localhost:3002/health

# Удаленно
curl https://api.yourdomain.com/health
```

### Логи:
```bash
# Docker
docker-compose logs -f game-api

# PM2
pm2 logs game-api

# Systemd
journalctl -u game-api -f
```

---

## 🔐 Безопасность

### Рекомендации:
1. ✅ Используйте HTTPS (SSL сертификат)
2. ✅ Не храните .env в Git
3. ✅ Используйте переменные окружения
4. ✅ Настройте firewall (только порты 80, 443)
5. ✅ Регулярно обновляйте зависимости

### Firewall (UFW):
```bash
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 22
sudo ufw enable
```

---

## 📦 Подготовка к деплою

### Чеклист:
- [ ] Код загружен на GitHub
- [ ] .env.example содержит все переменные
- [ ] .gitignore настроен правильно
- [ ] package.json содержит все скрипты
- [ ] README.md обновлен
- [ ] Dockerfile и docker-compose.yml готовы
- [ ] База данных заполнена (опционально)

### Команды для Git:
```bash
# Инициализация (если еще не сделано)
git init
git add .
git commit -m "Initial commit"

# Добавление remote
git remote add origin https://github.com/your-username/game-api.git

# Push
git push -u origin main
```

---

## 🎯 Рекомендуемый порядок деплоя

### Для начинающих:
1. **Heroku** - самый простой, бесплатный tier

### Для продакшена:
1. **Docker + DigitalOcean** - надежно и масштабируемо
2. **PM2 + VPS** - полный контроль

### Для enterprise:
1. **Kubernetes** - максимальная масштабируемость

---

## ❓ FAQ

### Как обновить на сервере?
```bash
# Docker
git pull
docker-compose up -d --build

# PM2
git pull
npm install
pm2 restart game-api
```

### Как сделать бэкап БД?
```bash
# Копирование файла
cp games.db games.db.backup

# Docker
docker cp game-api:/app/games.db ./backup/
```

### Как масштабировать?
```bash
# PM2 cluster mode
pm2 start index-with-db.js -i max

# Docker Compose
docker-compose up -d --scale game-api=3
```

---

## ✅ Готово!

После деплоя ваш API будет доступен по адресу:
- **Локально**: http://localhost:3002
- **Продакшн**: https://api.yourdomain.com

Протестируйте:
```bash
curl https://api.yourdomain.com/health
curl https://api.yourdomain.com/search?query=witcher
```
