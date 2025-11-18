# Crosshairs Bug Fixes - Implementation Guide

## Quick Summary of Issues

### Issue #1: Crosshairs Don't Update After Viewport Change
**Symptom:** When you change viewport data (switch series, change displaySet), crosshairs remain at the old position.

**Root Cause:** No event listener connects viewport data changes to crosshairs updates.

### Issue #2: Crosshairs Cannot Be Removed After Toggling
**Symptom:** Clicking the crosshairs button again doesn't deactivate it, crosshairs stay visible.

**Root Cause:** The toggle logic doesn't properly check if the same tool is being clicked, and `disableOnPassive` check is on the wrong tool.

---

## Fix #1: Auto-Update Crosshairs on Viewport Change

### File to Modify: `extensions/cornerstone/src/init.tsx`

**Location:** After line 281 (after the `ELEMENT_ENABLED` event listener)

**Add this code:**

```typescript
// =============================================================================
// FIX: Listen for viewport data changes and update crosshairs
// =============================================================================
const { unsubscribe: unsubscribeViewportDataChanged } =
  cornerstoneViewportService.subscribe(
    cornerstoneViewportService.EVENTS.VIEWPORT_DATA_CHANGED,
    ({ viewportId }) => {
      // Get the tool group for this viewport
      const toolGroup = toolGroupService.getToolGroupForViewport(viewportId);

      if (!toolGroup) {
        return;
      }

      // Check if crosshairs tool exists in this tool group
      if (!toolGroup.hasTool('Crosshairs')) {
        return;
      }

      // Get the crosshair tool instance
      const crosshairInstance = toolGroup.getToolInstance('Crosshairs');

      if (!crosshairInstance) {
        return;
      }

      // Only reset if crosshairs are currently active
      const toolOptions = toolGroup.getToolOptions('Crosshairs');
      const isActive = toolOptions?.mode === Enums.ToolModes.Active;

      if (isActive) {
        // Reset crosshairs to recalculate center for new viewport data
        commandsManager.runCommand('resetCrosshairs', { viewportId });
      }
    }
  );

// Store unsubscribe function for cleanup
unsubscriptions.push(unsubscribeViewportDataChanged);
```

### Why This Works

1. **Event-Driven:** Listens to `VIEWPORT_DATA_CHANGED` which is broadcast by `CornerstoneViewportService.updateViewport()`
2. **Conditional Reset:** Only resets crosshairs if they're currently active (avoids unnecessary work)
3. **Proper Cleanup:** Unsubscribes when the extension exits to prevent memory leaks

---

## Fix #2: Proper Crosshairs Toggle Behavior

### File to Modify: `extensions/cornerstone/src/commandsModule.ts`

**Location:** Replace the `setToolActive` function (Lines 939-973)

**Full replacement code:**

```typescript
setToolActive: ({ toolName, toolGroupId = null }) => {
  const { viewports } = viewportGridService.getState();

  if (!viewports.size) {
    return;
  }

  const toolGroup = toolGroupService.getToolGroup(toolGroupId);

  if (!toolGroup) {
    return;
  }

  if (!toolGroup?.hasTool(toolName)) {
    return;
  }

  const activeToolName = toolGroup.getActivePrimaryMouseButtonTool();

  // =============================================================================
  // FIX: Check if clicking the same tool (toggle behavior)
  // =============================================================================
  if (activeToolName === toolName) {
    console.log(`[setToolActive] Toggling off tool: ${toolName}`);

    // Get the configuration of the tool being deactivated
    const toolConfig = toolGroup.getToolConfiguration(toolName);

    // Check if this tool should be disabled (vs passive) when deactivated
    if (toolConfig?.disableOnPassive) {
      toolGroup.setToolDisabled(toolName);
    } else {
      toolGroup.setToolPassive(toolName);
    }

    // Activate the previous tool (or fallback)
    const prevToolName = toolGroup.getPrevActivePrimaryToolName();

    if (prevToolName && prevToolName !== toolName) {
      console.log(`[setToolActive] Restoring previous tool: ${prevToolName}`);
      toolGroup.setToolActive(prevToolName, {
        bindings: [{ mouseButton: Enums.MouseBindings.Primary }],
      });
    } else {
      // Fallback: activate WindowLevel as default
      if (toolGroup.hasTool('WindowLevel')) {
        console.log(`[setToolActive] Fallback to WindowLevel`);
        toolGroup.setToolActive('WindowLevel', {
          bindings: [{ mouseButton: Enums.MouseBindings.Primary }],
        });
      }
    }

    // Force render to update UI
    const renderingEngine = cornerstoneViewportService.getRenderingEngine();
    if (renderingEngine) {
      renderingEngine.render();
    }

    return; // Exit early - toggle complete
  }

  // =============================================================================
  // Normal activation: Deactivate current tool, activate new tool
  // =============================================================================
  if (activeToolName) {
    console.log(`[setToolActive] Deactivating: ${activeToolName}, Activating: ${toolName}`);

    // Get the configuration of the currently active tool
    const activeToolConfig = toolGroup.getToolConfiguration(activeToolName);

    // Deactivate based on its own configuration
    if (activeToolConfig?.disableOnPassive) {
      toolGroup.setToolDisabled(activeToolName);
    } else {
      toolGroup.setToolPassive(activeToolName);
    }
  }

  // Activate the new tool
  toolGroup.setToolActive(toolName, {
    bindings: [
      {
        mouseButton: Enums.MouseBindings.Primary,
      },
    ],
  });

  // Force render to update crosshairs immediately
  const renderingEngine = cornerstoneViewportService.getRenderingEngine();
  if (renderingEngine) {
    renderingEngine.render();
  }
},
```

### Key Changes Explained

#### 1. Toggle Detection
```typescript
if (activeToolName === toolName) {
  // User clicked the same tool again - toggle it off
  ...
}
```

#### 2. Correct Configuration Check
```typescript
// OLD (BUGGY):
activeToolOptions?.disableOnPassive  // Checks OLD tool's config

// NEW (FIXED):
const toolConfig = toolGroup.getToolConfiguration(toolName);
if (toolConfig?.disableOnPassive) {  // Checks the tool being deactivated
  toolGroup.setToolDisabled(toolName);
}
```

#### 3. Previous Tool Restoration
```typescript
const prevToolName = toolGroup.getPrevActivePrimaryToolName();
if (prevToolName && prevToolName !== toolName) {
  toolGroup.setToolActive(prevToolName, ...);
}
```

#### 4. Forced Render
```typescript
const renderingEngine = cornerstoneViewportService.getRenderingEngine();
if (renderingEngine) {
  renderingEngine.render();  // Immediately update the display
}
```

---

## Bonus Fix: Improve resetCrosshairs Command

### File to Modify: `extensions/cornerstone/src/commandsModule.ts`

**Location:** Replace the `resetCrosshairs` function (Lines 1417-1436)

**Enhanced version:**

```typescript
resetCrosshairs: ({ viewportId }) => {
  const crosshairInstances = [];

  const getCrosshairInstances = toolGroupId => {
    const toolGroup = toolGroupService.getToolGroup(toolGroupId);
    if (toolGroup && toolGroup.hasTool('Crosshairs')) {
      const instance = toolGroup.getToolInstance('Crosshairs');
      if (instance) {
        crosshairInstances.push({
          instance,
          toolGroup,
          toolGroupId,
        });
      }
    }
  };

  if (!viewportId) {
    // Reset all crosshairs in all tool groups
    const toolGroupIds = toolGroupService.getToolGroupIds();
    toolGroupIds.forEach(getCrosshairInstances);
  } else {
    // Reset only for specific viewport
    const toolGroup = toolGroupService.getToolGroupForViewport(viewportId);
    if (toolGroup) {
      getCrosshairInstances(toolGroup.id);
    }
  }

  console.log(`[resetCrosshairs] Resetting ${crosshairInstances.length} crosshair instances`);

  // Compute new centers for all crosshair instances
  crosshairInstances.forEach(({ instance, toolGroup, toolGroupId }) => {
    try {
      // Recalculate the center point based on current viewport states
      instance?.computeToolCenter();
      console.log(`[resetCrosshairs] Reset crosshairs for toolGroup: ${toolGroupId}`);
    } catch (error) {
      console.error(`[resetCrosshairs] Error resetting crosshairs:`, error);
    }
  });

  // Force render all viewports in affected tool groups
  crosshairInstances.forEach(({ toolGroup }) => {
    const viewportIds = toolGroup.getViewportIds();
    viewportIds.forEach(vpId => {
      try {
        const renderingEngine = cornerstoneViewportService.getRenderingEngine();
        const viewport = renderingEngine?.getViewport(vpId);
        if (viewport) {
          viewport.render();
        }
      } catch (error) {
        console.error(`[resetCrosshairs] Error rendering viewport ${vpId}:`, error);
      }
    });
  });
},
```

---

## Testing Instructions

### Test Case 1: Viewport Change Update

```javascript
// Steps:
1. Open OHIF with a reconstructable study
2. Switch to MPR layout (axial, sagittal, coronal views)
3. Click Crosshairs button → Crosshairs appear
4. In Study Browser, drag a different series into a viewport
5. ✅ Expected: Crosshairs automatically reposition to new data
6. ❌ Without fix: Crosshairs stay at old position

// Verify in console:
"[VIEWPORT_DATA_CHANGED] viewportId: mpr-axial"
"[resetCrosshairs] Resetting 1 crosshair instances"
```

### Test Case 2: Toggle Off Crosshairs

```javascript
// Steps:
1. Open MPR layout
2. Click Crosshairs button → Crosshairs activate (button highlighted)
3. Click Crosshairs button again
4. ✅ Expected: Crosshairs disappear, button no longer highlighted
5. ❌ Without fix: Crosshairs stay visible, button still highlighted

// Verify in console:
"[setToolActive] Toggling off tool: Crosshairs"
"[setToolActive] Restoring previous tool: WindowLevel"
```

### Test Case 3: Switch to Another Tool

```javascript
// Steps:
1. Open MPR layout
2. Click Crosshairs button → Crosshairs active
3. Click Pan button
4. ✅ Expected: Crosshairs disappear, Pan becomes active
5. ❌ Without fix: Crosshairs remain visible

// Verify in console:
"[setToolActive] Deactivating: Crosshairs, Activating: Pan"
```

### Test Case 4: Reset After Camera Change

```javascript
// Steps:
1. Open MPR with crosshairs active
2. Pan, zoom, or rotate the viewports
3. Click "Reset View" button
4. ✅ Expected: Crosshairs reposition to center
5. ✅ This should already work (CAMERA_RESET event handler exists)

// Verify in console:
"[resetCrosshairs] Resetting 1 crosshair instances"
```

---

## Architecture Flow After Fixes

### Flow 1: Viewport Data Change

```
User drags new series into viewport
         ↓
ViewportGridService.setDisplaySetsForViewport()
         ↓
CornerstoneViewportService.updateViewport()
         ↓
Broadcast: VIEWPORT_DATA_CHANGED event
         ↓
NEW EVENT LISTENER (Fix #1) ← Listens here
         ↓
Check if crosshairs active
         ↓
commandsManager.runCommand('resetCrosshairs')
         ↓
crosshairInstance.computeToolCenter()
         ↓
Crosshairs update to new position ✅
```

### Flow 2: Toggle Crosshairs Off

```
User clicks Crosshairs button (already active)
         ↓
commandsManager.run('setToolActiveToolbar', { toolName: 'Crosshairs' })
         ↓
setToolActive({ toolName: 'Crosshairs', toolGroupId: 'mpr' })
         ↓
Check: activeToolName === toolName? → YES (Toggle!)
         ↓
Get tool's config: disableOnPassive = true
         ↓
toolGroup.setToolDisabled('Crosshairs') ← Tool disabled ✅
         ↓
Restore previous tool or WindowLevel
         ↓
renderingEngine.render() ← Force update
         ↓
Crosshairs removed, UI updated ✅
```

### Flow 3: Switch from Crosshairs to Another Tool

```
User clicks Pan button (Crosshairs currently active)
         ↓
setToolActive({ toolName: 'Pan' })
         ↓
activeToolName = 'Crosshairs', toolName = 'Pan'
         ↓
Get Crosshairs config: disableOnPassive = true
         ↓
toolGroup.setToolDisabled('Crosshairs') ← Disabled ✅
         ↓
toolGroup.setToolActive('Pan')
         ↓
renderingEngine.render()
         ↓
Pan active, Crosshairs gone ✅
```

---

## Tool State Machine

```
┌─────────────────────────────────────────────────────────┐
│                  Crosshairs Tool States                  │
└─────────────────────────────────────────────────────────┘

                    ┌──────────────┐
                    │   DISABLED   │ ← Initial state
                    │  (invisible) │
                    └──────┬───────┘
                           │
              Click        │
           Crosshairs      │
              button       │
                           ↓
                    ┌──────────────┐
                    │    ACTIVE    │
                    │  (visible +  │
                    │   primary    │
                    │   mouse)     │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         Click same   Click other   Viewport
           button       tool         change
              │            │            │
              ↓            ↓            │
       ┌──────────────┐            │
       │   DISABLED   │◄───────────┘
       │  (because of │         Reset
       │ disableOn-   │      (stays active)
       │   Passive)   │
       └──────────────┘

Key Decision Point (Fix #2):
  When deactivating, check the BEING-DEACTIVATED tool's config,
  not the previously-active tool's config.
```

---

## Configuration Deep Dive

### Crosshairs Configuration Object

```javascript
{
  toolName: 'Crosshairs',
  configuration: {
    // Visual indicators in corner of each viewport
    viewportIndicators: true,
    viewportIndicatorsConfig: {
      circleRadius: 5,
      xOffset: 0.95,
      yOffset: 0.05,
    },

    // ⚠️ CRITICAL: Controls deactivation behavior
    disableOnPassive: true,  // When this tool becomes inactive,
                            // set it to DISABLED (not PASSIVE)
                            // This ensures crosshairs disappear completely

    // Auto-pan feature (currently disabled)
    autoPan: {
      enabled: false,
      panSize: 10,
    },

    // Dynamic color assignment
    getReferenceLineColor: viewportId => {
      // Returns color based on viewport orientation
      // Axial: red, Sagittal: yellow, Coronal: green
      const viewportInfo = cornerstoneViewportService.getViewportInfo(viewportId);
      const viewportOptions = viewportInfo?.viewportOptions;

      if (viewportOptions) {
        return (
          colours[viewportOptions.id] ||
          colorsByOrientation[viewportOptions.orientation] ||
          '#0c0'
        );
      }
      return '#0c0';
    },
  },
}
```

### Tool Modes Explained

| Mode | Behavior | Crosshairs Visible? |
|------|----------|---------------------|
| **ACTIVE** | Primary mouse button control | ✅ Yes |
| **PASSIVE** | No mouse control, but still rendered | ✅ Yes (but shouldn't be) |
| **ENABLED** | Enabled but not interactive | ❌ No |
| **DISABLED** | Completely off | ❌ No |

**The Bug:** When `disableOnPassive: true`, the tool should go to DISABLED, not PASSIVE, when deactivated. The original code didn't check this correctly.

---

## Additional Considerations

### 1. Multiple Tool Groups

If you have multiple tool groups (e.g., 'default', 'mpr', 'volume3d'), make sure:
- Only 'mpr' tool group has crosshairs configured
- `setToolActiveToolbar` is called with `toolGroupIds: ['mpr']`

### 2. Hanging Protocol Changes

When switching hanging protocols (layouts), crosshairs should reset:

```javascript
// Already implemented in extensions/default/src/commandsModule.ts
hangingProtocolService.subscribe(
  hangingProtocolService.EVENTS.PROTOCOL_CHANGED,
  () => {
    setTimeout(() => {
      commandsManager.runCommand('resetCrosshairs');
    }, 100);
  }
);
```

### 3. Viewport Destruction

When viewports are destroyed (e.g., changing studies), ensure tool groups are cleaned up:

```javascript
// ToolGroupService handles this in removeViewportFromToolGroup()
toolGroup.removeViewports(renderingEngineId, viewportId);
```

---

## Summary Checklist

- ✅ Fix #1: Add `VIEWPORT_DATA_CHANGED` listener in `init.tsx`
- ✅ Fix #2: Update `setToolActive` with toggle detection in `commandsModule.ts`
- ✅ Fix #2: Check correct tool's `disableOnPassive` configuration
- ✅ Fix #2: Add forced render after state change
- ✅ Bonus: Enhance `resetCrosshairs` with error handling and logging

After applying these fixes:
1. Crosshairs will auto-update when viewport data changes
2. Clicking crosshairs button toggles it on/off properly
3. Switching to another tool properly disables crosshairs
4. Console logs help debug tool state transitions

---

## References

- **Cornerstone3D Docs:** https://www.cornerstonejs.org/docs/concepts/cornerstone-tools/tools
- **CrosshairsTool Source:** `@cornerstonejs/tools` package
- **OHIF Tool Integration:** `extensions/cornerstone/src/`
- **Tool Group Management:** `ToolGroupService.ts`

---

**Document Version:** 1.0
**Last Updated:** 2025-01-30
**Author:** AI Assistant
**Status:** Ready for Implementation





