#!/bin/bash

echo "=================================================="
echo "🚀 OHIF Real-time Navigation Demo"
echo "=================================================="
echo ""

# Check if tracking server is already running
if pgrep -f tracking_server.py > /dev/null; then
    echo "⚠️  Tracking server already running"
    echo "   To restart: pkill -f tracking_server.py"
else
    echo "📡 Starting tracking server (WebSocket @ 8765)..."
    python3 tracking_server.py &
    TRACKING_PID=$!
    sleep 2

    if ps -p $TRACKING_PID > /dev/null; then
        echo "✅ Tracking server started (PID: $TRACKING_PID)"
    else
        echo "❌ Failed to start tracking server"
        exit 1
    fi
fi

echo ""
echo "=================================================="
echo "📋 Next Steps:"
echo "=================================================="
echo ""
echo "1. Start OHIF (in another terminal):"
echo "   cd /home/asclepius/github/Viewers"
echo "   yarn dev"
echo ""
echo "2. Open OHIF in browser:"
echo "   http://localhost:3000"
echo ""
echo "3. Load a CT/MRI study with multiple slices"
echo ""
echo "4. Switch to MPR view (enable Crosshairs)"
echo ""
echo "5. Click 'Real-time Navigation' button in toolbar"
echo ""
echo "6. Watch crosshair move automatically at 20Hz!"
echo ""
echo "=================================================="
echo "📊 Monitoring:"
echo "=================================================="
echo ""
echo "• Check tracking server:"
echo "  ps aux | grep tracking_server"
echo ""
echo "• Test WebSocket connection:"
echo "  wscat -c ws://localhost:8765"
echo ""
echo "• View browser console for tracking updates"
echo ""
echo "=================================================="
echo "🛑 To Stop:"
echo "=================================================="
echo ""
echo "• Stop tracking server:"
echo "  pkill -f tracking_server.py"
echo ""
echo "• Stop OHIF:"
echo "  lsof -t -i:3000 | xargs kill -9"
echo ""
echo "=================================================="

