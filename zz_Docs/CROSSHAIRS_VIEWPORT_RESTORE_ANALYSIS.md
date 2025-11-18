# Crosshairs and Viewport Restore Analysis

## Problem Statement

After implementing the `VIEWPORT_DATA_CHANGED` fix for crosshairs, the `restoreSnapshot()` function still doesn't bring crosshairs back into alignment when restoring viewport state.

## Root Cause Analysis

### What `restoreSnapshot()` Does

```typescript
// viewportStateService.ts lines 164-206
restoreSnapshot(name: string): boolean {
  snapshot.viewports.forEach(savedState => {
    const vp = engine.getViewport(savedState.metadata.viewportId);

    vp.setCamera(savedState.camera);            // ← Direct Cornerstone3D call
    vp.setViewPresentation(savedState.viewPresentation); // ← Direct call
    vp.setViewReference(savedState.viewReference);       // ← Direct call
    vp.render();                                 // ← Direct call
  });
}
```

### Events Triggered by Cornerstone3D Methods

| Method | Event Triggered | Listener Location |
|--------|----------------|-------------------|
| `vp.setCamera()` | `CAMERA_MODIFIED` on element | ❌ **NOT listened for crosshairs** |
| `vp.setViewPresentation()` | None | N/A |
| `vp.setViewReference()` | None | N/A |
| `vp.render()` | `IMAGE_RENDERED` on element | Various overlays |

### Current Crosshairs Event Listeners

```typescript
// init.tsx lines 267-275
element.addEventListener(EVENTS.CAMERA_RESET, evt => {
  commandsManager.runCommand('resetCrosshairs', { viewportId });
});

// init.tsx lines 285-301
cornerstoneViewportService.subscribe(
  cornerstoneViewportService.EVENTS.VIEWPORT_DATA_CHANGED,
  (props) => {
    if (toolGroup.getActivePrimaryMouseButtonTool() === 'Crosshairs') {
      commandsManager.runCommand('resetCrosshairs', { viewportId });
    }
  }
);
```

**Missing:** No listener for `CAMERA_MODIFIED` event

### Why `restoreSnapshot()` Doesn't Trigger Crosshairs Update

1. ❌ **Does NOT call** `cornerstoneViewportService.updateViewport()` → No `VIEWPORT_DATA_CHANGED` event
2. ❌ **Does NOT trigger** `CAMERA_RESET` event → Only manual camera reset triggers this
3. ✅ **DOES trigger** `CAMERA_MODIFIED` event → But no one is listening for crosshairs

## Event Flow Comparison

### Normal Viewport Update (Works)
```
User drags new series into viewport
         ↓
ViewportGridService.setDisplaySetsForViewport()
         ↓
CornerstoneViewportService.updateViewport()
         ↓
Broadcasts VIEWPORT_DATA_CHANGED event
         ↓
Event listener (Fix #1) catches it
         ↓
commandsManager.runCommand('resetCrosshairs')
         ↓
Crosshairs updated ✅
```

### Viewport Restore (Broken)
```
User clicks "Restore Snapshot"
         ↓
ViewportStateService.restoreSnapshot()
         ↓
viewport.setCamera(savedState.camera)
         ↓
Triggers CAMERA_MODIFIED event on element
         ↓
❌ No crosshairs listener
         ↓
Crosshairs NOT updated ❌
```

## Verification: Events Triggered by restoreSnapshot

To verify what events are triggered, add logging:

```typescript
// Temporary debugging code
const element = document.querySelector('[data-viewport-uid]');

element.addEventListener(EVENTS.CAMERA_MODIFIED, (evt) => {
  console.log('🎥 CAMERA_MODIFIED triggered', evt.detail);
});

element.addEventListener(EVENTS.CAMERA_RESET, (evt) => {
  console.log('🔄 CAMERA_RESET triggered', evt.detail);
});

element.addEventListener(EVENTS.IMAGE_RENDERED, (evt) => {
  console.log('🖼️ IMAGE_RENDERED triggered', evt.detail);
});
```

**Expected output when calling `restoreSnapshot()`:**
```
🎥 CAMERA_MODIFIED triggered { ... }
🎥 CAMERA_MODIFIED triggered { ... }
🎥 CAMERA_MODIFIED triggered { ... }
🖼️ IMAGE_RENDERED triggered { ... }
🖼️ IMAGE_RENDERED triggered { ... }
🖼️ IMAGE_RENDERED triggered { ... }
```

**No `CAMERA_RESET` or `VIEWPORT_DATA_CHANGED` events.**

## Solution Options

### Option 1: Add CAMERA_MODIFIED Listener (Recommended)

Add a `CAMERA_MODIFIED` event listener that resets crosshairs when camera changes.

**File:** `extensions/cornerstone/src/init.tsx`

```typescript
function elementEnabledHandler(evt) {
  const { element } = evt.detail;
  const { viewport } = getEnabledElement(element);
  initViewTiming({ element });

  // Existing CAMERA_RESET listener
  element.addEventListener(EVENTS.CAMERA_RESET, evt => {
    const { element } = evt.detail;
    const enabledElement = getEnabledElement(element);
    if (!enabledElement) {
      return;
    }
    const { viewportId } = enabledElement;
    commandsManager.runCommand('resetCrosshairs', { viewportId });
  });

  // NEW: Add CAMERA_MODIFIED listener for crosshairs
  element.addEventListener(EVENTS.CAMERA_MODIFIED, evt => {
    const { element } = evt.detail;
    const enabledElement = getEnabledElement(element);
    if (!enabledElement) {
      return;
    }
    const { viewportId } = enabledElement;

    const toolGroup = toolGroupService.getToolGroupForViewport(viewportId);
    if (!toolGroup || !toolGroup.hasTool('Crosshairs')) {
      return;
    }

    // Only reset if crosshairs are active
    if (toolGroup.getActivePrimaryMouseButtonTool() === 'Crosshairs') {
      commandsManager.runCommand('resetCrosshairs', { viewportId });
    }
  });

  // limitation: currently supporting only volume viewports with fusion
  if (viewport.type !== cornerstone.Enums.ViewportType.ORTHOGRAPHIC) {
    return;
  }
}
```

**Pros:**
- ✅ Catches all camera changes (pan, zoom, rotate, restore)
- ✅ Works with `restoreSnapshot()`
- ✅ Consistent with how overlays handle camera changes
- ✅ Minimal code changes

**Cons:**
- ⚠️ May trigger too frequently (every pan/zoom)
- ⚠️ Could impact performance if not debounced

### Option 2: Modify restoreSnapshot to Broadcast Event

Modify `restoreSnapshot()` to broadcast through the service.

**File:** `extensions/cornerstone/src/viewportStateService.ts`

```typescript
restoreSnapshot(name: string, servicesManager): boolean {
  const snapshot = this.snapshots.get(name);
  const engine = this.getEngine();
  const { cornerstoneViewportService } = servicesManager.services;

  snapshot.viewports.forEach(savedState => {
    const vp = engine.getViewport(savedState.metadata.viewportId);

    vp.setCamera(savedState.camera);
    // ... other setters ...
    vp.render();

    // NEW: Broadcast custom event after restore
    cornerstoneViewportService._broadcastEvent(
      cornerstoneViewportService.EVENTS.VIEWPORT_DATA_CHANGED,
      {
        viewportId: savedState.metadata.viewportId,
        reason: 'snapshot_restored'
      }
    );
  });
}
```

**Pros:**
- ✅ Reuses existing event listener
- ✅ Only triggers when snapshot is restored (not on every camera change)
- ✅ Cleaner event flow

**Cons:**
- ❌ Requires passing `servicesManager` to `viewportStateService`
- ❌ Semantic mismatch (`VIEWPORT_DATA_CHANGED` but data didn't change, only camera)
- ❌ More invasive change

### Option 3: Debounced CAMERA_MODIFIED Listener

Same as Option 1 but with debouncing to avoid performance issues.

```typescript
// Add debounce utility at top of init.tsx
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// In elementEnabledHandler
const debouncedResetCrosshairs = debounce((viewportId) => {
  const toolGroup = toolGroupService.getToolGroupForViewport(viewportId);
  if (toolGroup && toolGroup.getActivePrimaryMouseButtonTool() === 'Crosshairs') {
    commandsManager.runCommand('resetCrosshairs', { viewportId });
  }
}, 100); // 100ms debounce

element.addEventListener(EVENTS.CAMERA_MODIFIED, evt => {
  const { element } = evt.detail;
  const enabledElement = getEnabledElement(element);
  if (!enabledElement) return;

  debouncedResetCrosshairs(enabledElement.viewportId);
});
```

**Pros:**
- ✅ All benefits of Option 1
- ✅ Performance optimized
- ✅ Prevents excessive crosshairs recomputation during drag operations

**Cons:**
- ⚠️ Slight delay in crosshairs update (100ms)

## Recommended Solution: Option 3 (Debounced CAMERA_MODIFIED)

This provides the best balance of:
- Coverage (works for all camera changes including restore)
- Performance (debounced to avoid excessive updates)
- Maintainability (minimal changes, follows existing patterns)

## Implementation

See the implementation in the next update to `init.tsx`.

## Testing Checklist

After implementing the fix:

- [ ] ✅ **Viewport Data Change**: Drag new series → Crosshairs update
- [ ] ✅ **Snapshot Restore**: Restore snapshot → Crosshairs align correctly
- [ ] ✅ **Manual Camera Reset**: Click reset button → Crosshairs reset
- [ ] ✅ **Pan/Zoom**: Pan or zoom viewport → Crosshairs stay aligned
- [ ] ✅ **Performance**: No lag during continuous pan/zoom operations

## Additional Notes

### Why Not Use CrosshairsTool's Built-in Listeners?

Cornerstone3D's `CrosshairsTool` has internal event listeners for:
- `MOUSE_MOVE`
- `MOUSE_DRAG`
- `MOUSE_DOWN`
- `CAMERA_MODIFIED` (for reference line updates)

However, these listeners update the **reference lines** (the colored lines in linked viewports), not the **tool center** (the focal point of all three views). The `computeToolCenter()` method needs to be called explicitly when:
1. Viewport data changes (different series)
2. Camera is reset to default position
3. Camera is restored to saved position

### Alternative: Call resetCrosshairs from viewportStateService

```typescript
// In viewportStateService.ts
restoreSnapshot(name: string, commandsManager): boolean {
  // ... existing restore logic ...

  // After all viewports restored:
  commandsManager.runCommand('resetCrosshairs');

  return true;
}
```

This is simpler but requires changing the service signature and all call sites.

## References

- **Cornerstone3D Events**: https://www.cornerstonejs.org/docs/concepts/cornerstone-core/events
- **CAMERA_MODIFIED**: Triggered when camera properties change (position, focal point, zoom, etc.)
- **CAMERA_RESET**: Triggered only when explicitly resetting camera to initial state
- **IMAGE_RENDERED**: Triggered after viewport render completes



