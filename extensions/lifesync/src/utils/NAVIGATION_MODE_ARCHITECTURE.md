# Phase 1: Navigation Mode Selection & Switching Architecture

## 📋 Overview

This document details the architecture for implementing a dual-mode navigation system in the surgical navigation viewer:
- **Mode 1: Camera Following** (already implemented)
- **Mode 2: Instrument Projection** (to be implemented)

Phase 1 focuses on the **mode selection and switching infrastructure** without implementing Mode 2 rendering yet.

---

## 🎯 Phase 1 Goals

1. ✅ Create mode selection infrastructure
2. ✅ Implement mode switching logic
3. ✅ Add UI controls for mode selection
4. ✅ Ensure clean state transitions
5. ✅ Maintain backward compatibility with existing Camera Follow mode

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Data Flow                                 │
└─────────────────────────────────────────────────────────────┘

Tracking Server (100Hz)
    ↓ (WebSocket)
TrackingService.ts
    ↓ (TRACKING_UPDATE event)
NavigationController._handleTrackingUpdate()
    ↓
┌─────────────────────────────────────────────────────────────┐
│         Mode Selection Router (NEW)                          │
├─────────────────────────────────────────────────────────────┤
│  if (mode === 'camera-follow')                              │
│    → _updateCameraFollowMode()     ✅ Existing              │
│  else if (mode === 'instrument-projection')                 │
│    → _updateInstrumentProjectionMode()  ⏳ Placeholder      │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│         Viewport Updates                                     │
│  - Camera Follow: Update viewport camera                    │
│  - Projection: Update overlay (Phase 2)                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Component Structure

### 1. NavigationController (Enhanced)

```typescript
// File: extensions/lifesync/src/utils/navigationController.ts

class NavigationController {
  // ============================================================
  // NEW: Mode Management
  // ============================================================

  private navigationMode: NavigationMode = 'camera-follow';
  private modeChangeListeners: Set<ModeChangeListener> = new Set();

  /**
   * Navigation mode types
   */
  type NavigationMode = 'camera-follow' | 'instrument-projection';

  /**
   * Mode change listener callback
   */
  type ModeChangeListener = (mode: NavigationMode, previousMode: NavigationMode) => void;

  /**
   * Get current navigation mode
   */
  public getNavigationMode(): NavigationMode {
    return this.navigationMode;
  }

  /**
   * Set navigation mode
   * @param mode - Target navigation mode
   * @param silent - If true, don't trigger listeners (internal use)
   */
  public setNavigationMode(mode: NavigationMode, silent: boolean = false): void {
    const previousMode = this.navigationMode;

    if (mode === previousMode) {
      return; // No change needed
    }

    // Validate mode
    if (!this._isValidMode(mode)) {
      console.error(`❌ Invalid navigation mode: ${mode}`);
      return;
    }

    // Exit previous mode
    this._exitMode(previousMode);

    // Update mode
    this.navigationMode = mode;

    // Enter new mode
    this._enterMode(mode);

    // Notify listeners
    if (!silent) {
      this._notifyModeChange(mode, previousMode);
    }

    console.log(`🔄 Navigation mode changed: ${previousMode} → ${mode}`);
  }

  /**
   * Subscribe to mode changes
   */
  public onModeChange(listener: ModeChangeListener): () => void {
    this.modeChangeListeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.modeChangeListeners.delete(listener);
    };
  }

  /**
   * Validate navigation mode
   */
  private _isValidMode(mode: string): mode is NavigationMode {
    return mode === 'camera-follow' || mode === 'instrument-projection';
  }

  /**
   * Exit previous mode - cleanup
   */
  private _exitMode(mode: NavigationMode): void {
    switch (mode) {
      case 'camera-follow':
        // No cleanup needed - camera updates are stateless
        break;

      case 'instrument-projection':
        // Cleanup overlay renderer (Phase 2)
        // this.toolProjectionRenderer?.cleanup();
        break;
    }
  }

  /**
   * Enter new mode - initialization
   */
  private _enterMode(mode: NavigationMode): void {
    switch (mode) {
      case 'camera-follow':
        // No initialization needed
        console.log('📹 Camera Follow mode active');
        break;

      case 'instrument-projection':
        // Initialize overlay renderer (Phase 2)
        // this.toolProjectionRenderer = new ToolProjectionRenderer(...);
        console.log('🎯 Instrument Projection mode active (placeholder)');
        break;
    }
  }

  /**
   * Notify all listeners of mode change
   */
  private _notifyModeChange(mode: NavigationMode, previousMode: NavigationMode): void {
    this.modeChangeListeners.forEach(listener => {
      try {
        listener(mode, previousMode);
      } catch (error) {
        console.error('Error in mode change listener:', error);
      }
    });
  }

  // ============================================================
  // MODIFIED: Tracking Update Handler
  // ============================================================

  /**
   * Handle tracking update - routes to appropriate mode handler
   */
  private _handleTrackingUpdate(event: any): void {
    const { position, orientation, matrix, timestamp, frame_id } = event;

    // Route to appropriate mode handler
    switch (this.navigationMode) {
      case 'camera-follow':
        this._handleTrackingUpdateCameraFollow(position, orientation, matrix);
        break;

      case 'instrument-projection':
        this._handleTrackingUpdateInstrumentProjection(position, orientation, matrix);
        break;

      default:
        console.warn(`⚠️ Unknown navigation mode: ${this.navigationMode}`);
        break;
    }
  }

  /**
   * Handle tracking update for Camera Follow mode (EXISTING - refactored)
   */
  private _handleTrackingUpdateCameraFollow(
    position: number[],
    orientation: number[],
    matrix: number[]
  ): void {
    // Existing implementation - just renamed from _handleTrackingUpdate
    // ... (existing code from _updateCrosshairPosition, etc.)
  }

  /**
   * Handle tracking update for Instrument Projection mode (PHASE 2 PLACEHOLDER)
   */
  private _handleTrackingUpdateInstrumentProjection(
    position: number[],
    orientation: number[],
    matrix: number[]
  ): void {
    // Phase 2: Implement tool projection rendering
    // For now, just log that we're in projection mode
    if (this.updateCount % 100 === 0) {
      console.log('🎯 [Instrument Projection] Mode active, projection rendering coming in Phase 2');
      console.log(`   Tool position: [${position.map(v => v.toFixed(1)).join(', ')}]`);
    }

    // TODO Phase 2: Update tool projection overlay
    // if (this.toolProjectionRenderer) {
    //   this.toolProjectionRenderer.updateProjection(position, orientation, matrix);
    // }
  }
}
```

---

### 2. UI Component: TrackingPanel (Enhanced)

```typescript
// File: extensions/lifesync/src/components/Tracking/TrackingPanel.tsx

interface TrackingPanelState {
  // ... existing state ...

  // NEW: Navigation mode state
  navigationMode: 'camera-follow' | 'instrument-projection';
}

const TrackingPanel: React.FC = () => {
  // ... existing state ...

  // NEW: Navigation mode state
  const [navigationMode, setNavigationMode] = useState<'camera-follow' | 'instrument-projection'>('camera-follow');

  // NEW: Mode change handler
  const handleNavigationModeChange = useCallback((mode: 'camera-follow' | 'instrument-projection') => {
    setNavigationMode(mode);

    // Update NavigationController
    if (window.__navigationController) {
      window.__navigationController.setNavigationMode(mode);
    }

    // Show notification
    uiNotificationService?.show({
      title: 'Navigation Mode Changed',
      message: mode === 'camera-follow'
        ? '📹 Camera Follow: Viewport will follow tool movement'
        : '🎯 Instrument Projection: Tool will be projected on fixed viewport',
      type: 'info',
      duration: 3000,
    });
  }, []);

  // NEW: Subscribe to mode changes from NavigationController
  useEffect(() => {
    if (!window.__navigationController) return;

    const unsubscribe = window.__navigationController.onModeChange((newMode, previousMode) => {
      // Sync UI state with NavigationController state
      setNavigationMode(newMode);

      console.log(`UI: Navigation mode changed to ${newMode}`);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // NEW: UI Component
  return (
    <div className="tracking-panel">
      {/* ... existing UI ... */}

      {/* NEW: Navigation Mode Selection */}
      <div className="mb-4 p-3 rounded border border-gray-600 bg-gray-800">
        <div className="text-sm text-gray-300 mb-2 font-medium">
          Navigation Mode
        </div>

        <div className="space-y-2">
          {/* Camera Follow Mode */}
          <label className={`flex items-center space-x-2 cursor-pointer p-2 rounded ${
            navigationMode === 'camera-follow'
              ? 'bg-blue-600/20 border border-blue-500'
              : 'hover:bg-gray-700'
          }`}>
            <input
              type="radio"
              name="navigationMode"
              value="camera-follow"
              checked={navigationMode === 'camera-follow'}
              onChange={() => handleNavigationModeChange('camera-follow')}
              disabled={!isNavigating}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600
                         focus:ring-blue-500 focus:ring-2"
            />
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="text-lg">📹</span>
                <span className="text-sm text-gray-300 font-medium">
                  Camera Follow
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1 ml-6">
                Viewport follows tool movement and rotation
              </div>
            </div>
            {navigationMode === 'camera-follow' && (
              <span className="text-xs text-green-400 font-semibold">ACTIVE</span>
            )}
          </label>

          {/* Instrument Projection Mode */}
          <label className={`flex items-center space-x-2 cursor-pointer p-2 rounded ${
            navigationMode === 'instrument-projection'
              ? 'bg-green-600/20 border border-green-500'
              : 'hover:bg-gray-700'
          }`}>
            <input
              type="radio"
              name="navigationMode"
              value="instrument-projection"
              checked={navigationMode === 'instrument-projection'}
              onChange={() => handleNavigationModeChange('instrument-projection')}
              disabled={!isNavigating}
              className="w-4 h-4 text-green-600 bg-gray-700 border-gray-600
                         focus:ring-green-500 focus:ring-2"
            />
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="text-lg">🎯</span>
                <span className="text-sm text-gray-300 font-medium">
                  Instrument Projection
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1 ml-6">
                Tool projected on fixed viewport with axis and extension line
              </div>
              <div className="text-xs text-yellow-400 mt-1 ml-6">
                ⚠️ Coming in Phase 2
              </div>
            </div>
            {navigationMode === 'instrument-projection' && (
              <span className="text-xs text-green-400 font-semibold">ACTIVE</span>
            )}
          </label>
        </div>

        {!isNavigating && (
          <div className="text-xs text-yellow-400 mt-2 p-2 bg-yellow-900/20 rounded">
            ⚠️ Start navigation to enable mode switching
          </div>
        )}
      </div>

      {/* ... rest of existing UI ... */}
    </div>
  );
};
```

---

### 3. Commands Module (Enhanced)

```typescript
// File: extensions/lifesync/src/commandsModule.ts

const actions = {
  // ... existing actions ...

  /**
   * NEW: Set navigation mode
   * @param mode - Navigation mode: 'camera-follow' | 'instrument-projection'
   */
  setNavigationMode: ({ mode }: { mode: string }) => {
    console.log(`🧭 [setNavigationMode] Setting mode: ${mode}`);

    if (!window.__navigationController) {
      console.error('❌ NavigationController not available');
      uiNotificationService?.show({
        title: 'Error',
        message: 'Navigation controller not initialized',
        type: 'error',
      });
      return;
    }

    if (mode !== 'camera-follow' && mode !== 'instrument-projection') {
      console.error(`❌ Invalid navigation mode: ${mode}`);
      uiNotificationService?.show({
        title: 'Error',
        message: `Invalid navigation mode: ${mode}`,
        type: 'error',
      });
      return;
    }

    window.__navigationController.setNavigationMode(mode);

    uiNotificationService?.show({
      title: 'Navigation Mode Changed',
      message: `Mode set to: ${mode === 'camera-follow' ? 'Camera Follow' : 'Instrument Projection'}`,
      type: 'success',
      duration: 2000,
    });
  },

  /**
   * NEW: Get current navigation mode
   */
  getNavigationMode: () => {
    if (!window.__navigationController) {
      return null;
    }
    return window.__navigationController.getNavigationMode();
  },
};

const definitions = {
  // ... existing definitions ...

  setNavigationMode: {
    commandFn: actions.setNavigationMode,
    storeContexts: [],
    options: {},
  },

  getNavigationMode: {
    commandFn: actions.getNavigationMode,
    storeContexts: [],
    options: {},
  },
};
```

---

## 🔄 State Management

### Mode State Flow

```
┌─────────────────────────────────────────────────────────────┐
│              State Synchronization                          │
└─────────────────────────────────────────────────────────────┘

UI Component (TrackingPanel)
    ↓ (user clicks radio button)
handleNavigationModeChange()
    ↓
NavigationController.setNavigationMode()
    ↓
_internal mode state update
    ↓
_notifyModeChange()
    ↓
┌─────────────────────────────────────────┐
│  All Listeners Notified:                │
│  - TrackingPanel (sync UI)              │
│  - Other components (future)            │
└─────────────────────────────────────────┘
    ↓
Tracking updates routed to correct handler
```

### State Persistence

```typescript
// Optional: Persist mode preference in localStorage
const MODE_STORAGE_KEY = 'lifesync_navigation_mode';

class NavigationController {
  constructor(servicesManager: any) {
    // ... existing initialization ...

    // Load saved mode preference
    const savedMode = localStorage.getItem(MODE_STORAGE_KEY);
    if (savedMode && this._isValidMode(savedMode)) {
      this.navigationMode = savedMode;
      console.log(`📋 Loaded saved navigation mode: ${savedMode}`);
    }
  }

  public setNavigationMode(mode: NavigationMode, silent: boolean = false): void {
    // ... existing code ...

    // Save preference
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  }
}
```

---

## 🧪 Testing Strategy

### Unit Tests

```typescript
// navigationController.test.ts

describe('NavigationController Mode Switching', () => {
  let controller: NavigationController;

  beforeEach(() => {
    controller = new NavigationController(mockServicesManager);
  });

  test('should initialize with camera-follow mode', () => {
    expect(controller.getNavigationMode()).toBe('camera-follow');
  });

  test('should switch to instrument-projection mode', () => {
    const listener = jest.fn();
    controller.onModeChange(listener);

    controller.setNavigationMode('instrument-projection');

    expect(controller.getNavigationMode()).toBe('instrument-projection');
    expect(listener).toHaveBeenCalledWith('instrument-projection', 'camera-follow');
  });

  test('should route tracking updates to correct handler', () => {
    const cameraFollowSpy = jest.spyOn(controller, '_handleTrackingUpdateCameraFollow');
    const projectionSpy = jest.spyOn(controller, '_handleTrackingUpdateInstrumentProjection');

    // Test camera-follow mode
    controller.setNavigationMode('camera-follow');
    controller._handleTrackingUpdate({ position: [0, 0, 0], matrix: [] });
    expect(cameraFollowSpy).toHaveBeenCalled();

    // Test instrument-projection mode
    controller.setNavigationMode('instrument-projection');
    controller._handleTrackingUpdate({ position: [0, 0, 0], matrix: [] });
    expect(projectionSpy).toHaveBeenCalled();
  });
});
```

### Integration Tests

```typescript
// Test mode switching during active navigation
test('should switch modes during active navigation', () => {
  controller.startNavigation();
  controller.setNavigationMode('camera-follow');

  // Simulate tracking updates
  simulateTrackingUpdate();
  expect(viewport.camera.focalPoint).toHaveBeenUpdated();

  // Switch mode
  controller.setNavigationMode('instrument-projection');

  // Next update should use projection mode
  simulateTrackingUpdate();
  expect(viewport.camera.focalPoint).not.toHaveBeenUpdated(); // Fixed in projection mode
});
```

---

## 📝 Implementation Checklist

### Phase 1.1: Core Infrastructure
- [ ] Add `NavigationMode` type to NavigationController
- [ ] Add `setNavigationMode()` method
- [ ] Add `getNavigationMode()` method
- [ ] Add mode change listener system
- [ ] Refactor `_handleTrackingUpdate()` to route by mode
- [ ] Create `_handleTrackingUpdateCameraFollow()` (extract existing logic)
- [ ] Create `_handleTrackingUpdateInstrumentProjection()` (placeholder)

### Phase 1.2: UI Integration
- [ ] Add navigation mode state to TrackingPanel
- [ ] Add radio button UI for mode selection
- [ ] Add mode change handler
- [ ] Subscribe to NavigationController mode changes
- [ ] Add visual indicators for active mode
- [ ] Add mode descriptions and tooltips

### Phase 1.3: Commands Integration
- [ ] Add `setNavigationMode` command
- [ ] Add `getNavigationMode` command
- [ ] Register commands in commandsModule

### Phase 1.4: State Management
- [ ] Add localStorage persistence (optional)
- [ ] Add mode initialization on NavigationController creation
- [ ] Add mode validation

### Phase 1.5: Testing & Documentation
- [ ] Write unit tests for mode switching
- [ ] Write integration tests
- [ ] Update documentation
- [ ] Test backward compatibility

---

## ✅ Success Criteria

Phase 1 is complete when:

1. ✅ User can select navigation mode from UI
2. ✅ Mode switches cleanly between camera-follow and instrument-projection
3. ✅ Existing camera-follow mode continues to work
4. ✅ Mode state persists across navigation sessions
5. ✅ All components stay in sync during mode changes
6. ✅ No console errors during mode switching
7. ✅ UI clearly indicates active mode

---

## 🚀 Next Steps After Phase 1

Once Phase 1 is complete, Phase 2 will implement:
- ToolProjectionRenderer class
- 3D-to-2D projection calculations
- SVG overlay rendering
- Tool axis and extension line visualization

---

## 📚 Related Files

- `extensions/lifesync/src/utils/navigationController.ts` - Main controller
- `extensions/lifesync/src/components/Tracking/TrackingPanel.tsx` - UI component
- `extensions/lifesync/src/commandsModule.ts` - Commands registration

---

## 🔍 Review Questions

1. **Mode Default**: Should default be `camera-follow` or user preference?
   - ✅ Recommendation: `camera-follow` (backward compatible)

2. **Mode During Navigation**: Can user switch modes while navigation is active?
   - ✅ Recommendation: Yes, with smooth transition

3. **Mode Persistence**: Should mode be saved per session or globally?
   - ✅ Recommendation: Global preference (localStorage)

4. **Error Handling**: What if mode switch fails?
   - ✅ Recommendation: Log error, keep current mode, show notification

5. **Performance**: Any performance concerns with mode switching?
   - ✅ Recommendation: Mode switching is lightweight, no concerns

---

**Ready for Implementation?** ✅

If this architecture looks good, we can proceed with implementation!
