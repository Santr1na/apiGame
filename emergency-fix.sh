#!/bin/bash

# EMERGENCY PRODUCTION FIX
# Copy and paste this entire command block to fix your PM2 server:

echo "🔧 FIXING PRODUCTION SERVER..."

# Navigate to production directory
cd /root/gameAPI/apiGame || {
    echo "❌ Production directory not found!"
    exit 1
}

# Install the missing IGDB dependency
echo "📦 Installing IGDB dependency..."
npm install igdb-api-node@6.0.5 --silent

# Check if installation was successful
if [ $? -eq 0 ]; then
    echo "✅ IGDB dependency installed successfully"
else
    echo "❌ Failed to install IGDB dependency"
    exit 1
fi

# Restart PM2 with updated environment
echo "🔄 Restarting PM2 process..."
pm2 restart gameApi --update-env

# Wait a moment for startup
sleep 3

# Check status
if pm2 list | grep -q "online.*gameApi"; then
    echo "✅ SUCCESS! gameApi is now running"
    echo ""
    echo "🧪 Testing API..."
    curl -s http://localhost:3002/health | grep -q "OK" && echo "✅ Health check passed" || echo "⚠️  Health check failed"
    
    echo ""
    echo "📊 API Status:"
    curl -s http://localhost:3002/api-status
else
    echo "❌ FAILED! gameApi is not running"
    echo "Check logs: pm2 logs gameApi"
    exit 1
fi

echo ""
echo "🎉 DEPLOYMENT COMPLETE!"