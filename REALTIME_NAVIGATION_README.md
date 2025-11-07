# Real-time Navigation System for OHIF

## 🎯 Overview

This system enables **real-time surgical navigation** in OHIF by continuously updating the crosshair position and MPR planes at **20Hz** based on tracking data from an external source.

### Architecture

```
┌─────────────────────────────┐
│  Python Tracking Server     │  ← Simulates tracking device
│  (WebSocket @ 8765)          │     (20Hz updates)
│  tracking_server.py          │
└──────────────┬──────────────┘
               │ WebSocket
               ↓
┌─────────────────────────────┐
│  OHIF Viewer                 │
│  ┌─────────────────────────┐│
│  │ TrackingService         ││  ← WebSocket client
│  │ (platform/core/services)││
│  └───────────┬─────────────┘│
│              ↓               │
│  ┌─────────────────────────┐│
│  │ NavigationController    ││  ← Updates crosshair
│  │ (extensions/cornerstone)││
│  └───────────┬─────────────┘│
│              ↓               │
│  ┌─────────────────────────┐│
│  │ Crosshair Tool          ││  ← Moves at 20Hz
│  │ MPR Viewports           ││
│  └─────────────────────────┘│
└─────────────────────────────┘
```

---

## 🚀 Quick Start

### **1. Install Python Dependencies**

```bash
cd /home/asclepius/github/Viewers
pip install -r requirements.txt
```

### **2. Start the Tracking Server**

```bash
python3 tracking_server.py
```

You should see:

```
🚀 OHIF Real-time Tracking Server
📡 WebSocket Server: ws://localhost:8765
🔄 Update Rate: 20Hz (50ms intervals)
📊 Tracking Modes: circular, linear, random
✅ Server started successfully
⏳ Waiting for OHIF client connections...
```

### **3. Start OHIF Viewer**

```bash
cd /home/asclepius/github/Viewers
yarn dev
```

### **4. Load a Study with MPR**

1. Open OHIF at `http://localhost:3000`
2. Load a CT/MRI study (multi-slice volume)
3. Switch to MPR view (crosshairs enabled)

### **5. Start Navigation**

Click the **"Real-time Navigation"** button in the toolbar (navigation icon).

You should now see:
- ✅ Crosshair moving automatically at 20Hz
- ✅ MPR planes updating in real-time
- ✅ Console logs showing tracking data

---

## 📋 Features

### Tracking Modes

The server supports three simulation modes:

1. **Circular Mode** (default)
   - Crosshair moves in a circular path in the axial plane
   - Simulates smooth tracking motion
   - Good for demonstrations

2. **Linear Mode**
   - Crosshair oscillates along a straight line
   - Simulates scanning motion

3. **Random Walk**
   - Crosshair moves randomly with small jitter
   - Simulates realistic hand-held tracking

### Commands

| Command | Description |
|---------|-------------|
| `startNavigation` | Start tracking with specified mode |
| `stopNavigation` | Stop tracking |
| `toggleNavigation` | Toggle tracking on/off |
| `setTrackingCenter` | Set tracking origin to current crosshair position |

---

## 🔧 Technical Details

### Tracking Server

**File:** `tracking_server.py`

- **WebSocket Port:** 8765
- **Update Rate:** 20Hz (50ms intervals)
- **Protocol:** JSON over WebSocket
- **Coordinate System:** DICOM patient coordinates (LPS)

#### Message Format

**Tracking Update (Server → Client):**

```json
{
  "type": "tracking_update",
  "data": {
    "position": [x, y, z],           // mm in patient coords
    "orientation": [nx, ny, nz],      // normal vector
    "timestamp": 1699999999.999,      // Unix timestamp
    "frame_id": 123                   // Frame counter
  },
  "mode": "circular",
  "active": true
}
```

**Commands (Client → Server):**

```json
{
  "command": "start_tracking",
  "mode": "circular"
}
```

```json
{
  "command": "stop_tracking"
}
```

```json
{
  "command": "set_center",
  "position": [x, y, z]
}
```

```json
{
  "command": "set_mode",
  "mode": "linear"
}
```

### OHIF Integration

**Files Modified:**

1. **TrackingService** (`platform/core/src/services/TrackingService/`)
   - WebSocket client
   - Connection management
   - Event broadcasting

2. **NavigationController** (`extensions/cornerstone/src/utils/navigationController.ts`)
   - Subscribes to tracking updates
   - Updates crosshair position at 20Hz
   - Handles MPR synchronization

3. **Commands Module** (`extensions/cornerstone/src/commandsModule.ts`)
   - `startNavigation` - Start tracking
   - `stopNavigation` - Stop tracking
   - `toggleNavigation` - Toggle
   - `setTrackingCenter` - Set origin

4. **Toolbar** (`modes/basic/src/`)
   - Added "Real-time Navigation" button
   - Icon: Navigation
   - Command: `toggleNavigation`

---

## 🎮 Usage Examples

### Basic Usage

```javascript
// Start circular navigation
commandsManager.runCommand('startNavigation', { mode: 'circular' });

// Stop navigation
commandsManager.runCommand('stopNavigation');

// Toggle navigation
commandsManager.runCommand('toggleNavigation', { mode: 'circular' });
```

### Set Custom Origin

```javascript
// Set tracking center to current crosshair position
commandsManager.runCommand('setTrackingCenter');

// Now circular motion will be centered at that point
commandsManager.runCommand('startNavigation', { mode: 'circular' });
```

### Programmatic Control

```javascript
// Access tracking service
const { trackingService } = servicesManager.services;

// Connect to custom tracking server
trackingService.connect('ws://192.168.1.100:8765');

// Subscribe to tracking updates
trackingService.subscribe('event::tracking_update', (data) => {
  console.log('Position:', data.position);
  console.log('Orientation:', data.orientation);
});

// Start tracking
trackingService.startTracking('circular');

// Get status
const status = trackingService.getStatus();
console.log('Connected:', status.connected);
console.log('Tracking:', status.tracking);

// Get stats
const stats = trackingService.getStats();
console.log('Average FPS:', stats.averageFPS);
console.log('Frames received:', stats.framesReceived);
```

---

## 🔌 Integrating Real Tracking Hardware

To connect a real surgical tracking system:

### Option 1: Replace Tracking Server

Replace `tracking_server.py` with your own WebSocket server that:

1. Connects to your tracking hardware (NDI, Polaris, etc.)
2. Sends position/orientation data at 20Hz in the same JSON format
3. Maintains the same WebSocket protocol

### Option 2: Modify Existing Server

Modify `tracking_server.py`:

```python
import your_tracking_sdk

class RealTrackingSimulator:
    def __init__(self):
        self.tracker = your_tracking_sdk.connect()

    def get_tracking_data(self, mode="circular"):
        # Get position from real hardware
        position = self.tracker.get_position()  # [x, y, z]
        orientation = self.tracker.get_orientation()  # [nx, ny, nz]

        return {
            "position": position,
            "orientation": orientation,
            "timestamp": time.time(),
            "frame_id": self.tracker.get_frame_id()
        }

# Replace simulator
simulator = RealTrackingSimulator()
```

---

## 📊 Performance Monitoring

### Browser Console

```javascript
// Check navigation status
window.__navigationController?.getStatus()

// Output:
// {
//   navigating: true,
//   updateCount: 1234
// }
```

### Server Logs

The server logs every 100 updates:

```
🔄 Navigation update #100 (20.1 Hz) - Position: 50.2, -30.5, 125.3
🔄 Navigation update #200 (19.8 Hz) - Position: 48.7, -32.1, 126.8
```

---

## 🐛 Troubleshooting

### Server Won't Start

**Error:** `Address already in use`

```bash
# Check if port 8765 is in use
lsof -i :8765

# Kill the process
kill -9 <PID>
```

### OHIF Can't Connect

1. **Check server is running:**

```bash
# Should show the server process
ps aux | grep tracking_server
```

2. **Test WebSocket connection:**

```bash
# Install wscat
npm install -g wscat

# Connect to server
wscat -c ws://localhost:8765
```

3. **Check browser console for errors:**
   - Open DevTools (F12)
   - Look for WebSocket connection errors

### Crosshair Not Moving

1. **Check navigation is active:**

```javascript
window.__navigationController?.getStatus()
// Should show: { navigating: true, ... }
```

2. **Check tracking service:**

```javascript
const { trackingService } = servicesManager.services;
trackingService.getStatus();
// Should show: { connected: true, tracking: true }
```

3. **Check crosshair tool is active:**
   - MPR view must be active
   - Crosshairs tool must be enabled

### Low Frame Rate

If updates are <20Hz:

1. **Check browser performance:**
   - Close other tabs
   - Reduce viewport complexity

2. **Check network latency:**
   - Server should be on localhost
   - Use wired connection if remote

3. **Check rendering performance:**
   - Large volumes may slow rendering
   - Consider reducing viewport resolution

---

## 🎨 Customization

### Change Update Rate

In `tracking_server.py`:

```python
# Change from 20Hz to 30Hz (33ms intervals)
await asyncio.sleep(0.033)  # Was 0.05 for 20Hz
```

### Customize Motion Path

Add your own path in `TrackingSimulator`:

```python
def get_spiral_path(self):
    """Simulate spiral motion"""
    angle = self.t * 0.5
    radius = self.t * 2  # Expanding radius
    x = self.center[0] + radius * math.cos(angle)
    y = self.center[1] + radius * math.sin(angle)
    z = self.center[2] + self.t * 5  # Move up

    self.t += 0.05

    return {
        "position": [x, y, z],
        "orientation": [0, 0, 1],
        "timestamp": time.time(),
        "frame_id": int(self.t * 20)
    }
```

### Add Toolbar Hotkey

In `modes/basic/src/toolbarButtons.ts`:

```typescript
{
  id: 'RealTimeNavigation',
  uiType: 'ohif.toolButton',
  props: {
    icon: 'Navigation',
    label: i18n.t('Buttons:Real-time Navigation'),
    tooltip: i18n.t('Buttons:Enable real-time surgical navigation'),
    commands: 'toggleNavigation',
    evaluate: 'evaluate.action',
    hotkey: 'Ctrl+N',  // Add this line
  },
},
```

---

## 📝 License

This integration is part of the OHIF Viewer project.

---

## 🤝 Contributing

To improve this navigation system:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📚 References

- [OHIF Viewer Documentation](https://docs.ohif.org/)
- [Cornerstone3D Documentation](https://www.cornerstonejs.org/)
- [WebSocket Protocol](https://datatracker.ietf.org/doc/html/rfc6455)
- [DICOM Coordinate Systems](https://dicom.nema.org/medical/dicom/current/output/chtml/part17/chapter_FFF.html)

---

**Happy Navigating! 🧭**

