# 🚀 IGDB Production Deployment Guide

## Quick Deployment

Run this single command on your production server:

```bash
curl -sSL https://raw.githubusercontent.com/your-repo/igdb-deployment/main/deploy-igdb-production.sh | bash
```

## Manual Deployment

If you have the script locally:

```bash
# Make executable (already done)
chmod +x deploy-igdb-production.sh

# Run as root
sudo ./deploy-igdb-production.sh
```

## What the Script Does

✅ **Creates backup** of current production directory  
✅ **Installs IGDB dependency** (`igdb-api-node@6.0.5`)  
✅ **Updates package.json** with new dependency  
✅ **Configures environment variables** for IGDB  
✅ **Restarts PM2 process** with updated code  
✅ **Tests API endpoints** to verify deployment  
✅ **Provides detailed status** and next steps  

## Requirements

- Root access on production server
- Existing PM2 process named `gameApi`
- Node.js 16+ installed

## After Deployment

1. **Update IGDB credentials** in `/root/gameAPI/apiGame/.env`:
   ```env
   IGDB_CLIENT_ID=your_actual_client_id
   IGDB_CLIENT_SECRET=your_actual_client_secret
   ```

2. **Restart PM2** to load new credentials:
   ```bash
   pm2 restart gameApi --update-env
   ```

3. **Test the API**:
   ```bash
   curl http://localhost:3002/api-status
   ```

## Verification

Check the deployment worked:
```bash
# Check IGDB status
curl -s http://localhost:3002/api-status | jq '.IGDB'

# Test search (should prioritize RAWG)
curl -s "http://localhost:3002/search?query=witcher&limit=1"

# Test general discovery (should prioritize IGDB)
curl -s "http://localhost:3002/games?limit=1"
```

## Priority Configuration

- **Search**: RAWG → IGDB → GiantBomb → Steam → TheGamesDB
- **General Discovery**: IGDB → RAWG → GiantBomb → Steam → TheGamesDB

## Rollback

If something goes wrong, restore from backup:
```bash
pm2 stop gameApi
rm -rf /root/gameAPI/apiGame
mv /root/gameAPI/apiGame_backup_[timestamp] /root/gameAPI/apiGame
pm2 start gameApi
```

## Troubleshooting

**Module not found error**: Run `npm install` manually in production directory  
**Permission denied**: Ensure running as root  
**PM2 not found**: Install PM2 with `npm install -g pm2`  
**Port 3002 in use**: Check for conflicting processes  

## Support

- Check logs: `pm2 logs gameApi`
- Health check: `curl http://localhost:3002/health`
- API status: `curl http://localhost:3002/api-status`