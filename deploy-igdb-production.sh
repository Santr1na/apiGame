#!/bin/bash

# IGDB Production Deployment Script
# This script updates your production server with IGDB integration

set -e

echo "🚀 Starting IGDB Production Deployment..."

# Configuration
PRODUCTION_DIR="/root/gameAPI/apiGame"
BACKUP_DIR="/root/gameAPI/apiGame_backup_$(date +%Y%m%d_%H%M%S)"
NODE_VERSION="18"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root"
    exit 1
fi

print_status "Creating backup of current production directory..."
if [ -d "$PRODUCTION_DIR" ]; then
    cp -r "$PRODUCTION_DIR" "$BACKUP_DIR"
    print_status "Backup created at: $BACKUP_DIR"
fi

print_status "Checking Node.js version..."
NODE_CURRENT=$(node -v 2>/dev/null || echo "not_installed")
print_status "Current Node.js version: $NODE_CURRENT"

if [[ "$NODE_CURRENT" < "v$NODE_VERSION" ]]; then
    print_warning "Node.js version $NODE_CURRENT found. Recommending v$NODE_VERSION or higher."
fi

print_status "Navigating to production directory..."
cd "$PRODUCTION_DIR" || {
    print_error "Production directory not found: $PRODUCTION_DIR"
    exit 1
}

print_status "Updating package.json with IGDB dependency..."
if grep -q '"igdb-api-node"' package.json; then
    print_status "IGDB dependency already exists in package.json"
else
    # Add IGDB dependency using npm
    npm install --save igdb-api-node@6.0.5
    print_status "IGDB dependency added successfully"
fi

print_status "Installing/updating all dependencies..."
npm install

print_status "Updating environment variables..."
ENV_FILE="$PRODUCTION_DIR/.env"

# Add IGDB environment variables if they don't exist
if ! grep -q "IGDB_CLIENT_ID" "$ENV_FILE" 2>/dev/null; then
    echo "" >> "$ENV_FILE"
    echo "# IGDB API Configuration (Optional - for primary data source)" >> "$ENV_FILE"
    echo "# Get credentials from: https://api.igdb.com/signup/" >> "$ENV_FILE"
    echo "IGDB_CLIENT_ID=your_igdb_client_id_here" >> "$ENV_FILE"
    echo "IGDB_CLIENT_SECRET=your_igdb_client_secret_here" >> "$ENV_FILE"
    print_status "IGDB environment variables added to .env (update with your credentials)"
else
    print_status "IGDB environment variables already exist in .env"
fi

print_status "Checking PM2 status..."
if command -v pm2 &> /dev/null; then
    PM2_STATUS=$(pm2 list | grep gameApi || echo "not_found")
    if [[ "$PM2_STATUS" == *"gameApi"* ]]; then
        print_status "Found gameApi process in PM2"
        
        print_status "Stopping PM2 process..."
        pm2 stop gameApi
        
        print_status "Restarting PM2 process with updated environment..."
        pm2 restart gameApi --update-env
        
        print_status "Waiting for process to start..."
        sleep 5
        
        # Check if process is running
        if pm2 list | grep -q "online.*gameApi"; then
            print_status "✅ gameApi is now running successfully!"
        else
            print_error "❌ gameApi failed to start. Check logs:"
            pm2 logs gameApi --lines 10
            exit 1
        fi
    else
        print_warning "gameApi process not found in PM2. Starting it..."
        pm2 start index.js --name gameApi --update-env
    fi
else
    print_warning "PM2 not found. Please install PM2 and start the application manually."
fi

print_status "Testing API endpoints..."

# Test health endpoint
HEALTH_RESPONSE=$(curl -s http://localhost:3002/health 2>/dev/null || echo "failed")
if [[ "$HEALTH_RESPONSE" == *"OK"* ]]; then
    print_status "✅ Health endpoint working"
else
    print_warning "⚠️  Health endpoint test failed (server might still be starting)"
fi

# Test API status endpoint  
STATUS_RESPONSE=$(curl -s http://localhost:3002/api-status 2>/dev/null || echo "failed")
if [[ "$STATUS_RESPONSE" == *"IGDB"* ]]; then
    print_status "✅ API status endpoint working"
else
    print_warning "⚠️  API status endpoint test failed"
fi

print_status "Deployment Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
print_status "✅ IGDB integration deployed successfully"
print_status "📦 Dependencies installed"
print_status "🔧 Environment variables configured"
print_status "🚀 PM2 process updated"
print_status ""
print_status "Next steps:"
print_status "1. Update .env file with your IGDB credentials (optional)"
print_status "2. Restart PM2: pm2 restart gameApi --update-env"
print_status "3. Test the API: curl http://localhost:3002/api-status"
print_status ""
print_status "Priority configuration:"
print_status "• General discovery: IGDB → RAWG → others"
print_status "• Search results: RAWG → IGDB → others"
print_status ""
if [ -d "$BACKUP_DIR" ]; then
    print_status "📁 Backup created at: $BACKUP_DIR"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

print_status "🎉 IGDB deployment completed successfully!"