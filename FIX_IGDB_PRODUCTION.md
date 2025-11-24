# Fix IGDB Integration on Production Server

## Problem
The PM2 production server is running an older version of the code that doesn't have the IGDB dependency installed, causing `MODULE_NOT_FOUND` errors.

## Solution

### Step 1: Navigate to Production Directory
```bash
cd /root/gameAPI/apiGame
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Update Environment Variables
Add IGDB credentials to your production `.env` file:
```env
IGDB_CLIENT_ID=your_igdb_client_id_here
IGDB_CLIENT_SECRET=your_igdb_client_secret_here
```

### Step 4: Restart PM2 with Environment Update
```bash
pm2 restart gameApi --update-env
```

### Step 5: Verify Status
```bash
pm2 list
pm2 logs gameApi
```

## Expected Output
After successful restart, you should see:
```
✔️  gameApi online
```

## Test Endpoints
```bash
curl http://localhost:3002/health
curl http://localhost:3002/api-status
curl "http://localhost:3002/search?query=witcher&limit=2"
```

## Notes
- The IGDB dependency `igdb-api-node@6.0.5` has been added to package.json
- IGDB will gracefully skip if credentials are not configured
- Search prioritizes RAWG first, then IGDB (as requested)
- General discovery prioritizes IGDB first, then other sources