# Phase 1: Navigation Mode Architecture (Inheritance-Based Design)

## 🎯 Architecture Decision: Inheritance Pattern

**Better Design**: Use inheritance where:
- `NavigationController` = **Base class** (manages mode switching and common logic)
- `CameraFollowingMode` = **Child class** (implements camera follow behavior)
- `InstrumentProjectionMode` = **Child class** (implements projection behavior)

This follows **SOLID principles**:
- ✅ **Single Responsibility**: Each mode class has one responsibility
- ✅ **Open/Closed**: Add new modes by extending base class
- ✅ **Dependency Inversion**: Controller depends on abstractions

---

## 📦 Class Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│              NavigationController (Base Class)               │
├─────────────────────────────────────────────────────────────┤
│ Responsibilities:                                            │
│  - Mode selection and switching                              │
│  - Common state management                                   │
│  - Tracking data reception and routing                       │
│  - Coordinate transformation                                 │
│  - Event handling                                            │
│                                                              │
│ Abstract Methods:                                            │
│  - handleTrackingUpdate()                                    │
│  - onModeEnter()                                             │
│  - onModeExit()                                              │
│  - cleanup()                                                 │
└─────────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
          ↓                               ↓
┌─────────────────────────┐  ┌──────────────────────────────┐
│ CameraFollowingMode     │  │ InstrumentProjectionMode     │
│ (Concrete Implementation)│  │ (Concrete Implementation)    │
├─────────────────────────┤  ├──────────────────────────────┤
│ - Update viewport camera│  │ - Project tool to viewport   │
│ - Transform orientation │  │ - Render overlay graphics    │
│ - Handle MPR rotation   │  │ - Calculate intersections    │
│                         │  │ - Update SVG overlay         │
└─────────────────────────┘  └──────────────────────────────┘
```

---

## 🏗️ Implementation Structure

### 1. Base Class: NavigationController (Abstract)

```typescript
// File: extensions/lifesync/src/utils/navigationController.ts

import { vec3 } from 'gl-matrix';
import { Types as cs3DTypes, getRenderingEngine } from '@cornerstonejs/core';
import CoordinateTransformer from './CoordinateTransformer';

/**
 * Base class for navigation modes
 * Abstract class that defines common interface and shared functionality
 */
abstract class NavigationMode {
  protected servicesManager: any;
  protected coordinateTransformer: CoordinateTransformer;
  protected updateCount: number = 0;

  constructor(servicesManager: any, coordinateTransformer: CoordinateTransformer) {
    this.servicesManager = servicesManager;
    this.coordinateTransformer = coordinateTransformer;
  }

  /**
   * Handle tracking update - MUST be implemented by child classes
   */
  abstract handleTrackingUpdate(
    position: number[],
    orientation: number[],
    matrix: number[]
  ): void;

  /**
   * Called when mode is activated
   */
  abstract onModeEnter(): void;

  /**
   * Called when mode is deactivated
   */
  abstract onModeExit(): void;

  /**
   * Cleanup resources
   */
  abstract cleanup(): void;

  /**
   * Get mode name for identification
   */
  abstract getModeName(): string;

  /**
   * Helper: Transform coordinates from register to DICOM
   */
  protected transformCoordinates(registerPosition: number[]): number[] {
    return this.coordinateTransformer.hasTransform()
      ? this.coordinateTransformer.registerToDICOM(registerPosition)
      : registerPosition;
  }

  /**
   * Helper: Get rendering engine
   */
  protected getRenderingEngine() {
    return getRenderingEngine('OHIFCornerstoneRenderingEngine');
  }

  /**
   * Helper: Get all viewports
   */
  protected getViewports() {
    const renderingEngine = this.getRenderingEngine();
    return renderingEngine ? renderingEngine.getViewports() : [];
  }
}

/**
 * Navigation Controller - Base class managing mode switching
 */
class NavigationController {
  private servicesManager: any;
  private trackingSubscription: any = null;
  private isNavigating: boolean = false;
  private updateCount: number = 0;
  private lastUpdateTime: number = 0;
  private lastRenderTime: number = 0;
  private targetFPS: number = 20;
  private minFrameTime: number = 1000 / this.targetFPS;
  private coordinateTransformer: CoordinateTransformer;

  // Mode management
  private currentMode: NavigationMode | null = null;
  private modeInstances: Map<string, NavigationMode> = new Map();
  private modeChangeListeners: Set<ModeChangeListener> = new Set();

  // Navigation mode type
  type NavigationModeName = 'camera-follow' | 'instrument-projection';
  type ModeChangeListener = (mode: NavigationModeName, previousMode: NavigationModeName | null) => void;

  constructor(servicesManager: any) {
    this.servicesManager = servicesManager;
    this.coordinateTransformer = new CoordinateTransformer();

    // Initialize mode instances
    this._initializeModes();

    // Set default mode
    const savedMode = localStorage.getItem('lifesync_navigation_mode') as NavigationModeName;
    const defaultMode: NavigationModeName = savedMode || 'camera-follow';
    this.setNavigationMode(defaultMode, true); // Silent init

    console.log('🧭 NavigationController initialized', {
      targetFPS: this.targetFPS,
      defaultMode: defaultMode
    });
  }

  /**
   * Initialize all navigation mode instances
   */
  private _initializeModes(): void {
    // Create mode instances
    this.modeInstances.set('camera-follow', new CameraFollowingMode(
      this.servicesManager,
      this.coordinateTransformer
    ));

    this.modeInstances.set('instrument-projection', new InstrumentProjectionMode(
      this.servicesManager,
      this.coordinateTransformer
    ));
  }

  /**
   * Get current navigation mode name
   */
  public getNavigationMode(): NavigationModeName | null {
    if (!this.currentMode) return null;

    for (const [name, mode] of this.modeInstances.entries()) {
      if (mode === this.currentMode) {
        return name as NavigationModeName;
      }
    }
    return null;
  }

  /**
   * Set navigation mode
   */
  public setNavigationMode(
    modeName: NavigationModeName,
    silent: boolean = false
  ): void {
    const previousModeName = this.getNavigationMode();

    if (modeName === previousModeName) {
      return; // No change
    }

    // Get mode instance
    const modeInstance = this.modeInstances.get(modeName);
    if (!modeInstance) {
      console.error(`❌ Navigation mode not found: ${modeName}`);
      return;
    }

    // Exit previous mode
    if (this.currentMode) {
      this.currentMode.onModeExit();
      this.currentMode.cleanup();
    }

    // Enter new mode
    this.currentMode = modeInstance;
    this.currentMode.onModeEnter();

    // Save preference
    localStorage.setItem('lifesync_navigation_mode', modeName);

    // Notify listeners
    if (!silent) {
      this._notifyModeChange(modeName, previousModeName);
    }

    console.log(`🔄 Navigation mode changed: ${previousModeName || 'none'} → ${modeName}`);
  }

  /**
   * Subscribe to mode changes
   */
  public onModeChange(listener: ModeChangeListener): () => void {
    this.modeChangeListeners.add(listener);
    return () => {
      this.modeChangeListeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of mode change
   */
  private _notifyModeChange(
    mode: NavigationModeName,
    previousMode: NavigationModeName | null
  ): void {
    this.modeChangeListeners.forEach(listener => {
      try {
        listener(mode, previousMode);
      } catch (error) {
        console.error('Error in mode change listener:', error);
      }
    });
  }

  /**
   * Start navigation - delegates to current mode
   */
  public startNavigation(mode: string = 'circular'): void {
    const { trackingService, cornerstoneViewportService } = this.servicesManager.services;

    if (!trackingService) {
      console.error('❌ TrackingService not available');
      return;
    }

    if (this.isNavigating) {
      console.warn('⚠️ Navigation already active');
      return;
    }

    console.log(`▶️ Starting navigation (mode: ${mode})`);
    console.log(`   Active navigation mode: ${this.getNavigationMode()}`);

    // Auto-detect volume center
    const volumeCenter = this._autoDetectVolumeCenter();
    if (volumeCenter) {
      console.log(`📍 Auto-detected volume center: [${volumeCenter.map(v => v.toFixed(1)).join(', ')}]`);
    }

    // Subscribe to tracking updates
    const TRACKING_EVENTS = {
      TRACKING_UPDATE: 'event::tracking_update',
      CONNECTION_STATUS: 'event::connection_status',
    };

    this.trackingSubscription = trackingService.subscribe(
      TRACKING_EVENTS.TRACKING_UPDATE,
      this._handleTrackingUpdate.bind(this)
    );

    this.isNavigating = true;
    this.updateCount = 0;
    this.lastUpdateTime = performance.now();
    this.lastRenderTime = performance.now();

    // Connect to tracking server
    console.log('🔗 Connecting to SyncForge tracking API...');

    const connectionSubscription = trackingService.subscribe(
      TRACKING_EVENTS.CONNECTION_STATUS,
      (status: any) => {
        if (status.connected) {
          console.log('✅ Connected! Tracking data streaming at 100Hz...');
          connectionSubscription.unsubscribe();
        } else if (status.error) {
          console.error('❌ Connection failed:', status.error);
          this.stopNavigation();
        }
      }
    );

    trackingService.connect().catch(error => {
      console.error('❌ Failed to connect to tracking API:', error);
      this.stopNavigation();
    });

    console.log('✅ Navigation initialized, connecting to API...');
  }

  /**
   * Stop navigation
   */
  public stopNavigation(): void {
    if (!this.isNavigating) {
      return;
    }

    console.log('⏸️ Stopping navigation');

    this.isNavigating = false;

    const { trackingService } = this.servicesManager.services;

    if (this.trackingSubscription) {
      try {
        this.trackingSubscription.unsubscribe();
      } catch (error) {
        console.warn('⚠️ Error unsubscribing from tracking:', error);
      }
      this.trackingSubscription = null;
    }

    if (trackingService) {
      try {
        trackingService.disconnect();
      } catch (error) {
        console.warn('⚠️ Error disconnecting from tracking service:', error);
      }
    }

    // Cleanup current mode
    if (this.currentMode) {
      this.currentMode.cleanup();
    }

    console.log('✅ Navigation stopped successfully');
  }

  /**
   * Handle tracking update - routes to current mode
   */
  private _handleTrackingUpdate(event: any): void {
    const { position, orientation, matrix, timestamp, frame_id } = event;

    this.updateCount++;

    // Throttle UI updates
    const now = performance.now();
    const timeSinceLastRender = now - this.lastRenderTime;

    if (timeSinceLastRender < this.minFrameTime) {
      return; // Skip this frame
    }

    // Transform coordinates
    const registerPosition = position;
    const dicomPosition = this.coordinateTransformer.hasTransform()
      ? this.coordinateTransformer.registerToDICOM(registerPosition)
      : registerPosition;

    // Delegate to current mode
    if (this.currentMode) {
      try {
        this.currentMode.handleTrackingUpdate(dicomPosition, orientation, matrix);
        this.lastRenderTime = now;
      } catch (error) {
        console.error('❌ Error in navigation mode handler:', error);
      }
    } else {
      console.warn('⚠️ No navigation mode active');
    }
  }

  // ... existing helper methods (_autoDetectVolumeCenter, etc.) ...

  /**
   * Enable/disable orientation tracking (legacy method for CameraFollow mode)
   */
  public enableOrientationTracking(enable: boolean): void {
    const cameraFollowMode = this.modeInstances.get('camera-follow') as CameraFollowingMode;
    if (cameraFollowMode) {
      cameraFollowMode.enableOrientationTracking(enable);
    }
  }

  /**
   * Get orientation tracking status (legacy method)
   */
  public isOrientationTrackingEnabled(): boolean {
    const cameraFollowMode = this.modeInstances.get('camera-follow') as CameraFollowingMode;
    return cameraFollowMode ? cameraFollowMode.isOrientationTrackingEnabled() : false;
  }

  // ... other public methods (loadTransformation, etc.) ...
}
```

---

### 2. Child Class: CameraFollowingMode

```typescript
// File: extensions/lifesync/src/utils/navigationModes/CameraFollowingMode.ts

import { vec3 } from 'gl-matrix';
import { Types as cs3DTypes, getRenderingEngine } from '@cornerstonejs/core';
import NavigationMode from './NavigationMode';

/**
 * Camera Following Mode
 * Viewport camera follows tool movement and rotation
 */
export class CameraFollowingMode extends NavigationMode {
  private useOrientationTracking: boolean = true;
  private lastPosition: number[] | null = null;

  constructor(servicesManager: any, coordinateTransformer: any) {
    super(servicesManager, coordinateTransformer);
  }

  getModeName(): string {
    return 'camera-follow';
  }

  onModeEnter(): void {
    console.log('📹 Camera Follow mode activated');
  }

  onModeExit(): void {
    console.log('📹 Camera Follow mode deactivated');
    this.lastPosition = null;
  }

  cleanup(): void {
    // No special cleanup needed
  }

  /**
   * Handle tracking update - update camera position/orientation
   */
  handleTrackingUpdate(
    position: number[],
    orientation: number[],
    matrix: number[]
  ): void {
    const viewports = this.getViewports();

    viewports.forEach(vp => {
      if (vp.type === 'stack') return;

      const camera = vp.getCamera();

      if (this.useOrientationTracking && matrix) {
        this._updateCameraWithOrientation(vp, position, matrix);
      } else {
        this._updateCameraPositionOnly(vp, position, camera);
      }

      vp.render();
    });

    this.lastPosition = position;
  }

  /**
   * Enable/disable orientation tracking
   */
  public enableOrientationTracking(enable: boolean): void {
    this.useOrientationTracking = enable;
  }

  /**
   * Get orientation tracking status
   */
  public isOrientationTrackingEnabled(): boolean {
    return this.useOrientationTracking;
  }

  /**
   * Update camera with orientation (6-DOF mode)
   */
  private _updateCameraWithOrientation(
    vp: any,
    position: number[],
    matrix: number[] | number[][]
  ): void {
    // ... existing implementation ...
  }

  /**
   * Update camera position only (3-DOF mode)
   */
  private _updateCameraPositionOnly(
    vp: any,
    position: number[],
    camera: any
  ): void {
    // ... existing implementation ...
  }

  /**
   * Extract rotation matrix from transformation matrix
   */
  private _extractRotationMatrix(matrix: number[] | number[][]): number[][] {
    // ... existing implementation ...
  }
}
```

---

### 3. Child Class: InstrumentProjectionMode (Placeholder)

```typescript
// File: extensions/lifesync/src/utils/navigationModes/InstrumentProjectionMode.ts

import NavigationMode from './NavigationMode';

/**
 * Instrument Projection Mode
 * Tool is projected on fixed viewport with axis and extension line
 *
 * Phase 2: Full implementation with projection rendering
 */
export class InstrumentProjectionMode extends NavigationMode {
  private toolProjectionRenderer: any = null; // Phase 2: ToolProjectionRenderer

  constructor(servicesManager: any, coordinateTransformer: any) {
    super(servicesManager, coordinateTransformer);
  }

  getModeName(): string {
    return 'instrument-projection';
  }

  onModeEnter(): void {
    console.log('🎯 Instrument Projection mode activated');
    console.log('   Note: Full rendering implementation coming in Phase 2');

    // Phase 2: Initialize projection renderer
    // this.toolProjectionRenderer = new ToolProjectionRenderer(this.servicesManager);
  }

  onModeExit(): void {
    console.log('🎯 Instrument Projection mode deactivated');

    // Phase 2: Cleanup projection renderer
    // if (this.toolProjectionRenderer) {
    //   this.toolProjectionRenderer.cleanup();
    // }
  }

  cleanup(): void {
    // Phase 2: Full cleanup
    if (this.toolProjectionRenderer) {
      this.toolProjectionRenderer.cleanup();
      this.toolProjectionRenderer = null;
    }
  }

  /**
   * Handle tracking update - project tool on viewport
   */
  handleTrackingUpdate(
    position: number[],
    orientation: number[],
    matrix: number[]
  ): void {
    // Phase 2: Implement projection rendering
    if (this.updateCount % 100 === 0) {
      console.log('🎯 [Instrument Projection] Mode active');
      console.log(`   Tool position: [${position.map(v => v.toFixed(1)).join(', ')}]`);
      console.log('   Phase 2: Projection rendering will be implemented here');
    }

    // Phase 2: Update projection overlay
    // if (this.toolProjectionRenderer) {
    //   const toolRepresentation = this._extractToolRepresentation(position, matrix);
    //   this.toolProjectionRenderer.updateProjection(toolRepresentation);
    // }
  }

  /**
   * Extract tool representation from matrix (Phase 2)
   */
  private _extractToolRepresentation(
    position: number[],
    matrix: number[]
  ): any {
    // Phase 2: Extract origin, z-axis, extension length
    return {
      origin: position,
      zAxis: [0, 0, 1], // Placeholder
      extensionLength: 100,
      tipPoint: position
    };
  }
}
```

---

## ✅ Benefits of Inheritance Design

### 1. **Separation of Concerns**
- Each mode class handles only its own logic
- Base class handles common functionality
- Clear responsibility boundaries

### 2. **Extensibility**
- Add new modes by creating new child class
- No need to modify existing code (Open/Closed Principle)
- Easy to test each mode independently

### 3. **Code Organization**
```
utils/
├── navigationController.ts        (Base class)
└── navigationModes/
    ├── NavigationMode.ts          (Abstract base)
    ├── CameraFollowingMode.ts     (Existing logic moved here)
    └── InstrumentProjectionMode.ts (New mode)
```

### 4. **Testability**
- Test each mode class independently
- Mock base class for unit tests
- Clear interfaces for testing

---

## 🔄 Migration Plan

### Step 1: Create Base Classes
- Create `NavigationMode` abstract class
- Move common logic to `NavigationController` base class

### Step 2: Extract Camera Following
- Move existing camera follow logic to `CameraFollowingMode` class
- Ensure backward compatibility

### Step 3: Create Instrument Projection Placeholder
- Create `InstrumentProjectionMode` class with placeholder implementation

### Step 4: Update NavigationController
- Refactor to use mode instances
- Update routing logic

### Step 5: Test & Verify
- Ensure existing functionality works
- Test mode switching
- Verify no regressions

---

## 📝 Implementation Checklist

- [ ] Create `NavigationMode` abstract base class
- [ ] Refactor `NavigationController` as base class
- [ ] Extract camera follow logic to `CameraFollowingMode`
- [ ] Create `InstrumentProjectionMode` placeholder
- [ ] Update mode switching logic
- [ ] Update UI integration
- [ ] Test backward compatibility
- [ ] Update documentation

---

**This inheritance-based design is much cleaner and follows OOP best practices!** ✅
