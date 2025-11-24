#!/bin/bash

# IGDB IMPORT FIX - Production Server
# Copy and run this command to fix the "igdb is not a function" error:

echo "🔧 APPLYING IGDB IMPORT FIX..."

# Navigate to production directory
cd /root/gameAPI/apiGame

# Stop current PM2 process
echo "🛑 Stopping current PM2 process..."
pm2 stop gameApi

# Copy the fixed index.js (from current local version)
echo "📋 Copying fixed index.js..."
# Note: You'll need to manually copy the updated index.js file to production

# Or if you have the fixed file locally, uncomment and modify this:
# scp /path/to/fixed/index.js root@your-server:/root/gameAPI/apiGame/index.js

# Install dependencies (igdb-api-node might still be needed for other packages)
echo "📦 Installing dependencies..."
npm install

# Start PM2 process
echo "🚀 Starting PM2 process..."
pm2 start index.js --name gameApi --update-env

# Check status
sleep 3
if pm2 list | grep -q "online.*gameApi"; then
    echo "✅ SUCCESS! gameApi is now running with IGDB fix"
    echo ""
    echo "🧪 Testing API..."
    curl -s http://localhost:3002/health | grep -q "OK" && echo "✅ Health check passed" || echo "⚠️  Health check failed"
    
    echo ""
    echo "📊 API Status:"
    curl -s http://localhost:3002/api-status
else
    echo "❌ FAILED! Check logs: pm2 logs gameApi"
    exit 1
fi

echo ""
echo "🎉 FIX APPLIED!"