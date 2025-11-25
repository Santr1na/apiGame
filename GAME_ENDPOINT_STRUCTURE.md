# Game Endpoint Structure Documentation

## Overview

I've created a new endpoint structure based on your `processGame` function to provide a standardized game data format for both server implementations.

## Endpoints

### 1. `/games/:id` (Existing - Enhanced)
Returns comprehensive game data with enhanced features.

### 2. `/games/:id/processed` (New - processGame Structure)
Returns game data in the exact structure you specified.

## New Endpoint: `/games/:id/processed`

### Supported Servers
- **Regular API Server**: `node index.js` (port 3002)
- **Database API Server**: `node index-with-db.js` (port 3003)

Both servers support the same endpoint structure but with different data sources:
- **Regular Server**: API-first with multiple game sources (IGDB, RAWG, Giant Bomb, Steam, TheGamesDB)
- **Database Server**: Database-first with API fallback

### Supported Game IDs
- `igdb_{id}` - IGDB games (primary support in regular server)
- `rawg_{id}` - RAWG games (supported in both servers)

### Response Structure

```json
{
  "id": "rawg_12345",
  "name": "Game Name",
  "genres": ["Action", "Adventure"],
  "platforms": ["PC", "PlayStation"],
  "release_date": "2023-10-15",
  "rating": 85,
  "rating_type": "Critics",
  "cover_image": "https://image-url.jpg",
  "age_ratings": ["ESRB: M", "PEGI: 18"],
  "summary": "Game description...",
  "developers": ["Developer Name"],
  "videos": ["https://www.youtube.com/watch?v=video_id"],
  "similar_games": [
    {
      "id": "rawg_67890",
      "name": "Similar Game",
      "cover_image": "https://similar-game-url.jpg",
      "critic_rating": 80,
      "release_year": 2023,
      "main_genre": "Action",
      "platforms": ["PC"]
    }
  ],
  "favorite": 42,
  "playing": 15,
  "ill_play": 28,
  "passed": 12,
  "postponed": 5,
  "abandoned": 3
}
```

### Features

- **Consistent Structure**: All games return the same field structure
- **Multi-Server Support**: Works with both API and Database servers
- **Smart Fallbacks**: Database server converts formats automatically
- **Similar Games**: Automatically fetches 3 similar games (where available)
- **Favorite Counts**: Shows favorite count for the game
- **Status Counts**: Shows user status counts (playing, will play, passed, etc.)

### Usage Examples

```bash
# Regular API Server (port 3002)
curl http://localhost:3002/games/rawg_123/processed

# Database API Server (port 3003)
curl http://localhost:3003/games/rawg_123/processed

# Both servers also support the enhanced endpoint
curl http://localhost:3002/games/rawg_123
curl http://localhost:3003/games/rawg_123
```

## Implementation Details

### processGame Function (Both Servers)
- Loads favorite counts from Firestore
- Loads status counts from Firestore
- Processes cover images with fallback handling
- Fetches similar games (where available)
- Handles multiple rating types (Critics vs Users)
- Maps age ratings to readable format

### Server-Specific Adaptations

#### Regular API Server (`index.js`)
- **IGDB Priority**: Best support for IGDB games with full feature set
- **Multi-Source**: Supports IGDB, RAWG, Giant Bomb, Steam, TheGamesDB
- **Direct Processing**: Games are processed directly from API responses

#### Database API Server (`index-with-db.js`)
- **Database-First**: Checks database before making API calls
- **Format Conversion**: Automatically converts database format to processGame structure
- **Caching**: Saves fetched games to database for future requests

### Helper Functions
- `getGameCover()` - Smart cover image fetching with Steam fallback
- `loadFavoriteCounts()` - Gets favorite counts from Firestore
- `loadStatusCounts()` - Gets user status counts from Firestore

## Migration Guide

To migrate from the old structure to the new one:

1. Use `/games/:id/processed` instead of `/games/:id`
2. Choose your preferred server (API-first or Database-first)
3. The response will have a consistent structure regardless of data source
4. Some fields may have default values ('N/A') if not available from source

## Benefits

1. **Consistency**: Same response structure for all games
2. **Multi-Server**: Choose between API-first or Database-first approach
3. **Completeness**: Includes all requested fields with sensible defaults
4. **Reliability**: Handles missing data gracefully
5. **Performance**: Database server caches results for better performance
6. **Extensibility**: Easy to add more fields or sources

## Testing

Run the test suite to verify both servers:
```bash
node test-process-game-endpoint.js
```

Or test manually:
```bash
# Start regular server
node index.js

# Start database server  
node index-with-db.js

# Test both endpoints
curl http://localhost:3002/games/rawg_123/processed
curl http://localhost:3003/games/rawg_123/processed
```