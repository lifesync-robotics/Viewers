# Cornerstone3D Crosshairs in OHIF - Technical Deep Dive

## Table of Contents
1. [Overview](#overview)
2. [Crosshairs Initialization](#crosshairs-initialization)
3. [Tool Activation Flow](#tool-activation-flow)
4. [Viewport State Integration](#viewport-state-integration)
5. [Rendering Control](#rendering-control)
6. [Identified Issues](#identified-issues)
7. [Solution Recommendations](#solution-recommendations)

---

## Overview

OHIF uses Cornerstone3D's `CrosshairsTool` for Multi-Planar Reconstruction (MPR) views. The crosshairs tool synchronizes multiple orthogonal viewports (axial, sagittal, coronal) and displays reference lines showing the intersection planes.

**Key Files:**
- `extensions/cornerstone/src/initCornerstoneTools.js` - Tool registration
- `modes/*/src/initToolGroups.ts` - Tool group configuration
- `extensions/cornerstone/src/commandsModule.ts` - Tool commands and lifecycle
- `extensions/cornerstone/src/services/ToolGroupService/ToolGroupService.ts` - Tool state management

---

## 1. Crosshairs Initialization

### 1.1 Tool Registration

**File:** `extensions/cornerstone/src/initCornerstoneTools.js`

```javascript
// Line 52: Mark CrosshairsTool as non-annotation
CrosshairsTool.isAnnotation = false;

// Line 88: Add tool to Cornerstone Tools registry
addTool(CrosshairsTool);
```

This registers the CrosshairsTool globally in Cornerstone3D's tool registry.

### 1.2 MPR Tool Group Configuration

**File:** `modes/basic/src/initToolGroups.ts` (Lines 240-269)

```javascript
disabled: [
  {
    toolName: toolNames.Crosshairs,
    configuration: {
      viewportIndicators: true,
      viewportIndicatorsConfig: {
        circleRadius: 5,
        xOffset: 0.95,
        yOffset: 0.05,
      },
      disableOnPassive: true,  // ⚠️ Important for lifecycle
      autoPan: {
        enabled: false,
        panSize: 10,
      },
      getReferenceLineColor: viewportId => {
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
  },
]
```

**Key Configuration Points:**
- **Initial State:** `disabled` - Tool is registered but not active
- **disableOnPassive: true** - When another tool becomes primary, crosshairs should be disabled (not just passive)
- **getReferenceLineColor** - Dynamic color assignment based on viewport orientation
- **viewportIndicators** - Show small circles indicating related viewports

### 1.3 Tool Group Creation

**File:** `extensions/cornerstone/src/services/ToolGroupService/ToolGroupService.ts`

```javascript
// Lines 273-301: Tools are added to the group
private _addTools(toolGroup, tools) {
  const addTools = tools => {
    tools.forEach(({ toolName, parentTool, configuration }) => {
      if (parentTool) {
        toolGroup.addToolInstance(toolName, parentTool, { ...configuration });
      } else {
        toolGroup.addTool(toolName, { ...configuration });
      }
    });
  };

  if (tools.disabled) {
    addTools(tools.disabled);
  }
}

// Lines 266-270: Tool modes are set
if (disabled) {
  disabled.forEach(({ toolName }) => {
    toolGroup.setToolDisabled(toolName);
  });
}
```

---

## 2. Tool Activation Flow

### 2.1 Button Click Handling

**File:** `modes/basic/src/toolbarButtons.ts` (Lines 644-661)

```javascript
{
  id: 'Crosshairs',
  uiType: 'ohif.toolButton',
  props: {
    type: 'tool',
    icon: 'tool-crosshair',
    label: 'Crosshairs',
    commands: {
      commandName: 'setToolActiveToolbar',  // ← Command invoked
      commandOptions: {
        toolGroupIds: ['mpr'],  // ← Specific to MPR tool group
      },
    },
    evaluate: {
      name: 'evaluate.cornerstoneTool',
      disabledText: 'Select an MPR viewport to enable this tool',
    },
  },
}
```

### 2.2 setToolActiveToolbar Command

**File:** `extensions/cornerstone/src/commandsModule.ts` (Lines 929-973)

```javascript
setToolActiveToolbar: ({ value, itemId, toolName, toolGroupIds = [] }) => {
  // Sometimes it is passed as value (tools with options), sometimes as itemId (toolbar buttons)
  toolName = toolName || itemId || value;

  toolGroupIds = toolGroupIds.length ? toolGroupIds : toolGroupService.getToolGroupIds();

  toolGroupIds.forEach(toolGroupId => {
    actions.setToolActive({ toolName, toolGroupId });
  });
},

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

  // Get currently active tool
  const activeToolName = toolGroup.getActivePrimaryMouseButtonTool();

  if (activeToolName) {
    const activeToolOptions = toolGroup.getToolConfiguration(activeToolName);
    // ⚠️ BUG SOURCE: This checks disableOnPassive on the OLD tool, not the NEW tool
    activeToolOptions?.disableOnPassive
      ? toolGroup.setToolDisabled(activeToolName)
      : toolGroup.setToolPassive(activeToolName);
  }

  // Set the new toolName to be active
  toolGroup.setToolActive(toolName, {
    bindings: [
      {
        mouseButton: Enums.MouseBindings.Primary,
      },
    ],
  });
},
```

### 2.3 Tool State Transitions

```
Initial State: disabled
     ↓
Button Click: setToolActiveToolbar('Crosshairs')
     ↓
Current active tool (e.g., WindowLevel) → disabled or passive
     ↓
Crosshairs → active (Primary mouse binding)
     ↓
User clicks another tool → Crosshairs should → disabled (due to disableOnPassive: true)
```

---

## 3. Viewport State Integration

### 3.1 Viewport Information Flow

**File:** `extensions/cornerstone/src/services/ViewportService/CornerstoneViewportService.ts`

```javascript
// Lines 1093-1119: Viewport update method
public updateViewport(viewportId: string, viewportData, keepCamera = false) {
  const viewportInfo = this.getViewportInfo(viewportId);
  const viewport = this.getCornerstoneViewport(viewportId);
  const viewportCamera = viewport.getCamera();

  let displaySetPromise;

  if (viewport instanceof VolumeViewport || viewport instanceof VolumeViewport3D) {
    displaySetPromise = this._setVolumeViewport(viewport, viewportData, viewportInfo).then(() => {
      if (keepCamera) {
        viewport.setCamera(viewportCamera);
        viewport.render();
      }
    });
  }

  if (viewport instanceof StackViewport) {
    displaySetPromise = this._setStackViewport(viewport, viewportData, viewportInfo);
  }

  displaySetPromise.then(() => {
    // ⚠️ Event is broadcast but crosshairs don't listen to it
    this._broadcastEvent(this.EVENTS.VIEWPORT_DATA_CHANGED, {
      viewportData,
      viewportId,
    });
  });
}
```

### 3.2 Missing Crosshairs Update Listener

**ISSUE:** There is no mechanism to update crosshairs when viewport data changes. The CrosshairsTool should be listening to:
- `VIEWPORT_DATA_CHANGED` event
- `CAMERA_MODIFIED` event
- `IMAGE_RENDERED` event

### 3.3 Color Callback Integration

The `getReferenceLineColor` callback is called by Cornerstone3D during rendering to get viewport-specific colors:

```javascript
getReferenceLineColor: viewportId => {
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
}
```

**Flow:**
1. Cornerstone3D CrosshairsTool renders reference lines
2. For each viewport, it calls `getReferenceLineColor(viewportId)`
3. OHIF retrieves viewport info from CornerstoneViewportService
4. Returns color based on viewport orientation (axial=red, sagittal=yellow, coronal=green)

---

## 4. Rendering Control

### 4.1 Reset Crosshairs Command

**File:** `extensions/cornerstone/src/commandsModule.ts` (Lines 1417-1436)

```javascript
resetCrosshairs: ({ viewportId }) => {
  const crosshairInstances = [];

  const getCrosshairInstances = toolGroupId => {
    const toolGroup = toolGroupService.getToolGroup(toolGroupId);
    crosshairInstances.push(toolGroup.getToolInstance('Crosshairs'));
  };

  if (!viewportId) {
    const toolGroupIds = toolGroupService.getToolGroupIds();
    toolGroupIds.forEach(getCrosshairInstances);
  } else {
    const toolGroup = toolGroupService.getToolGroupForViewport(viewportId);
    getCrosshairInstances(toolGroup.id);
  }

  crosshairInstances.forEach(ins => {
    ins?.computeToolCenter();  // ← Recalculates crosshair center position
  });
},
```

**When is it called?**

**File:** `extensions/cornerstone/src/init.tsx` (Lines 265-273)

```javascript
element.addEventListener(EVENTS.CAMERA_RESET, evt => {
  const { element } = evt.detail;
  const enabledElement = getEnabledElement(element);
  if (!enabledElement) {
    return;
  }
  const { viewportId } = enabledElement;
  commandsManager.runCommand('resetCrosshairs', { viewportId });
});
```

Also called:
- When metadata is updated (TMTV extension)
- When toggling back from one-up layout
- On camera reset events

### 4.2 Cornerstone3D Rendering Pipeline

```
User Interaction (Pan/Zoom/Rotate)
     ↓
Viewport Camera Modified
     ↓
Cornerstone3D CAMERA_MODIFIED event
     ↓
CrosshairsTool updates internal state
     ↓
Tool calls viewport.render()
     ↓
Crosshairs SVG annotations rendered on canvas
```

**Events CrosshairsTool should respond to:**
1. `CAMERA_MODIFIED` - Update crosshair position
2. `IMAGE_RENDERED` - Sync with rendered image
3. `VOLUME_NEW_IMAGE` - Update when scrolling through slices
4. `ANNOTATION_MODIFIED` - When crosshair handles are dragged

---

## 5. Identified Issues

### 5.1 Issue #1: Crosshairs Don't Update After Viewport Change

**Root Cause:**
The CrosshairsTool in Cornerstone3D relies on internal event listeners, but OHIF's viewport update mechanism (`updateViewport`) doesn't trigger the necessary events to update crosshairs.

**Code Location:** `CornerstoneViewportService.updateViewport()` (Line 1093)

**Problem:**
```javascript
displaySetPromise.then(() => {
  this._broadcastEvent(this.EVENTS.VIEWPORT_DATA_CHANGED, {
    viewportData,
    viewportId,
  });
});
```

This event is broadcast, but:
1. CrosshairsTool doesn't listen to `VIEWPORT_DATA_CHANGED`
2. `resetCrosshairs` command is not called automatically
3. Tool center position becomes stale

**Missing Integration:**
```javascript
// Should be added to CornerstoneViewportService or init.tsx
cornerstoneViewportService.subscribe(
  cornerstoneViewportService.EVENTS.VIEWPORT_DATA_CHANGED,
  ({ viewportId }) => {
    commandsManager.runCommand('resetCrosshairs', { viewportId });
  }
);
```

### 5.2 Issue #2: Crosshairs Cannot Be Removed After Toggling

**Root Cause:**
The toggle logic in `setToolActive` has a flaw. When crosshairs are active and you click the crosshairs button again (or another tool), the state transition doesn't work correctly.

**Code Location:** `commandsModule.ts` - `setToolActive` (Lines 956-963)

**Problem:**
```javascript
if (activeToolName) {
  const activeToolOptions = toolGroup.getToolConfiguration(activeToolName);
  activeToolOptions?.disableOnPassive
    ? toolGroup.setToolDisabled(activeToolName)
    : toolGroup.setToolPassive(activeToolName);
}
```

This checks `disableOnPassive` on the **currently active tool** (which might be WindowLevel), not on the tool being deactivated.

**Scenario:**
1. WindowLevel is active (no `disableOnPassive`)
2. User clicks Crosshairs button
3. WindowLevel → passive (not disabled, because it doesn't have `disableOnPassive`)
4. Crosshairs → active
5. User clicks Crosshairs button again (or another tool)
6. Crosshairs has `disableOnPassive: true`, but the code checks the previous tool's options
7. Crosshairs may incorrectly remain passive instead of disabled

**Missing Toggle Logic:**
There's no explicit toggle behavior. Clicking the same tool button again should:
- Check if tool is already active → disable it
- If tool is disabled → activate it

---

## 6. Solution Recommendations

### 6.1 Fix Issue #1 - Auto-update Crosshairs on Viewport Change

**File:** `extensions/cornerstone/src/init.tsx`

Add this after line 281:

```javascript
// Listen for viewport data changes and reset crosshairs
const { unsubscribe: unsubscribeViewportDataChanged } =
  cornerstoneViewportService.subscribe(
    cornerstoneViewportService.EVENTS.VIEWPORT_DATA_CHANGED,
    ({ viewportId }) => {
      const toolGroup = toolGroupService.getToolGroupForViewport(viewportId);
      if (toolGroup && toolGroup.hasTool('Crosshairs')) {
        const crosshairInstance = toolGroup.getToolInstance('Crosshairs');
        if (crosshairInstance && crosshairInstance.mode === Enums.ToolModes.Active) {
          commandsManager.runCommand('resetCrosshairs', { viewportId });
        }
      }
    }
  );

// Clean up on mode exit
unsubscriptions.push(unsubscribeViewportDataChanged);
```

### 6.2 Fix Issue #2 - Proper Crosshairs Toggle/Remove

**File:** `extensions/cornerstone/src/commandsModule.ts`

Replace the `setToolActive` function (Lines 939-973) with:

```javascript
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

  // Check if clicking the same tool (toggle behavior)
  if (activeToolName === toolName) {
    const toolConfig = toolGroup.getToolConfiguration(toolName);
    if (toolConfig?.disableOnPassive) {
      toolGroup.setToolDisabled(toolName);
    } else {
      toolGroup.setToolPassive(toolName);
    }

    // Activate the previous tool (or default to WindowLevel)
    const prevToolName = toolGroup.getPrevActivePrimaryToolName();
    if (prevToolName && prevToolName !== toolName) {
      toolGroup.setToolActive(prevToolName, {
        bindings: [{ mouseButton: Enums.MouseBindings.Primary }],
      });
    }
    return;
  }

  // Deactivate current tool
  if (activeToolName) {
    const activeToolConfig = toolGroup.getToolConfiguration(activeToolName);
    if (activeToolConfig?.disableOnPassive) {
      toolGroup.setToolDisabled(activeToolName);
    } else {
      toolGroup.setToolPassive(activeToolName);
    }
  }

  // Activate new tool
  toolGroup.setToolActive(toolName, {
    bindings: [{ mouseButton: Enums.MouseBindings.Primary }],
  });

  // Force render to update UI
  const renderingEngine = cornerstoneViewportService.getRenderingEngine();
  if (renderingEngine) {
    renderingEngine.render();
  }
},
```

### 6.3 Additional: Improve Crosshairs Lifecycle

**Option 1: Add explicit cleanup on viewport destroy**

```javascript
// In OHIFCornerstoneViewport.tsx
useEffect(() => {
  return () => {
    const toolGroup = toolGroupService.getToolGroupForViewport(viewportId);
    if (toolGroup) {
      const crosshairInstance = toolGroup.getToolInstance('Crosshairs');
      if (crosshairInstance) {
        // Clean up crosshair annotations
        crosshairInstance.onDisabled?.();
      }
    }
  };
}, [viewportId]);
```

**Option 2: Subscribe to hanging protocol changes**

```javascript
// In init.tsx or commandsModule
hangingProtocolService.subscribe(
  hangingProtocolService.EVENTS.PROTOCOL_CHANGED,
  () => {
    // Reset crosshairs when layout changes
    setTimeout(() => {
      commandsManager.runCommand('resetCrosshairs');
    }, 100);
  }
);
```

---

## 7. Testing the Fixes

### 7.1 Test Scenario for Issue #1

1. Load a study and switch to MPR view
2. Activate crosshairs tool
3. Change viewport data (e.g., load different series, change window/level preset)
4. **Expected:** Crosshairs update to correct position
5. **Without Fix:** Crosshairs stay at old position

### 7.2 Test Scenario for Issue #2

1. Load MPR view
2. Click Crosshairs button → Crosshairs activate
3. Click Crosshairs button again → Should deactivate
4. Click another tool (e.g., Pan) → Crosshairs should disappear
5. Click Crosshairs again → Should reactivate cleanly

### 7.3 Test Scenario for Reset

1. Activate crosshairs in MPR
2. Rotate/pan viewports
3. Click "Reset View" button
4. **Expected:** Crosshairs center recomputed
5. **Verify:** `resetCrosshairs` command is called

---

## 8. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        User Interface                        │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │ Crosshairs │  │    Pan     │  │   Zoom     │            │
│  │   Button   │  │   Button   │  │   Button   │            │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘            │
└────────┼────────────────┼────────────────┼───────────────────┘
         │                │                │
         ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Commands Manager                          │
│  ┌────────────────────────────────────────────────┐         │
│  │ setToolActiveToolbar('Crosshairs', ['mpr'])    │         │
│  │    ↓                                            │         │
│  │ setToolActive({ toolName: 'Crosshairs',        │         │
│  │                 toolGroupId: 'mpr' })           │         │
│  └────────────────────┬───────────────────────────┘         │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                 ToolGroupService                             │
│  ┌────────────────────────────────────────────────┐         │
│  │ getToolGroup('mpr')                             │         │
│  │ toolGroup.setToolActive('Crosshairs', ...)      │         │
│  └────────────────────┬───────────────────────────┘         │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│            Cornerstone3D ToolGroup Manager                   │
│  ┌──────────────────────────────────────────────┐           │
│  │ MPR ToolGroup                                 │           │
│  │  - WindowLevel (active → passive)             │           │
│  │  - Pan (passive)                              │           │
│  │  - Crosshairs (disabled → active)             │           │
│  └──────────────────┬───────────────────────────┘           │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                Cornerstone3D CrosshairsTool                  │
│  ┌──────────────────────────────────────────────┐           │
│  │ onSetToolActive()                             │           │
│  │   ↓                                           │           │
│  │ computeToolCenter() ← Calculate center point  │           │
│  │   ↓                                           │           │
│  │ createAnnotations() ← Create crosshair lines  │           │
│  │   ↓                                           │           │
│  │ Attach event listeners:                       │           │
│  │   - MOUSE_MOVE                                │           │
│  │   - MOUSE_DOWN                                │           │
│  │   - MOUSE_DRAG                                │           │
│  │   - CAMERA_MODIFIED                           │           │
│  └──────────────────┬───────────────────────────┘           │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│             Cornerstone3D Rendering Engine                   │
│  ┌──────────────────────────────────────────────┐           │
│  │ For each viewport:                            │           │
│  │   1. Render volume slice                      │           │
│  │   2. Call getReferenceLineColor(viewportId)   │           │
│  │   3. Render crosshair SVG annotations         │           │
│  │   4. Render viewport indicators (circles)     │           │
│  └──────────────────┬───────────────────────────┘           │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Browser Canvas/SVG                         │
│  ┌──────────────────────────────────────────────┐           │
│  │ Axial View         Sagittal View             │           │
│  │  ┌───────────┐      ┌───────────┐           │           │
│  │  │    🔴─    │      │     │     │            │           │
│  │  │     │     │      │    🟡     │            │           │
│  │  │     │     │      │   ─┴─    │            │           │
│  │  └───────────┘      └───────────┘           │           │
│  │                                              │           │
│  │ Coronal View                                 │           │
│  │  ┌───────────┐                               │           │
│  │  │     │     │                               │           │
│  │  │   ──🟢──  │                               │           │
│  │  │     │     │                               │           │
│  │  └───────────┘                               │           │
│  └──────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary

The crosshairs implementation in OHIF + Cornerstone3D involves multiple layers:

1. **Tool Registration** - CrosshairsTool added to Cornerstone registry
2. **Configuration** - Tool configured in MPR tool group with colors and behavior
3. **Activation** - Button click → Command → ToolGroup → Cornerstone3D
4. **State Management** - Tool modes (active/passive/disabled/enabled)
5. **Rendering** - Cornerstone3D renders crosshairs via SVG annotations
6. **Viewport Sync** - Crosshairs synchronize across orthogonal views

**The two identified bugs stem from:**
1. **Missing viewport change listener** - Crosshairs don't know when to update
2. **Incomplete toggle logic** - Tool state transitions don't properly handle deactivation

Implementing the recommended fixes will resolve both issues and improve the crosshairs user experience.





