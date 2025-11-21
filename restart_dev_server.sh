#!/bin/bash
# Restart webpack dev server with new proxy configuration

echo "======================================================================"
echo "Restarting Webpack Dev Server (Phase 4 Proxy Configuration)"
echo "======================================================================"

cd /Users/ronaldtse/development/LifeSyncRobotics/Viewers/platform/app

echo ""
echo "1. Stopping any existing webpack processes..."
pkill -f "webpack serve" 2>/dev/null && echo "   ✓ Stopped" || echo "   - Not running"

echo ""
echo "2. Starting webpack dev server with new proxy configuration..."
echo "   This will take 30-60 seconds to compile..."
echo ""
echo "   Watch for this line:"
echo "   ℹ [HPM] Proxy created: ['/api']  ->  http://localhost:3001"
echo ""

# Start in foreground so user can see the proxy initialization
yarn dev
