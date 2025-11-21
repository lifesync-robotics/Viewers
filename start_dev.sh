#!/bin/bash
# Clean start of webpack dev server
# Phase 4: With API proxy configuration

echo "======================================================================"
echo "Starting OHIF Viewer Development Server"
echo "Phase 4: API Proxy Configuration"
echo "======================================================================"

cd /Users/ronaldtse/development/LifeSyncRobotics/Viewers/platform/app

# 1. Kill any existing processes
echo ""
echo "1. Cleaning up existing processes..."
pkill -f "webpack serve" 2>/dev/null && echo "   ✓ Stopped webpack" || echo "   - webpack not running"
pkill -f "modelServer" 2>/dev/null && echo "   ✓ Stopped model server" || echo "   - model server not running"

# Free up port 5001 if needed
if lsof -i :5001 > /dev/null 2>&1; then
    echo "   Freeing port 5001..."
    lsof -i :5001 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null
    sleep 1
fi

# Free up port 8081 if needed
if lsof -i :8081 > /dev/null 2>&1; then
    echo "   Freeing port 8081..."
    lsof -i :8081 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null
    sleep 1
fi

echo ""
echo "2. Starting development server..."
echo "   This will take 30-60 seconds to compile..."
echo ""
echo "   ⚠️  IMPORTANT: Watch for this line:"
echo "   ℹ [HPM] Proxy created: ['/api']  ->  http://localhost:3001"
echo ""
echo "   If you see that line, the proxy is configured correctly! ✅"
echo ""
echo "======================================================================"
echo ""

# Start dev server
yarn dev
