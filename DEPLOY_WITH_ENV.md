# 🔐 Деплой с .env файлом (безопасный способ)

## ⚠️ Важно: .env НЕ должен быть в Git!

Файл `.env` содержит секретные ключи и **НЕ должен** загружаться в Git.
Вместо этого используйте один из безопасных способов:

---

## Способ 1: Создать .env на сервере вручную (рекомендуется)

### Шаг 1: Загрузите код на GitHub
```bash
# На локальной машине
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/game-api.git
git push -u origin main
```

### Шаг 2: Клонируйте на сервер
```bash
# На сервере
cd /var/www
git clone https://github.com/your-username/game-api.git
cd game-api
```

### Шаг 3: Создайте .env на сервере
```bash
# На сервере
nano .env
```

Вставьте содержимое:
```env
RAWG_API_KEY=ваш_ключ_rawg
GIANT_BOMB_API_KEY=ваш_ключ_giant_bomb
THEGAMESDB_API_KEY=ваш_ключ_thegamesdb
STEAM_API_KEY=ваш_ключ_steam
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
USE_DATABASE=true
PORT=3002
```

Сохраните: `Ctrl+X`, `Y`, `Enter`

### Шаг 4: Установите и запустите
```bash
npm install
npm run populate
npm run start:db
```

---

## Способ 2: Использовать scp для копирования .env

### Скопируйте .env с локальной машины на сервер:
```bash
# На локальной машине
scp .env user@your-server:/var/www/game-api/.env
```

Пример:
```bash
scp .env root@192.168.1.100:/var/www/game-api/.env
```

---

## Способ 3: Переменные окружения (для Docker/Heroku)

### Docker Compose:
Создайте `.env` на сервере рядом с `docker-compose.yml`:
```bash
# На сервере
cd /var/www/game-api
nano .env
# Вставьте переменные
```

Запустите:
```bash
docker-compose up -d
```

### Heroku:
Используйте команды `heroku config`:
```bash
heroku config:set RAWG_API_KEY=your_key
heroku config:set GIANT_BOMB_API_KEY=your_key
heroku config:set THEGAMESDB_API_KEY=your_key
heroku config:set USE_DATABASE=true
```

---

## Способ 4: Использовать секреты GitHub (для CI/CD)

### GitHub Actions:
1. Перейдите в Settings → Secrets → Actions
2. Добавьте секреты:
   - `RAWG_API_KEY`
   - `GIANT_BOMB_API_KEY`
   - `THEGAMESDB_API_KEY`
   - `FIREBASE_SERVICE_ACCOUNT`

3. Создайте `.github/workflows/deploy.yml`:
```yaml
name: Deploy

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /var/www/game-api
            git pull
            echo "RAWG_API_KEY=${{ secrets.RAWG_API_KEY }}" > .env
            echo "GIANT_BOMB_API_KEY=${{ secrets.GIANT_BOMB_API_KEY }}" >> .env
            echo "THEGAMESDB_API_KEY=${{ secrets.THEGAMESDB_API_KEY }}" >> .env
            echo "USE_DATABASE=true" >> .env
            npm install
            pm2 restart game-api
```

---

## Способ 5: Использовать .env.vault (dotenv-vault)

### Установка:
```bash
npm install -g dotenv-vault
```

### Использование:
```bash
# Локально - зашифруйте .env
npx dotenv-vault local build

# На сервере - расшифруйте
DOTENV_KEY="your-key" npm run start:db
```

---

## 🎯 Рекомендуемый процесс деплоя

### Полная инструкция:

#### 1. На локальной машине:
```bash
# Убедитесь что .env в .gitignore
cat .gitignore | grep .env

# Загрузите код на GitHub
git add .
git commit -m "Ready for deployment"
git push origin main
```

#### 2. На сервере:
```bash
# Клонируйте репозиторий
cd /var/www
git clone https://github.com/your-username/game-api.git
cd game-api

# Создайте .env файл
nano .env
```

Вставьте ваши ключи:
```env
RAWG_API_KEY=ваш_ключ
GIANT_BOMB_API_KEY=ваш_ключ
THEGAMESDB_API_KEY=ваш_ключ
STEAM_API_KEY=ваш_ключ
USE_DATABASE=true
PORT=3002
```

```bash
# Установите зависимости
npm install

# Заполните базу данных
npm run populate

# Запустите с PM2
pm2 start index-with-db.js --name game-api
pm2 save
```

#### 3. Настройте автообновление:
```bash
# Создайте скрипт обновления
nano update.sh
```

```bash
#!/bin/bash
cd /var/www/game-api
git pull
npm install
pm2 restart game-api
```

```bash
chmod +x update.sh
```

Теперь для обновления просто запускайте:
```bash
./update.sh
```

---

## 🔒 Безопасность .env файла

### Проверьте права доступа:
```bash
# На сервере
chmod 600 .env
chown www-data:www-data .env
```

### Проверьте что .env не в Git:
```bash
git status
# .env не должен быть в списке
```

### Создайте бэкап .env:
```bash
# Локально
cp .env .env.backup

# На сервере
cp .env /root/.env.backup
chmod 600 /root/.env.backup
```

---

## 📋 Чеклист деплоя

- [ ] `.env` добавлен в `.gitignore`
- [ ] Код загружен на GitHub
- [ ] Репозиторий клонирован на сервер
- [ ] `.env` создан на сервере вручную
- [ ] Права на `.env` установлены (chmod 600)
- [ ] Зависимости установлены (`npm install`)
- [ ] База данных заполнена (`npm run populate`)
- [ ] Сервер запущен (`pm2 start` или `docker-compose up`)
- [ ] API доступен (проверка `/health`)
- [ ] Создан бэкап `.env`

---

## ❓ FAQ

### Что делать если случайно загрузил .env в Git?
```bash
# Удалите из Git (но оставьте локально)
git rm --cached .env
git commit -m "Remove .env from git"
git push

# Смените все API ключи!
# Старые ключи теперь публичны
```

### Как передать .env коллеге?
```bash
# Используйте безопасный канал:
# 1. Зашифрованный email
# 2. Slack/Telegram (личные сообщения)
# 3. Password manager (1Password, LastPass)
# НЕ отправляйте через обычный email!
```

### Как хранить разные .env для разных окружений?
```bash
# Создайте несколько файлов
.env.development
.env.staging
.env.production

# Используйте нужный
NODE_ENV=production node index-with-db.js
```

---

## ✅ Готово!

Теперь ваш код в Git, а секретные ключи безопасно хранятся только на сервере!

**Важно:** Никогда не загружайте `.env` в публичный репозиторий!
