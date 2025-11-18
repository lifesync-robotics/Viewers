# Navigation Fix Summary

## 🎯 Changes Made

### 1. **Added Update Hz Display**
- Replaced "WebSocket Status" with "Update Rate" showing real-time Hz
- Calculates Hz from tracking frames received in last 2 seconds
- Shows `-- Hz` when no data, `XX.X Hz` when receiving data

### 2. **Enhanced Navigation Debugging**
- Added comprehensive console logging for navigation start
- Checks WebSocket connection before starting navigation
- Better error messages for troubleshooting

### 3. **Improved Frame Rate Calculation**
- Tracks frame timestamps in a rolling 2-second window
- Calculates and displays update rate in real-time
- Rounds to 1 decimal place for clarity

## 🐛 Issue Identified

### **Problem**: Navigation starts but crosshair doesn't move

**Root Cause**: WebSocket is not properly subscribing to tracking data stream

**Evidence**:
```
Frame 3800 | Rate: 82.4 Hz | Clients: 0
                              ^^^^^^^^^^
                              No WebSocket clients connected!
```

The tracking simulator is running and sending data at ~82 Hz to the Protobuf Bridge, but the WebSocket from OHIF is not receiving it because:
1. Either the WebSocket connection is not being established
2. Or the subscription to `tracking_data` channel is not working

## 🔍 Diagnostic Steps

### Check if tracking data is flowing:

```bash
# 1. Check tracking simulator is running
ps aux | grep tracking_simulator

# 2. Check SyncForge API logs
tail -f /tmp/syncforge_api.log | grep "Clients:"

# 3. Check browser console for WebSocket messages
# Open DevTools (F12) -> Console
# Look for: "📡 Connecting to tracking WebSocket"
# Look for: "✅ Tracking WebSocket connected"
# Look for: "📊 Tracking data received"
```

### Expected Flow:

```
┌─────────────────────┐
│ Tracking Simulator  │ (Python, Port 9999)
│   82 Hz             │
└──────────┬──────────┘
           │ TCP/Protobuf
           ▼
┌─────────────────────┐
│ Protobuf Bridge     │ (Node.js, in SyncForge API)
│   Decodes & Formats │
└──────────┬──────────┘
           │ WebSocket
           ▼
┌─────────────────────┐
│ OHIF TrackingPanel  │ (Browser)
│   Displays Hz       │
└─────────────────────┘
```

## 🔧 What to Check Next

### 1. **WebSocket Connection URL**

The TrackingPanel connects to:
```javascript
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const host = window.location.port === '8081' ? window.location.host : 'localhost:3001';
const wsUrl = `${protocol}//${host}/ws/tracking`;
```

**Check in browser console**:
- What URL is it trying to connect to?
- Is the connection successful?

### 2. **WebSocket Subscription**

After connection, it should send:
```javascript
{
  type: 'subscribe',
  channels: ['tracking_data', 'alerts']
}
```

**Check in browser console**:
- Is this subscription message being sent?
- Is the server acknowledging it?

### 3. **Server-Side WebSocket Handler**

File: `AsclepiusPrototype/00_SyncForgeAPI/api/tracking/trackingWebSocketHandler.js`

**Check**:
- Is the WebSocket handler properly broadcasting tracking data?
- Is it receiving data from the Protobuf Bridge?
- Are clients being registered correctly?

## 🎨 UI Changes Made

### Before:
```
🧭 Navigation Control
├── WebSocket Status: ● Connected
└── Navigation Status: ● Inactive
```

### After:
```
🧭 Navigation Control
├── Update Rate: 82.4 Hz  (or -- Hz if no data)
└── Navigation: ● Inactive
```

## 📝 Code Changes

### File: `TrackingPanel.tsx`

#### New State Variables:
```typescript
const [updateHz, setUpdateHz] = React.useState<number>(0);
const frameTimestampsRef = React.useRef<number[]>([]);
```

#### Hz Calculation Logic:
```typescript
// In ws.onmessage handler
const now = Date.now();
frameTimestampsRef.current.push(now);

// Keep only last 2 seconds
const twoSecondsAgo = now - 2000;
frameTimestampsRef.current = frameTimestampsRef.current.filter(t => t > twoSecondsAgo);

// Calculate Hz
if (frameTimestampsRef.current.length > 1) {
  const hz = frameTimestampsRef.current.length / 2;
  setUpdateHz(Math.round(hz * 10) / 10);
}
```

#### Enhanced Navigation Start:
```typescript
const handleStartNavigation = React.useCallback(async () => {
  console.log('🚀 Starting navigation from TrackingPanel...');
  console.log('  - WebSocket connected:', wsConnected);
  console.log('  - Tracking frame available:', !!trackingFrame);
  console.log('  - CommandsManager available:', !!commandsManager);

  if (!wsConnected) {
    setError('WebSocket not connected. Please wait for connection.');
    return;
  }

  // ... rest of handler
}, [commandsManager, wsConnected, trackingFrame]);
```

## 🚀 Next Steps to Fix Navigation

### Option 1: Check WebSocket in Browser Console

1. Open OHIF: http://localhost:3000
2. Open DevTools (F12) -> Console
3. Click "Start Navigation"
4. Look for these messages:
   - `🚀 Starting navigation from TrackingPanel...`
   - `📡 Connecting to tracking WebSocket: ws://localhost:3001/ws/tracking`
   - `✅ Tracking WebSocket connected`
   - `📊 Tracking data received: { frame: ..., tools: ..., hz: ... }`

### Option 2: Test WebSocket Manually

```javascript
// In browser console:
const ws = new WebSocket('ws://localhost:3001/ws/tracking');
ws.onopen = () => {
  console.log('Connected!');
  ws.send(JSON.stringify({ type: 'subscribe', channels: ['tracking_data'] }));
};
ws.onmessage = (e) => console.log('Message:', JSON.parse(e.data));
```

### Option 3: Check Server Logs

```bash
# Watch for WebSocket connections
tail -f /tmp/syncforge_api.log | grep -i "websocket\|client"
```

## 📊 Expected Behavior After Fix

When navigation is working correctly:

1. **Update Rate**: Should show `~82 Hz` (or configured simulator rate)
2. **Navigation Status**: Shows `● Active` (green)
3. **Crosshair**: Should move smoothly in the viewports
4. **Console**: Should show `📊 Tracking data received` messages continuously
5. **Tool Coordinates**: Should update in real-time in the panel

## 🎯 User Instructions

### To Start Navigation:

1. **Open OHIF**: http://localhost:3000
2. **Load a study** with volume data
3. **Open Tracking Panel**: Click three-dots icon (🔧) in sidebar
4. **Wait for Update Rate**: Should show `~82 Hz` (if showing `-- Hz`, tracking data is not flowing)
5. **Click "▶️ Start Navigation"**: Crosshair should start moving

### If Update Rate shows `-- Hz`:

This means tracking data is not reaching the browser. Check:
- Tracking simulator is running: `ps aux | grep tracking_simulator`
- SyncForge API is running: `curl http://localhost:3001/api/health`
- WebSocket is connected: Check browser console for errors
- Open browser console and look for WebSocket connection messages

---

**Status**: ✅ UI Updated, 🔍 Investigating WebSocket Connection
**Last Updated**: 2025-11-17 16:45
**Branch**: `server_deployment`
