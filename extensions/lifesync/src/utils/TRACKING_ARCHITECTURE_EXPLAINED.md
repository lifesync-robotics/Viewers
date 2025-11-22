# Tracking Architecture: Component Relationships Explained

## 📊 Overview

This document explains the logical relationships between three key components in the tracking/navigation system:
1. **TrackingService.ts** - Data Reception Layer
2. **NavigationController.ts** - Viewport Update Layer
3. **TrackingPanel.tsx** - UI Presentation Layer

---

## 🔄 Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND (Python Tracking Server)                 │
│                    WebSocket: ws://localhost:3001/ws/tracking       │
│                    Frequency: 100Hz                                 │
└────────────────────┬────────────────────────────────────────────────┘
                     │ WebSocket Messages (JSON)
                     │ {
                     │   type: "tracking_data",
                     │   data: {
                     │     tools: {...},
                     │     position: [x, y, z],
                     │     matrix: [...],
                     │     ...
                     │   }
                     │ }
                     ↓
┌─────────────────────────────────────────────────────────────────────┐
│              1. TrackingService.ts                                  │
│              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                      │
│  Responsibilities:                                                   │
│  ✅ WebSocket connection management                                 │
│  ✅ Raw data reception (100Hz)                                      │
│  ✅ Data parsing and validation                                     │
│  ✅ Event broadcasting (Pub/Sub pattern)                            │
│  ✅ Connection status management                                    │
│                                                                      │
│  Key Methods:                                                        │
│  • connect()               → Establish WebSocket connection         │
│  • disconnect()            → Close WebSocket                        │
│  • subscribe(event, cb)    → Subscribe to tracking events           │
│  • _handleMessage()        → Parse incoming WebSocket messages      │
│  • _handleTrackingUpdate() → Broadcast TRACKING_UPDATE event        │
│  • _broadcastEvent()       → Notify all subscribers                 │
│                                                                      │
│  Events Published:                                                   │
│  📡 'event::tracking_update'      → Tracking data (100Hz)          │
│  📡 'event::connection_status'    → Connection state changes       │
│  📡 'event::tracking_started'     → Navigation started             │
│  📡 'event::tracking_stopped'     → Navigation stopped             │
│                                                                      │
└────────────────────┬────────────────────────────────────────────────┘
                     │ Pub/Sub Event: 'event::tracking_update'
                     │ Event Payload: {
                     │   position: [x, y, z],
                     │   orientation: [rx, ry, rz],
                     │   matrix: [...],
                     │   timestamp: "...",
                     │   frame_id: 123,
                     │   tools: {...}
                     │ }
                     ↓
        ┌────────────┴────────────┐
        │                         │
        ↓                         ↓
┌──────────────────────┐  ┌──────────────────────────────┐
│ 2a. Navigation       │  │ 2b. TrackingPanel            │
│    Controller        │  │    (UI Display)              │
│    ━━━━━━━━━━━━━━━  │  │    ━━━━━━━━━━━━━━━━━━━━━━━━━│
│                      │  │                              │
│ Subscribes to:       │  │ Subscribes to:               │
│ • tracking_update    │  │ • tracking_update            │
│ • connection_status  │  │ • connection_status          │
│                      │  │                              │
│ Action:              │  │ Action:                      │
│ • Updates viewport   │  │ • Updates UI display         │
│   camera position    │  │ • Shows tool coordinates     │
│ • Applies transform  │  │ • Shows update rate (Hz)     │
│ • Renders at 20Hz    │  │ • Shows connection status    │
│                      │  │                              │
└──────────────────────┘  └──────────────────────────────┘
```

---

## 📦 Component Details

### 1. TrackingService.ts (Data Reception Layer)

**Role:** Event-driven data reception and distribution service

**Key Characteristics:**
- Singleton service registered with ServicesManager
- Uses Pub/Sub pattern (extends PubSubService)
- Throttles data at 100Hz max (configurable)
- Does NOT process or transform data
- Only broadcasts events

**Code Structure:**
```typescript
class TrackingService extends PubSubService {
  // Connection state
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private isTracking: boolean = false;

  // Data throttling
  private messageThrottleMs: number = 10; // 100Hz max

  // Event publishing
  public subscribe(event: string, callback: Function): Subscription;
  private _broadcastEvent(event: string, data: any): void;

  // WebSocket handlers
  private _connectWebSocket(wsUrl: string): void;
  private _handleMessage(message: any): void;
  private _handleTrackingUpdate(data: any): void {
    // Parses tracking data
    // Broadcasts 'event::tracking_update'
  }
}
```

**Relationship with others:**
- **Called by:** TrackingPanel (via commands), NavigationController (indirectly)
- **Calls:** No direct calls to other components (publishes events only)
- **Pattern:** Observer/Publisher pattern

---

### 2. NavigationController.ts (Viewport Update Layer)

**Role:** Processes tracking data and updates viewport visuals

**Key Characteristics:**
- Instantiated when navigation starts
- Subscribes to TrackingService events
- Applies coordinate transformations
- Throttles viewport updates to 20Hz
- Manages viewport camera state

**Code Structure:**
```typescript
class NavigationController {
  private servicesManager: any;
  private trackingSubscription: Subscription | null = null;
  private isNavigating: boolean = false;

  // Update throttling
  private targetFPS: number = 20;
  private minFrameTime: number = 1000 / this.targetFPS;

  // Coordinate transformation
  private coordinateTransformer: CoordinateTransformer;

  // Start/stop navigation
  public startNavigation(): void {
    // 1. Get trackingService from servicesManager
    const { trackingService } = this.servicesManager.services;

    // 2. Subscribe to tracking updates
    this.trackingSubscription = trackingService.subscribe(
      'event::tracking_update',
      this._handleTrackingUpdate.bind(this)
    );

    // 3. Connect to tracking server
    trackingService.connect();
  }

  // Handle tracking data
  private _handleTrackingUpdate(event: any): void {
    // 1. Throttle updates (100Hz → 20Hz)
    // 2. Transform coordinates (register → DICOM)
    // 3. Update viewport camera
    // 4. Render viewport
  }

  // Update viewport
  private _updateCrosshairPosition(position, orientation, matrix): void {
    // Updates all viewport cameras
    // Applies rotation if orientation tracking enabled
  }
}
```

**Relationship with others:**
- **Called by:** Commands (startNavigation/stopNavigation), TrackingPanel (via commands)
- **Subscribes to:** TrackingService ('event::tracking_update', 'event::connection_status')
- **Calls:** Cornerstone viewport APIs, coordinate transformer

**Data Flow:**
```
TrackingService Event → NavigationController._handleTrackingUpdate()
                                         ↓
                            Transform coordinates
                                         ↓
                            Update viewport camera
                                         ↓
                            Render viewport
```

---

### 3. TrackingPanel.tsx (UI Presentation Layer)

**Role:** React component displaying tracking status and controls

**Key Characteristics:**
- React functional component
- Subscribes to TrackingService for display updates
- Uses commands to control navigation
- Displays real-time tracking data
- Provides UI controls (start/stop buttons)

**Code Structure:**
```typescript
const TrackingPanel: React.FC = () => {
  // Get services
  const trackingService = servicesManager?.services?.trackingService;
  const commandsManager = servicesManager?.commandsManager;

  // State
  const [isNavigating, setIsNavigating] = useState(false);
  const [trackingFrame, setTrackingFrame] = useState(null);
  const [updateHz, setUpdateHz] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);

  // Subscribe to TrackingService events
  useEffect(() => {
    // Subscribe to connection status
    const connectionSub = trackingService.subscribe(
      'event::connection_status',
      (data) => setWsConnected(data.connected)
    );

    // Subscribe to tracking updates
    const trackingSub = trackingService.subscribe(
      'event::tracking_update',
      (data) => {
        // Update UI state
        setTrackingFrame({...data});

        // Calculate update rate
        updateHzCalculation();
      }
    );

    return () => {
      connectionSub?.unsubscribe();
      trackingSub?.unsubscribe();
    };
  }, [trackingService]);

  // Start navigation handler
  const handleStartNavigation = async () => {
    // Uses command to start navigation
    await commandsManager.runCommand('startNavigation', {
      mode: 'circular',
      trackingMode: selectedMode,
      enableOrientation: enableOrientation
    });
    setIsNavigating(true);
  };

  // Stop navigation handler
  const handleStopNavigation = () => {
    commandsManager.runCommand('stopNavigation');
    setIsNavigating(false);
  };

  return (
    <div>
      {/* UI Elements */}
      <button onClick={handleStartNavigation}>Start Navigation</button>
      <div>Update Rate: {updateHz} Hz</div>
      <div>Status: {wsConnected ? 'Connected' : 'Disconnected'}</div>
      {/* Display trackingFrame data */}
    </div>
  );
};
```

**Relationship with others:**
- **Called by:** React rendering system
- **Subscribes to:** TrackingService (for display data)
- **Calls:** Commands (startNavigation, stopNavigation)
- **Displays:** Real-time tracking data, connection status, update rates

**Data Flow:**
```
TrackingService Event → TrackingPanel subscription callback
                                 ↓
                    Update React state
                                 ↓
                    Re-render UI components
```

---

## 🔗 Complete Interaction Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                          User Interaction                            │
└────────────────────┬─────────────────────────────────────────────────┘
                     │
                     │ User clicks "Start Navigation" button
                     ↓
┌──────────────────────────────────────────────────────────────────────┐
│                    TrackingPanel.tsx                                 │
│  handleStartNavigation()                                             │
│    ↓                                                                 │
│  commandsManager.runCommand('startNavigation', {...})                │
└────────────────────┬─────────────────────────────────────────────────┘
                     │
                     │ Command execution
                     ↓
┌──────────────────────────────────────────────────────────────────────┐
│                    commandsModule.ts                                 │
│  startNavigation command                                             │
│    ↓                                                                 │
│  Creates/gets NavigationController instance                         │
│    ↓                                                                 │
│  navigationController.startNavigation()                              │
└────────────────────┬─────────────────────────────────────────────────┘
                     │
                     │ Method call
                     ↓
┌──────────────────────────────────────────────────────────────────────┐
│              NavigationController.ts                                 │
│  startNavigation()                                                   │
│    ↓                                                                 │
│  1. Subscribe to trackingService events                             │
│     trackingService.subscribe('event::tracking_update', ...)        │
│    ↓                                                                 │
│  2. Connect to tracking server                                      │
│     trackingService.connect()                                       │
└────────────────────┬─────────────────────────────────────────────────┘
                     │
                     │ WebSocket connection
                     ↓
┌──────────────────────────────────────────────────────────────────────┐
│                    TrackingService.ts                                │
│  connect()                                                           │
│    ↓                                                                 │
│  1. Fetch WebSocket URL from API                                    │
│     fetch('/api/tracking/connect')                                  │
│    ↓                                                                 │
│  2. Create WebSocket connection                                     │
│     this.ws = new WebSocket(wsUrl)                                  │
│    ↓                                                                 │
│  3. Set up message handler                                          │
│     this.ws.onmessage = this._handleMessage.bind(this)              │
└────────────────────┬─────────────────────────────────────────────────┘
                     │
                     │ WebSocket messages arrive (100Hz)
                     ↓
┌──────────────────────────────────────────────────────────────────────┐
│                    TrackingService.ts                                │
│  _handleMessage(message)                                             │
│    ↓                                                                 │
│  Parse JSON message                                                  │
│    ↓                                                                 │
│  _handleTrackingUpdate(data)                                         │
│    ↓                                                                 │
│  _broadcastEvent('event::tracking_update', {...})                   │
└────────────────────┬─────────────────────────────────────────────────┘
                     │
                     │ Event broadcast (Pub/Sub)
                     ↓
        ┌────────────┴────────────┐
        │                         │
        ↓                         ↓
┌──────────────────────┐  ┌──────────────────────────────┐
│ NavigationController │  │    TrackingPanel             │
│                      │  │                              │
│ _handleTrackingUpdate│  │ Subscription callback        │
│ (event)              │  │ (event)                      │
│    ↓                 │  │    ↓                         │
│ Transform coords     │  │ Update React state           │
│    ↓                 │  │    ↓                         │
│ Update viewport      │  │ Re-render UI                 │
│    ↓                 │  │                              │
│ Render (20Hz)        │  │ Display data                 │
└──────────────────────┘  └──────────────────────────────┘
```

---

## 📊 Subscription Pattern (Observer Pattern)

```
TrackingService (Publisher)
    │
    ├─► Subscriber 1: NavigationController
    │   └─► Listens for: 'event::tracking_update'
    │       └─► Action: Update viewport camera
    │
    ├─► Subscriber 2: TrackingPanel
    │   └─► Listens for: 'event::tracking_update'
    │       └─► Action: Update UI display
    │
    └─► Subscriber 3: TrackingPanel
        └─► Listens for: 'event::connection_status'
            └─► Action: Update connection status UI

When TrackingService receives WebSocket message:
1. Parse message
2. Broadcast 'event::tracking_update' with data
3. ALL subscribers receive the event simultaneously
4. Each subscriber processes independently
```

---

## 🎯 Key Design Patterns

### 1. **Pub/Sub Pattern** (TrackingService)
- TrackingService publishes events
- Multiple components can subscribe
- Loose coupling between components

### 2. **Command Pattern** (Commands → NavigationController)
- UI triggers commands
- Commands execute operations
- Allows undo/redo (future)

### 3. **Service Locator Pattern** (ServicesManager)
- Central registry of services
- Components access services via manager
- Dependency injection

### 4. **Strategy Pattern** (NavigationController → Modes)
- Different navigation modes (future)
- Each mode implements same interface
- Mode switching at runtime

---

## 🔄 Complete Lifecycle

```
┌───────────────────────────────────────────────────────────────────┐
│ 1. INITIALIZATION                                                 │
├───────────────────────────────────────────────────────────────────┤
│ • TrackingService registered with ServicesManager                 │
│ • TrackingPanel mounted (subscribes to TrackingService)          │
│ • NavigationController NOT created yet                            │
└───────────────────────────────────────────────────────────────────┘
                              ↓
┌───────────────────────────────────────────────────────────────────┐
│ 2. USER STARTS NAVIGATION                                         │
├───────────────────────────────────────────────────────────────────┤
│ • User clicks "Start Navigation" in TrackingPanel                 │
│ • TrackingPanel calls: commandsManager.runCommand('startNavigation')│
│ • Command creates NavigationController instance                   │
│ • NavigationController.startNavigation() called                   │
│ • NavigationController subscribes to TrackingService              │
│ • NavigationController calls: trackingService.connect()           │
│ • TrackingService establishes WebSocket connection                │
└───────────────────────────────────────────────────────────────────┘
                              ↓
┌───────────────────────────────────────────────────────────────────┐
│ 3. DATA STREAMING (100Hz)                                         │
├───────────────────────────────────────────────────────────────────┤
│ • Backend sends tracking data via WebSocket                       │
│ • TrackingService receives message                                │
│ • TrackingService parses and broadcasts 'event::tracking_update'  │
│ • NavigationController receives event → updates viewport (20Hz)   │
│ • TrackingPanel receives event → updates UI display (100Hz)       │
└───────────────────────────────────────────────────────────────────┘
                              ↓
┌───────────────────────────────────────────────────────────────────┐
│ 4. USER STOPS NAVIGATION                                          │
├───────────────────────────────────────────────────────────────────┤
│ • User clicks "Stop Navigation" in TrackingPanel                  │
│ • TrackingPanel calls: commandsManager.runCommand('stopNavigation')│
│ • NavigationController.stopNavigation() called                     │
│ • NavigationController unsubscribes from TrackingService          │
│ • NavigationController calls: trackingService.disconnect()        │
│ • TrackingService closes WebSocket                                │
│ • NavigationController instance remains (can be reused)           │
└───────────────────────────────────────────────────────────────────┘
```

---

## 📝 Key Method Calls Summary

### TrackingPanel → NavigationController
```
TrackingPanel
  └─► commandsManager.runCommand('startNavigation')
        └─► NavigationController.startNavigation()
```

### NavigationController → TrackingService
```
NavigationController
  └─► trackingService.subscribe('event::tracking_update', callback)
  └─► trackingService.connect()
```

### TrackingService → Subscribers
```
TrackingService
  └─► _broadcastEvent('event::tracking_update', data)
        ├─► NavigationController._handleTrackingUpdate(data)
        └─► TrackingPanel subscription callback
```

### NavigationController → Viewports
```
NavigationController
  └─► viewport.setCamera({...})
  └─► viewport.render()
```

---

## ✅ Summary

**TrackingService.ts:**
- 🔌 Manages WebSocket connection
- 📡 Receives raw tracking data (100Hz)
- 📢 Broadcasts events to subscribers
- ❌ Does NOT process or transform data
- ❌ Does NOT update UI or viewports

**NavigationController.ts:**
- 👂 Listens to TrackingService events
- 🔄 Transforms coordinates (register → DICOM)
- 🎥 Updates viewport cameras
- 🎨 Renders viewports (throttled to 20Hz)
- ❌ Does NOT manage WebSocket
- ❌ Does NOT display UI

**TrackingPanel.tsx:**
- 🖼️ Displays tracking status and data
- 🎮 Provides user controls (buttons)
- 👂 Listens to TrackingService for display updates
- 📞 Calls commands to control navigation
- ❌ Does NOT directly manipulate viewports
- ❌ Does NOT manage WebSocket

**Separation of Concerns:**
- ✅ Each component has a single responsibility
- ✅ Components communicate via events (loose coupling)
- ✅ Easy to test independently
- ✅ Easy to add new subscribers
