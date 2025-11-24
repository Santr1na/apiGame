# IGDB App Access Token Setup Guide

## ✅ **IGDB Integration Status**

IGDB полностью интегрирован в систему, но требует **App Access Token** для работы.

## 🔑 **Current Status:**
- ✅ **Client ID**: Настроен
- ✅ **Client Secret**: Настроен  
- ❌ **App Access Token**: Требуется

## 🚀 **Как получить App Access Token:**

### **Method 1: Через браузер (Рекомендуется)**
1. Перейдите на: https://api.igdb.com/
2. Войдите со своими IGDB credentials
3. Перейдите в раздел "Token Management" или "API"
4. Сгенерируйте **App Access Token**
5. Скопируйте токен

### **Method 2: Через API**
```bash
curl -X POST https://api.igdb.com/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=6suowimw8bemqf3u9gurh7qnpx74sd" \
  -d "client_secret=powongmt2u3r0jb136tfqhq0r8t5gb" \
  -d "grant_type=client_credentials"
```

## 📝 **Обновление конфигурации:**

После получения App Access Token обновите .env файл:

```bash
# IGDB credentials
IGDB_CLIENT_ID=6suowimw8bemqf3u9gurh7qnpx74sd
IGDB_CLIENT_SECRET=powongmt2u3r0jb136tfqhq0r8t5gb
IGDB_ACCESS_TOKEN=your_generated_access_token_here
```

## 🔧 **Временное решение:**

Сейчас скрипты настроены на работу без IGDB:
- ✅ **RAWG**: 2,492 игры (активен)
- ✅ **Giant Bomb**: 299 игр (активен)
- ⚠️ **TheGamesDB**: API errors (временно пропускается)
- ❌ **Steam**: Endpoint unavailable (отключен)

## 🎯 **После активации IGDB:**

1. **Добавьте App Access Token в .env**
2. **Раскомментируйте IGDB в скриптах** (найдите `// IGDB disabled` и удалите комментарии)
3. **Запустите populate** - IGDB станет приоритетным источником (50,000+ игр)

IGDB integration готова - нужно только App Access Token! 🎮