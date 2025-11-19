# Multi-Source Games API

A comprehensive games API that aggregates data from multiple sources instead of relying solely on IGDB. This API combines data from RAWG, Giant Bomb, Steam Store, and TheGamesDB to provide comprehensive game information.

## 🚀 Key Features

- **Multi-Source Integration**: Combines data from 4 different game databases
- **Unified Data Format**: Consistent response structure across all sources
- **Advanced Caching**: Smart caching strategy for optimal performance
- **Firebase Integration**: Built-in favorite and status tracking
- **Authentication**: Firebase-based user authentication
- **Search & Discovery**: Cross-platform search functionality

## 📊 Data Sources

| Source | Description | Coverage | Status |
|--------|-------------|----------|---------|
| **RAWG** | Primary source - comprehensive database | 350,000+ games | ✅ Active |
| **Giant Bomb** | Community-driven game encyclopedia | 40,000+ games | ✅ Active |
| **Steam Store** | Steam platform games | 50,000+ games | ✅ Active |
| **TheGamesDB** | Community-driven retro/modern games | 350,000+ games | ✅ Active |

## 🛠️ Installation

1. **Clone and install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your API keys
```

3. **Get API Keys:**
   - **RAWG**: https://rawg.io/apidocs (Free tier: 20,000 requests/day)
   - **Giant Bomb**: https://www.giantbomb.com/api/ (Free tier: 200 requests/day)
   - **TheGamesDB**: https://www.thegamesdb.net/ (Free)
   - **Steam**: No API key needed for basic functionality
   - **Firebase**: https://console.firebase.google.com/

4. **Start the server:**
```bash
npm start
```

## 🔧 Environment Variables

```env
# Required API Keys
RAWG_API_KEY=your_rawg_api_key
GIANT_BOMB_API_KEY=your_giant_bomb_api_key
THEGAMESDB_API_KEY=your_thegamesdb_api_key

# Optional
STEAM_API_KEY=your_steam_api_key
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
PORT=3002
```

## 📡 API Endpoints

### Health & Status
```http
GET /health
GET /api-status
```

### Game Discovery
```http
GET /popular?limit=10
GET /games?limit=5&page=1
GET /search?query=witcher&limit=10
```

### Game Details
```http
GET /games/{game_id}
```

### User Features (Requires Authentication)
```http
GET /games/{game_id}/favorite
POST /games/{game_id}/favorite
DELETE /games/{game_id}/favorite

POST /games/{game_id}/status/{status}
DELETE /games/{game_id}/status/{status}
```

## 🎮 Game ID Format

Each game has a source-prefixed ID:
- `rawg_{id}` - Games from RAWG API
- `giantbomb_{id}` - Games from Giant Bomb
- `steam_{appid}` - Games from Steam Store
- `tgdb_{id}` - Games from TheGamesDB

## 📝 Response Examples

### Popular Games Response
```json
[
  {
    "id": "rawg_3498",
    "source": "RAWG",
    "name": "Grand Theft Auto V",
    "cover_image": "https://media.rawg.io/media/games/456/456dea5e39c8e4022902d03d4f8f28ab.jpg",
    "rating": 4.47,
    "critic_rating": 97,
    "release_year": 2013,
    "main_genre": "Action",
    "platforms": ["PC", "PlayStation 5", "Xbox Series S/X"]
  }
]
```

### Search Response
```json
[
  {
    "id": "giantbomb_3030-47270",
    "source": "GiantBomb",
    "name": "The Witcher 3: Wild Hunt",
    "cover_image": "https://www.giantbomb.com/a/uploads/scale_medium/0/608/3182505-pc.jpg",
    "rating": 4.5,
    "description": "An open-world RPG adventure..."
  }
]
```

### Detailed Game Response
```json
{
  "id": "steam_570",
    "source": "Steam",
    "name": "Dota 2",
    "genres": ["MOBA", "Strategy"],
    "platforms": ["PC"],
    "release_date": "2013-07-09",
    "rating": 4.1,
    "rating_type": "Users",
    "cover_image": "https://steamcdn-a.akamaihd.net/steam/apps/570/library_600x900.jpg",
    "age_ratings": ["ESRB: T"],
    "summary": "A competitive multiplayer battle arena...",
    "developers": ["Valve"],
    "videos": ["https://www.youtube.com/watch?v=-cSFPIwME4k"],
    "favorite": 15,
    "playing": 8,
    "ill_play": 12,
    "passed": 25,
    "postponed": 3,
    "abandoned": 1,
    "similar_games": []
}
```

## 🔐 Authentication

The API uses Firebase Authentication. Include the user's ID token in the Authorization header:

```javascript
const token = await firebase.auth().currentUser.getIdToken();
fetch('/games/123/favorite', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## 📈 Caching Strategy

- **Steam Apps**: Loaded once at startup, cached in memory
- **Game Data**: 24-hour TTL cache for game details
- **Search Results**: 24-hour cache with cache busting for new queries
- **History Cache**: 7-day cache for recently shown games (prevents repetition)

## 🚨 Error Handling

The API gracefully handles:
- Missing API keys (continues with available sources)
- Rate limit exceeded (falls back to cached data)
- Network timeouts (returns partial results)
- Invalid game IDs (returns 404)

## 🔄 Migration from IGDB

### Breaking Changes
1. **Game IDs**: Now prefixed with source (`rawg_123` instead of `123`)
2. **Rating Scale**: RAWG uses 0-5 scale (converted to 0-100)
3. **Platform Format**: Simplified platform names
4. **Field Names**: Some field names have changed for consistency

### Backward Compatibility
- All existing routes maintained
- Same response structure for core fields
- Firebase integration unchanged

## 🛡️ Rate Limiting & Best Practices

### API Key Limits (Free Tiers)
- **RAWG**: 20,000 requests/day
- **Giant Bomb**: 200 requests/day
- **TheGamesDB**: 1000 requests/hour
- **Steam**: Unlimited (basic endpoints)

### Optimization Tips
1. **Use pagination**: Avoid fetching too many games at once
2. **Cache results**: The built-in caching reduces API calls
3. **Search wisely**: Use specific search terms
4. **Monitor usage**: Check `/api-status` endpoint regularly

## 🧪 Testing

Test the API without API keys using:

```bash
node test-api.js
```

This will show you the API structure and demonstrate fallback behavior.

## 📊 Monitoring

- Check `/health` endpoint for system status
- Monitor `/api-status` for individual API availability
- View console logs for detailed error information

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Issues**: GitHub Issues
- **Documentation**: This README
- **API Status**: Use `/api-status` endpoint

---

**Note**: This API replaces the previous IGDB-only implementation with a more robust, multi-source approach that provides better coverage and reliability.