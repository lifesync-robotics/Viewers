# Phase 2: Update Existing Tracking Code for Integrated API

## 🎯 Overview

Good news! The tracking infrastructure already exists in OHIF:
- ✅ `TrackingService` - WebSocket client for tracking data
- ✅ `NavigationController` - Updates crosshair from tracking
- ✅ Commands - `startNavigation`, `stopNavigation`, `toggleNavigation`
- ✅ UI Integration - Already working

**What we need to do:** Update these to work with the new **SyncForge integrated API** (Phase 1).

---

## 📋 Current vs New Architecture

### **Current (Old Python Server)**
```
OHIF → ws://localhost:8765 (Direct Python WebSocket)
```

### **New (Integrated SyncForge API)**
```
OHIF → REST POST /api/tracking/connect → Get WS URL
     → ws://localhost:3001/ws/tracking → Tracking data
```

---

## 🔧 Changes Required

### 1. **TrackingService.ts** - Update Connection Flow

**File:** `extensions/default/src/services/TrackingService.ts`

**Current Code (Line 47):**
```typescript
public connect(url: string = 'ws://localhost:8765'): void {
  if (this.ws) {
    console.warn('⚠️ Already connected to tracking server');
    return;
  }

  console.log(`🔗 Connecting to tracking server: ${url}`);

  this.ws = new WebSocket(url);
  // ...
}
```

**New Code:**
```typescript
public async connect(apiUrl: string = 'http://localhost:3001'): Promise<void> {
  if (this.ws) {
    console.warn('⚠️ Already connected to tracking server');
    return;
  }

  console.log(`🔗 Requesting WebSocket URL from API: ${apiUrl}`);

  try {
    // Step 1: Call REST API to get WebSocket URL
    const response = await fetch(`${apiUrl}/api/tracking/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        case_id: this.caseId || 'OHIF_SESSION',
        tools: ['pr', 'EE', 'pointer', 'crosshair'],
        frequency_hz: 100
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success || !data.websocket_url) {
      throw new Error('API did not return WebSocket URL');
    }

    console.log(`✅ Got WebSocket URL: ${data.websocket_url}`);
    this.connectionId = data.connection_id;

    // Step 2: Connect to WebSocket
    this._connectWebSocket(data.websocket_url);

  } catch (error) {
    console.error('❌ Failed to connect to tracking API:', error);
    this._broadcastEvent(EVENTS.CONNECTION_STATUS, {
      connected: false,
      error: error.message,
    });
    throw error;
  }
}

private _connectWebSocket(wsUrl: string): void {
  console.log(`🔗 Connecting to WebSocket: ${wsUrl}`);

  this.ws = new WebSocket(wsUrl);

  this.ws.onopen = () => {
    console.log('✅ WebSocket connected');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this._broadcastEvent(EVENTS.CONNECTION_STATUS, {
      connected: true,
      message: 'Connected to tracking server',
    });
  };

  this.ws.onmessage = event => {
    try {
      const message = JSON.parse(event.data);
      this._handleMessage(message);
    } catch (error) {
      console.error('❌ Error parsing tracking message:', error);
    }
  };

  this.ws.onerror = error => {
    console.error('❌ WebSocket error:', error);
    this._broadcastEvent(EVENTS.CONNECTION_STATUS, {
      connected: false,
      error: 'Connection error',
    });
  };

  this.ws.onclose = () => {
    console.log('🔌 Disconnected from tracking server');
    this.isConnected = false;
    this.ws = null;

    this._broadcastEvent(EVENTS.CONNECTION_STATUS, {
      connected: false,
      message: 'Disconnected from tracking server',
    });

    // Attempt to reconnect
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(
        `🔄 Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
      );
      setTimeout(() => this.connect(this.apiUrl), this.reconnectDelay);
    }
  };
}
```

### 2. **Update Message Format Handler**

**Current Code (Line 208-231):**
```typescript
private _handleMessage(message: any): void {
  const { type, data } = message;

  switch (type) {
    case 'connection':
      console.log('✅ Server connection confirmed:', message.server);
      break;

    case 'tracking_update':
      this._handleTrackingUpdate(data);
      break;

    case 'response':
      console.log(`📨 Server response:`, message);
      break;

    case 'pong':
      // Handle ping response
      break;

    default:
      console.log('📨 Unknown message type:', type);
  }
}
```

**New Code:**
```typescript
private _handleMessage(message: any): void {
  const { type } = message;

  switch (type) {
    case 'connection':
      console.log('✅ Server connection confirmed');
      break;

    case 'tracking_update':
      // NEW FORMAT: Extract crosshair data from tools object
      if (message.tools && message.tools.crosshair) {
        const crosshair = message.tools.crosshair;
        const position = crosshair.coordinates.register.position_mm;
        const rotation = crosshair.coordinates.register.rotation_deg || [0, 0, 0];

        this._handleTrackingUpdate({
          position: position,
          orientation: rotation,
          timestamp: message.timestamp,
          frame_id: message.frame_number,
        });
      }
      break;

    case 'configuration':
    case 'subscription':
    case 'frequency':
      console.log(`📨 Server response:`, message);
      break;

    default:
      console.log('📨 Unknown message type:', type, message);
  }
}
```

### 3. **Remove Old Server Commands**

The new API doesn't need these Python-specific commands:

**Remove or Comment Out:**
```typescript
// OLD - Not needed with new API
public startTracking(mode: string = 'circular'): void { ... }
public stopTracking(): void { ... }
public setMode(mode: string): void { ... }
public setCenter(position: number[]): void { ... }
```

**Why?** The simulator runs independently, we just connect/disconnect WebSocket.

### 4. **Add New Instance Variables**

**Add to class (after line 36):**
```typescript
private apiUrl: string = 'http://localhost:3001';
private caseId: string | null = null;
private connectionId: string | null = null;
```

### 5. **Update Constructor**

**Current (line 38-42):**
```typescript
constructor(servicesManager) {
  super(EVENTS);
  this.servicesManager = servicesManager;
  console.log('🎯 TrackingService initialized');
}
```

**New:**
```typescript
constructor(servicesManager, config = {}) {
  super(EVENTS);
  this.servicesManager = servicesManager;
  this.apiUrl = config.apiUrl || 'http://localhost:3001';
  this.caseId = config.caseId || null;
  console.log('🎯 TrackingService initialized', { apiUrl: this.apiUrl });
}
```

### 6. **Add Setter for Case ID**

**Add new method:**
```typescript
/**
 * Set the case ID for tracking session
 */
public setCaseId(caseId: string): void {
  this.caseId = caseId;
  console.log(`📋 Case ID set: ${caseId}`);
}
```

---

## 🔧 NavigationController Changes

**File:** `extensions/cornerstone/src/utils/navigationController.ts`

### Minor Updates Needed:

1. **Remove `setCenter` call (line 74)** - Not needed anymore
2. **Remove `startTracking` call (line 79)** - Not needed anymore
3. **Update connection flow**

**Current Code (lines 62-89):**
```typescript
// Connect to tracking server and wait for connection
console.log('🔗 Connecting to tracking server...');

// Subscribe to connection status to know when we're connected
const connectionSubscription = trackingService.subscribe(
  TRACKING_EVENTS.CONNECTION_STATUS,
  (status: any) => {
    if (status.connected) {
      console.log('✅ Connected! Starting tracking...');

      // Send volume center to server if detected
      if (volumeCenter) {
        trackingService.setCenter(volumeCenter);
        console.log('📤 Sent volume center to tracking server');
      }

      // Start tracking with specified mode
      trackingService.startTracking(mode);
      connectionSubscription.unsubscribe(); // Clean up this subscription
    } else if (status.error) {
      console.error('❌ Connection failed:', status.error);
      this.stopNavigation();
    }
  }
);

// Initiate connection
trackingService.connect();
```

**New Code:**
```typescript
// Connect to tracking server
console.log('🔗 Connecting to tracking API...');

// Subscribe to connection status
const connectionSubscription = trackingService.subscribe(
  TRACKING_EVENTS.CONNECTION_STATUS,
  (status: any) => {
    if (status.connected) {
      console.log('✅ Connected! Tracking data streaming...');
      connectionSubscription.unsubscribe(); // Clean up this subscription
    } else if (status.error) {
      console.error('❌ Connection failed:', status.error);
      this.stopNavigation();
    }
  }
);

// Initiate connection (async)
trackingService.connect().catch(error => {
  console.error('❌ Failed to connect:', error);
  this.stopNavigation();
});
```

**Remove stopTracking call (line 122):**
```typescript
// OLD
if (trackingService) {
  try {
    trackingService.stopTracking(); // REMOVE THIS
    trackingService.disconnect();
  } catch (error) {
    console.warn('⚠️ Error disconnecting from tracking service:', error);
  }
}

// NEW
if (trackingService) {
  try {
    trackingService.disconnect(); // Just disconnect WebSocket
  } catch (error) {
    console.warn('⚠️ Error disconnecting from tracking service:', error);
  }
}
```

---

## 📝 Summary of Changes

### TrackingService.ts
1. ✅ Change `connect()` to async and call REST API first
2. ✅ Extract WebSocket URL from API response
3. ✅ Update message format handler for new Protocol Buffer format
4. ✅ Add `apiUrl`, `caseId`, `connectionId` instance variables
5. ✅ Add `setCaseId()` method
6. ✅ Remove old Python-specific commands

### NavigationController.ts
1. ✅ Remove `setCenter()` call
2. ✅ Remove `startTracking()` call
3. ✅ Update connection flow to handle async
4. ✅ Remove `stopTracking()` call

### CommandsModule.ts
1. ✅ No changes needed! Commands already work correctly

---

## 🧪 Testing

After updates, test with:

```bash
# Terminal 1: Start SyncForge API
cd ModularPlatformPrototype/00_SyncForgeAPI
npm start

# Terminal 2: Start Python simulator
cd ModularPlatformPrototype/04_Tracking
conda run -n asclepius python3 tracking_simulator.py

# Terminal 3: Start OHIF
cd Viewers
yarn run dev

# In OHIF: Click navigation button or run command
```

---

## 🎯 Benefits of These Changes

1. **Unified API** - Single port (3001) for all services
2. **Proper REST Flow** - Authenticate before WebSocket
3. **100Hz Updates** - Faster than old 20Hz
4. **Better Format** - Structured data from Protocol Buffers
5. **Multiple Tools** - Not just crosshair, but EE, pointer, pr
6. **Scalable** - Ready for real hardware integration

---

## ⚡ Quick Implementation

Want me to implement these changes now? I can:
1. Update `TrackingService.ts`
2. Update `NavigationController.ts`
3. Test with existing OHIF setup
4. Document the integration

---

**Status:** Ready to implement
**Estimated Time:** 30 minutes
**Risk:** Low (minimal changes to existing working code)
