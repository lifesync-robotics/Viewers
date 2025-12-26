# Screw Editor Camera Movement Bug Fix

## Problem Summary

The Screw Editor menu was causing unwanted camera movement while users dragged dimension sliders. The camera would continuously update instead of staying stable until the slider was released.

### Root Cause

The bug was introduced by the "shared screw operations" layer (`useScrewOperations`) which was called on **every slider change event** during drag, causing:

1. **Transform recalculation** - Screw position recalculated from cap on every drag event
2. **Model reload** - 3D screw model deleted and reloaded on every slider tick
3. **Backend sync** - API calls made continuously during drag
4. **Camera updates** - Camera followed the changing screw position during drag

The slider's `onChange` event fires continuously while dragging, but the system was treating each change as a committed edit.

## Solution: Event-Driven Architecture

We implemented a **refined event system** that distinguishes between different sources of screw updates using the **divide-and-conquer** technique to break up general fuzzy events into specific, actionable event types.

### 1. Event Type Hierarchy

Created `ScrewUpdateEventType` enum in `src/types/screwEvents.ts`:

```typescript
export enum ScrewUpdateEventType {
  SLIDER_DRAG              // In-progress slider drag (visual only)
  SLIDER_COMMIT            // Released slider (full update)
  DROPDOWN_SELECT          // Dropdown selection
  VIEWPORT_INTERACTION_DRAG // In-progress viewport drag (other viewports update)
  VIEWPORT_INTERACTION     // Released viewport drag (full update)
  SVG_CLICK                // 2D SVG overlay click
  PROGRAMMATIC             // System-triggered
  BACKEND_SYNC             // Backend refresh
}
```

### 2. Event-Specific Behaviors

Each event type has different update options:

| Event Type | Reload Model | Sync Backend | Update Camera | Recalc Transform | Notes |
|------------|--------------|--------------|---------------|------------------|-------|
| **SLIDER_DRAG** | ❌ No | ❌ No | ❌ No | ❌ No | Visual feedback only |
| **SLIDER_COMMIT** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes | Full update on release |
| DROPDOWN_SELECT | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes | Immediate full update |
| **VIEWPORT_INTERACTION_DRAG** | ❌ No | ❌ No | ✅ Yes* | ❌ No | *Other viewports only |
| **VIEWPORT_INTERACTION** | ✅ Yes | ✅ Yes | ✅ Yes* | ✅ Yes | *Other viewports only |
| SVG_CLICK | ❌ No | ❌ No | ✅ Yes | ❌ No | Navigation only |
| PROGRAMMATIC | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes | System updates |
| BACKEND_SYNC | ❌ No | ❌ No | ❌ No | ❌ No | State sync only |

**Key Fixes:** 
- `SLIDER_DRAG` events only update local state for visual feedback, with **no model operations or camera movement**.
- `VIEWPORT_INTERACTION_DRAG` and `VIEWPORT_INTERACTION` update **other viewports only** - the edited viewport camera stays stationary (crosshairs behavior).

### 3. Slider Component Updates

Modified `ScrewDimensionSlider` component to distinguish between drag and commit:

**Before:**
```typescript
<input
  type="range"
  onChange={handleChange}  // Fired continuously during drag
/>
```

**After:**
```typescript
<input
  type="range"
  onChange={handleSliderChange}    // Calls onDrag during drag
  onMouseDown={handleMouseDown}    // Sets isDragging = true
  onMouseUp={handleMouseUp}        // Calls onCommit, sets isDragging = false
  onTouchStart={handleMouseDown}   // Touch support
  onTouchEnd={handleTouchEnd}      // Touch support
/>
```

New props:
- `onDrag?: (value: number) => void` - Called during active dragging
- `onCommit?: (value: number) => void` - Called when user releases slider
- `onChange: (value: number) => void` - Fallback for backward compatibility

### 4. Hook Layer Updates

Updated `useScrewOperations.updateScrewDimensions` to accept event type:

```typescript
const updateScrewDimensions = useCallback(async (
  screwData: any,
  newRadius?: number,
  newLength?: number,
  eventType: ScrewUpdateEventType = ScrewUpdateEventType.PROGRAMMATIC
) => {
  const updateOptions = getScrewUpdateOptions(eventType);
  
  // Early return for SLIDER_DRAG - only update state
  if (eventType === ScrewUpdateEventType.SLIDER_DRAG) {
    // Update frontend state only, no model operations
    return { screwId, updatedRadius, updatedLength, skipped: true };
  }
  
  // Full update logic for other event types
  if (updateOptions.recalculateTransform) {
    // Recalculate transform from cap
  }
  
  if (updateOptions.reloadModel) {
    // Delete and reload 3D model
  }
  
  if (updateOptions.syncBackend) {
    // Sync with backend API
  }
}, [...]);
```

### 5. Component Handler Updates

Created separate handlers in `ScrewEditorActionMenu`:

**Drag Handlers (in-progress, visual feedback only):**
```typescript
const handleDragDiameter = useCallback(async (screwData, newDiameter) => {
  await screwOps.updateScrewDimensions(
    screwData, 
    newRadius, 
    undefined,
    ScrewUpdateEventType.SLIDER_DRAG  // No model reload
  );
}, [screwOps]);
```

**Commit Handlers (full update with model reload):**
```typescript
const handleUpdateDiameter = useCallback(async (screwData, newDiameter) => {
  setUpdatingScrewId(screwId);
  await screwOps.updateScrewDimensions(
    screwData, 
    newRadius, 
    undefined,
    ScrewUpdateEventType.SLIDER_COMMIT  // Full model reload
  );
  await loadScrews();
  setUpdatingScrewId(null);
}, [screwOps]);
```

### 6. Table Component Wiring

Updated `ScrewTable` to pass drag and commit handlers separately:

```typescript
<ScrewTable
  onUpdateDiameter={handleUpdateDiameter}
  onUpdateLength={handleUpdateLength}
  onDragDiameter={handleDragDiameter}    // NEW: Drag handler
  onDragLength={handleDragLength}        // NEW: Drag handler
  useSliders={true}
/>
```

## Files Changed

### New Files
1. `src/types/screwEvents.ts` - Event type system and helpers (8 event types)

### Modified Files
1. `src/hooks/useScrewOperations.ts` - Added event type parameter, conditional model operations
2. `src/components/ScrewManagement/ScrewManagementUI.tsx` - Updated slider with drag/commit events
3. `src/components/ScrewEditorMenu/ScrewEditorActionMenu.tsx` - Separate drag/commit handlers
4. `src/tools/ScrewInteractionTool.ts` - Viewport camera exclusion, real-time other viewport updates

## Behavior Changes

### Before Fix
```
User drags slider
  ↓
onChange fires continuously
  ↓
updateScrewDimensions called on every tick
  ↓
For each tick:
  - Recalculate transform from cap
  - Delete 3D model
  - Query backend for new mesh
  - Load new 3D model
  - Apply transform
  - Sync backend
  ↓
Camera follows changing screw position
Result: Camera moves while dragging ❌
```

### After Fix
```
User drags slider
  ↓
onDrag fires continuously (during drag)
  ↓
updateScrewDimensions(SLIDER_DRAG)
  ↓
Only update local state
  - No model operations
  - No backend sync
  - No camera movement
  ↓
User releases slider
  ↓
onCommit fires once
  ↓
updateScrewDimensions(SLIDER_COMMIT)
  ↓
Full update:
  - Recalculate transform
  - Reload 3D model
  - Sync backend
  ↓
Camera stays stable ✅
```

## Performance Improvements

1. **Reduced API calls** - No continuous backend updates during drag
2. **Reduced model operations** - No model delete/reload during drag
3. **Stable camera** - No camera updates during drag
4. **Better UX** - Smooth visual feedback without system load

## Viewport Interaction Camera Behavior (Crosshairs-Like)

### Problem
When users drag a screw using `ScrewInteractionTool` in a viewport (e.g., axial), the camera in that viewport would move, making it difficult to precisely position the screw.

### Solution: Stationary Edited Viewport
The viewport being edited stays **stationary** during and after screw manipulation, while **other viewports** update to show the new screw position/orientation. This matches crosshairs behavior.

**Example:**
- User drags screw in **Axial** viewport
  - ✅ **Axial camera**: Stays stationary (user can see what they're doing)
  - ✅ **3D viewport**: Updates in real-time to show screw movement
  - ✅ **Coronal viewport**: Updates in real-time to show screw movement
  - ✅ **Sagittal viewport**: Updates in real-time to show screw movement

### Implementation Details

1. **Track edited viewport** - Store `viewportId` in interaction state on mouse down
2. **Exclude from updates** - Pass `excludeViewportId` to `_updateViewportCamerasFromScrew`
3. **Real-time updates during drag** - Other viewports update every 3rd drag event (throttled)
4. **Final update on release** - Other viewports get final update on mouse up

```typescript
// In ScrewInteractionTool.ts

// Mouse down: Store viewport ID
this.state.viewportId = this._getViewportId(element);

// Mouse drag: Update OTHER viewports (throttled)
if (this._dragLogCounter % 3 === 0) {
  const editedViewportId = this.state.viewportId;
  this._updateViewportCamerasFromScrew(
    this.state.selectedScrewId, 
    editedViewportId  // Exclude edited viewport
  );
}

// Mouse up: Final update to OTHER viewports
this._updateViewportCamerasFromScrew(
  this.state.selectedScrewId, 
  this.state.viewportId  // Exclude edited viewport
);
```

## Testing Checklist

- [x] Create event type system
- [x] Update slider component with drag/commit events
- [x] Update useScrewOperations to handle event types
- [x] Update ScrewEditorActionMenu handlers
- [x] Fix ScrewInteractionTool viewport camera behavior
- [x] Add VIEWPORT_INTERACTION_DRAG event type
- [ ] Test camera stability during slider drag
- [ ] Test linked screw updates during drag
- [ ] Test slider commit updates model correctly
- [ ] Test dropdown selectors still work (non-slider mode)
- [ ] Test viewport interactions with stationary edited viewport
- [ ] Test other viewports update during viewport drag
- [ ] Test programmatic updates

## Future Enhancements

1. **Debounced backend sync** - For SLIDER_DRAG, could implement debounced backend updates instead of waiting for commit
2. **Optimistic UI updates** - Could show preview transforms without full recalculation
3. **Event telemetry** - Track event types for analytics and debugging
4. **Undo/redo support** - Event system makes it easier to implement undo/redo
5. **Batch operations** - Group multiple updates for linked screws

## Implementation Notes

### Divide and Conquer Strategy

The fix follows the user's suggested approach:

1. **Explicitly name event sources** - Created `ScrewUpdateEventType` enum with 7 distinct event types
2. **Refined events** - Broke up general "update" event into specific events (drag vs commit, viewport vs SVG, etc.)
3. **Update listeners correctly** - Each event type has specific update options and behaviors
4. **Controllable behaviors** - `getScrewUpdateOptions()` provides fine-grained control over what happens for each event

### Backward Compatibility

- Slider's `onChange` prop still works as fallback
- Components without drag/commit handlers work as before
- Default event type is `PROGRAMMATIC` for safety

### Touch Support

- Slider includes `onTouchStart` and `onTouchEnd` for mobile/tablet devices
- Same drag/commit logic applies to touch events

## Related Issues

- Original issue: Camera movement during screw dimension slider drag
- Related: Performance issues with continuous model reloads
- Related: Backend sync during in-progress edits

## Authors

- Implementation: AI Assistant
- Issue reported by: User
- Reviewed by: [Pending]

## Date

December 25, 2025

