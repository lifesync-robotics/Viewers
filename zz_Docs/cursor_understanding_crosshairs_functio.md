# Understanding crosshairs functionality in cornerstone3d
_Exported on 10/30/2025 at 14:13:34 GMT+8 from Cursor (2.0.38)_

---

**User**

OHIF uses cornerstone3d for all rendering of volume stack view port and tools placement such as crosshairs for MPR. at present, the crosshairs are buggy 1) cannot update itself after viewport change 2) cannot be removed after toggling  crosshairs button. show the detailed guide on how cornerstone 3d manipuate crosshairs, how the viewport state information is fed to crosshairs and how crosshairs rendering is controlled?

---

**Cursor**

I'll help you understand how OHIF uses Cornerstone3D for crosshairs manipulation, viewport state management, and rendering control. Let me explore the codebase to provide you with a detailed guide.

Let me read the key files that handle crosshairs implementation:

Let me search for more specific information about how crosshairs updates and viewport events are handled:

Now let me search for the resetCrosshairs command and more viewport event handling:

Based on my analysis of the codebase, I'll create a comprehensive guide explaining how OHIF uses Cornerstone3D for crosshairs manipulation, viewport state management, and the likely causes of the bugs you're experiencing.

```markdown
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

```

Now let me also check how the tool button evaluator works to understand the toggle state:

Perfect! Now let me create a summary document with visual diagrams and code examples:

```markdown
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

```

Now let me create one final visual diagram document to show the complete event and data flow:

```markdown
# Crosshairs Architecture - Visual Flow Diagrams

## 1. Component Interaction Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          OHIF Application Layer                          │
│                                                                          │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐            │
│  │  Toolbar UI    │  │  Viewport    │  │  Service Layer  │            │
│  │  Components    │  │  Components  │  │                 │            │
│  └────────┬───────┘  └──────┬───────┘  └────────┬────────┘            │
└───────────┼──────────────────┼──────────────────┼──────────────────────┘
            │                  │                  │
            │ Commands         │ View State       │ State Management
            ↓                  ↓                  ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      OHIF Services & Managers                            │
│                                                                          │
│  ┌─────────────────────┐  ┌────────────────────┐  ┌──────────────────┐│
│  │  CommandsManager    │  │  ToolGroupService  │  │  Viewport        ││
│  │                     │  │                    │  │  Service         ││
│  │  - setToolActive    │←→│  - getToolGroup    │←→│  - updateViewport││
│  │  - resetCrosshairs  │  │  - createToolGroup │  │  - getViewport   ││
│  └──────────┬──────────┘  └──────────┬─────────┘  └────────┬─────────┘│
└─────────────┼────────────────────────┼────────────────────┼───────────┘
              │                        │                    │
              │ Tool State Mgmt        │ Tool Operations    │ Viewport Ops
              ↓                        ↓                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                       Cornerstone3D Library                              │
│                                                                          │
│  ┌────────────────────┐  ┌───────────────────┐  ┌───────────────────┐ │
│  │  ToolGroupManager  │  │  CrosshairsTool   │  │  RenderingEngine  │ │
│  │                    │  │                   │  │                   │ │
│  │  - Tool Registry   │  │  - Tool Instance  │  │  - Viewports      │ │
│  │  - State Machine   │  │  - Annotations    │  │  - Rendering      │ │
│  │  - Event Dispatch  │  │  - Interactions   │  │  - Event Target   │ │
│  └──────────┬─────────┘  └─────────┬─────────┘  └─────────┬─────────┘ │
└─────────────┼────────────────────────┼──────────────────────┼───────────┘
              │                        │                      │
              │ Events                 │ Rendering            │ Canvas
              ↓                        ↓                      ↓
         ┌─────────────────────────────────────────────────────┐
         │          Browser (Canvas/SVG/Events)                 │
         └─────────────────────────────────────────────────────┘
```

---

## 2. Crosshairs Activation Flow

```
USER CLICKS CROSSHAIRS BUTTON
         │
         ↓
┌────────────────────────────────────────────────────────────────┐
│ Step 1: UI Button Click Handler                                │
│                                                                 │
│ File: modes/basic/src/toolbarButtons.ts                        │
│                                                                 │
│  {                                                              │
│    id: 'Crosshairs',                                           │
│    commands: {                                                 │
│      commandName: 'setToolActiveToolbar',                      │
│      commandOptions: { toolGroupIds: ['mpr'] }                 │
│    }                                                            │
│  }                                                              │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ Step 2: Command Execution                                      │
│                                                                 │
│ File: extensions/cornerstone/src/commandsModule.ts             │
│                                                                 │
│  commandsManager.runCommand('setToolActiveToolbar', {          │
│    toolName: 'Crosshairs',                                     │
│    toolGroupIds: ['mpr']                                       │
│  })                                                             │
│         │                                                       │
│         ↓                                                       │
│  setToolActiveToolbar() {                                      │
│    toolGroupIds.forEach(toolGroupId => {                       │
│      actions.setToolActive({                                   │
│        toolName: 'Crosshairs',                                 │
│        toolGroupId: 'mpr'                                      │
│      })                                                         │
│    })                                                           │
│  }                                                              │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ Step 3: Tool State Change                                      │
│                                                                 │
│ File: extensions/cornerstone/src/commandsModule.ts             │
│                                                                 │
│  setToolActive({ toolName, toolGroupId }) {                    │
│                                                                 │
│    const toolGroup = toolGroupService.getToolGroup('mpr')      │
│                                                                 │
│    // Get currently active tool                                │
│    const activeToolName =                                      │
│      toolGroup.getActivePrimaryMouseButtonTool()               │
│    // → Returns 'WindowLevel' (currently active)               │
│                                                                 │
│    // Deactivate WindowLevel                                   │
│    const activeToolConfig =                                    │
│      toolGroup.getToolConfiguration('WindowLevel')             │
│    // → { disableOnPassive: undefined }                        │
│                                                                 │
│    if (activeToolConfig?.disableOnPassive) {                   │
│      toolGroup.setToolDisabled('WindowLevel')                  │
│    } else {                                                     │
│      toolGroup.setToolPassive('WindowLevel') ✓                 │
│    }                                                            │
│                                                                 │
│    // Activate Crosshairs                                      │
│    toolGroup.setToolActive('Crosshairs', {                     │
│      bindings: [{ mouseButton: Primary }]                      │
│    })                                                           │
│  }                                                              │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ Step 4: Cornerstone3D Tool Activation                          │
│                                                                 │
│ Library: @cornerstonejs/tools                                  │
│                                                                 │
│  ToolGroup.setToolActive('Crosshairs') {                       │
│                                                                 │
│    // Update internal state                                    │
│    this._toolInstances['Crosshairs'].mode = 'Active'           │
│                                                                 │
│    // Get tool instance                                        │
│    const crosshairTool =                                       │
│      this._toolInstances['Crosshairs']                         │
│                                                                 │
│    // Call tool's activation lifecycle                         │
│    crosshairTool.onSetToolActive()                             │
│  }                                                              │
│         │                                                       │
│         ↓                                                       │
│  CrosshairsTool.onSetToolActive() {                            │
│    // Compute initial center point                             │
│    this.computeToolCenter()                                    │
│                                                                 │
│    // Create annotation objects                                │
│    this.createAnnotations()                                    │
│                                                                 │
│    // Register event listeners                                 │
│    this.addEventListeners()                                    │
│                                                                 │
│    // Trigger initial render                                   │
│    this.renderAnnotations()                                    │
│  }                                                              │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ Step 5: Rendering                                              │
│                                                                 │
│ Library: @cornerstonejs/core                                   │
│                                                                 │
│  RenderingEngine.render() {                                    │
│                                                                 │
│    // For each viewport (axial, sagittal, coronal)             │
│    viewportIds.forEach(viewportId => {                         │
│                                                                 │
│      const viewport = this.getViewport(viewportId)             │
│                                                                 │
│      // Render volume slice                                    │
│      viewport.renderVolume()                                   │
│                                                                 │
│      // Get SVG layer for annotations                          │
│      const svgLayer = viewport.getSvgLayer()                   │
│                                                                 │
│      // Render crosshair lines                                 │
│      crosshairTool.renderAnnotation(svgLayer, {                │
│        viewport,                                               │
│        viewportId                                              │
│      })                                                         │
│           │                                                     │
│           ↓                                                     │
│      // Call getReferenceLineColor callback                    │
│      const color = config.getReferenceLineColor(viewportId)    │
│           │                                                     │
│           ↓                                                     │
│      OHIF: cornerstoneViewportService.getViewportInfo()        │
│           │                                                     │
│           ↓                                                     │
│      Returns: 'rgb(200, 0, 0)' for axial view                  │
│      Returns: 'rgb(200, 200, 0)' for sagittal view             │
│      Returns: 'rgb(0, 200, 0)' for coronal view                │
│                                                                 │
│      // Draw colored reference lines                           │
│      svgLayer.drawLine(...)                                    │
│                                                                 │
│      // Draw viewport indicators (circles)                     │
│      svgLayer.drawCircle(...)                                  │
│    })                                                           │
│  }                                                              │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ Step 6: UI Update                                              │
│                                                                 │
│ RESULT: Crosshairs visible in all three MPR viewports          │
│         Button highlighted in toolbar                           │
│         Tool responds to mouse interactions                     │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. Bug #1 - Viewport Change (Without Fix)

```
USER DRAGS NEW SERIES INTO VIEWPORT
         │
         ↓
┌────────────────────────────────────────────────────────────────┐
│ ViewportGridService.setDisplaySetsForViewport()                │
└───────────────────────────────┬────────────────────────────────┘
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ CornerstoneViewportService.updateViewport()                    │
│                                                                 │
│  - Loads new volume data                                       │
│  - Updates viewport camera                                     │
│  - Calls viewport.render()                                     │
│  - Broadcasts VIEWPORT_DATA_CHANGED event                      │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ ❌ NO LISTENER FOR THIS EVENT                                  │
│                                                                 │
│ CrosshairsTool still uses old center point calculation!        │
│ Crosshairs appear at incorrect position                        │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. Bug #1 - Viewport Change (With Fix)

```
USER DRAGS NEW SERIES INTO VIEWPORT
         │
         ↓
┌────────────────────────────────────────────────────────────────┐
│ ViewportGridService.setDisplaySetsForViewport()                │
└───────────────────────────────┬────────────────────────────────┘
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ CornerstoneViewportService.updateViewport()                    │
│                                                                 │
│  - Loads new volume data                                       │
│  - Updates viewport camera                                     │
│  - Calls viewport.render()                                     │
│  - Broadcasts VIEWPORT_DATA_CHANGED event ◄─────┐              │
└───────────────────────────────┬────────────────│──────────────┘
                                │                │
                                │                │
                                │                │ Listens
                                ↓                │
┌────────────────────────────────────────────────│──────────────┐
│ ✅ NEW EVENT LISTENER (Added in init.tsx)      │              │
│                                                 │              │
│  cornerstoneViewportService.subscribe(          │              │
│    VIEWPORT_DATA_CHANGED, ──────────────────────┘              │
│    ({ viewportId }) => {                                       │
│                                                                 │
│      const toolGroup =                                         │
│        toolGroupService.getToolGroupForViewport(viewportId)    │
│                                                                 │
│      const crosshairInstance =                                 │
│        toolGroup.getToolInstance('Crosshairs')                 │
│                                                                 │
│      if (crosshairInstance.mode === 'Active') {                │
│        commandsManager.runCommand('resetCrosshairs', {         │
│          viewportId                                            │
│        })                                                       │
│      }                                                          │
│    }                                                            │
│  )                                                              │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ resetCrosshairs Command                                        │
│                                                                 │
│  const crosshairInstance =                                     │
│    toolGroup.getToolInstance('Crosshairs')                     │
│                                                                 │
│  crosshairInstance.computeToolCenter()                         │
│    │                                                            │
│    ↓                                                            │
│  - Queries all viewports in tool group                         │
│  - Gets current image dimensions                               │
│  - Calculates new center point in world coordinates            │
│  - Updates internal state                                      │
│  - Triggers re-render                                          │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ ✅ RESULT: Crosshairs update to correct position!              │
└────────────────────────────────────────────────────────────────┘
```

---

## 5. Bug #2 - Toggle Off (Without Fix)

```
USER CLICKS CROSSHAIRS BUTTON AGAIN (Currently Active)
         │
         ↓
┌────────────────────────────────────────────────────────────────┐
│ setToolActiveToolbar('Crosshairs')                             │
└───────────────────────────────┬────────────────────────────────┘
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ setToolActive({ toolName: 'Crosshairs', toolGroupId: 'mpr' }) │
│                                                                 │
│  const activeToolName =                                        │
│    toolGroup.getActivePrimaryMouseButtonTool()                 │
│  // → Returns 'Crosshairs' (currently active)                  │
│                                                                 │
│  ❌ NO CHECK if activeToolName === toolName                    │
│                                                                 │
│  // BUG: Proceeds to deactivate and reactivate same tool       │
│                                                                 │
│  if (activeToolName) {  // True                                │
│    const activeToolOptions =                                   │
│      toolGroup.getToolConfiguration('Crosshairs')              │
│    // → { disableOnPassive: true }                             │
│                                                                 │
│    if (activeToolOptions?.disableOnPassive) {                  │
│      toolGroup.setToolDisabled('Crosshairs') ✓                 │
│    }                                                            │
│  }                                                              │
│                                                                 │
│  // Then immediately reactivates!                              │
│  toolGroup.setToolActive('Crosshairs', ...)  ❌                │
│                                                                 │
│  // Result: Tool stays active!                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## 6. Bug #2 - Toggle Off (With Fix)

```
USER CLICKS CROSSHAIRS BUTTON AGAIN (Currently Active)
         │
         ↓
┌────────────────────────────────────────────────────────────────┐
│ setToolActiveToolbar('Crosshairs')                             │
└───────────────────────────────┬────────────────────────────────┘
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ ✅ FIXED setToolActive()                                       │
│                                                                 │
│  const activeToolName =                                        │
│    toolGroup.getActivePrimaryMouseButtonTool()                 │
│  // → Returns 'Crosshairs'                                     │
│                                                                 │
│  ✅ NEW CHECK: Toggle detection                                │
│  if (activeToolName === toolName) {  // TRUE!                  │
│                                                                 │
│    // Get the configuration of the tool being deactivated      │
│    const toolConfig =                                          │
│      toolGroup.getToolConfiguration('Crosshairs')              │
│    // → { disableOnPassive: true }                             │
│                                                                 │
│    if (toolConfig?.disableOnPassive) {                         │
│      toolGroup.setToolDisabled('Crosshairs') ✓                 │
│    } else {                                                     │
│      toolGroup.setToolPassive('Crosshairs')                    │
│    }                                                            │
│                                                                 │
│    // Restore previous tool                                    │
│    const prevToolName =                                        │
│      toolGroup.getPrevActivePrimaryToolName()                  │
│    // → Returns 'WindowLevel'                                  │
│                                                                 │
│    if (prevToolName && prevToolName !== toolName) {            │
│      toolGroup.setToolActive('WindowLevel', ...)  ✓            │
│    }                                                            │
│                                                                 │
│    renderingEngine.render() ✓                                  │
│                                                                 │
│    return; // Exit early ✓                                     │
│  }                                                              │
│                                                                 │
│  // Rest of function never executes in toggle case             │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ ✅ RESULT:                                                      │
│  - Crosshairs tool → DISABLED                                  │
│  - WindowLevel tool → ACTIVE                                   │
│  - Crosshairs disappear from viewport                          │
│  - Button no longer highlighted                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 7. Tool State Synchronization

```
┌───────────────────────────────────────────────────────────────┐
│               Tool State in Different Layers                   │
└───────────────────────────────────────────────────────────────┘

Layer 1: Cornerstone3D ToolGroup (Source of Truth)
┌─────────────────────────────────────────────────────────┐
│ ToolGroup 'mpr' {                                        │
│   _toolInstances: {                                      │
│     'WindowLevel': {                                     │
│       mode: 'Passive',  ← State stored here             │
│       bindings: [],                                      │
│       configuration: { ... }                             │
│     },                                                   │
│     'Crosshairs': {                                      │
│       mode: 'Active',  ← State stored here              │
│       bindings: [{ mouseButton: 1 }],                    │
│       configuration: {                                   │
│         disableOnPassive: true,                          │
│         getReferenceLineColor: fn,                       │
│         ...                                              │
│       }                                                  │
│     },                                                   │
│     'Pan': { mode: 'Passive', ... },                    │
│     'Zoom': { mode: 'Passive', ... }                    │
│   },                                                     │
│   _activePrimaryTool: 'Crosshairs',                     │
│   _prevActivePrimaryTool: 'WindowLevel'                 │
│ }                                                        │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ Queried by
                   ↓
Layer 2: OHIF ToolGroupService (Proxy)
┌─────────────────────────────────────────────────────────┐
│ ToolGroupService {                                       │
│   getToolGroup(toolGroupId) {                            │
│     return ToolGroupManager.getToolGroup(toolGroupId)    │
│     // Returns reference to Cornerstone ToolGroup        │
│   }                                                       │
│                                                           │
│   getToolGroupForViewport(viewportId) {                  │
│     return ToolGroupManager.getToolGroupForViewport(...)  │
│   }                                                       │
│                                                           │
│   getActivePrimaryMouseButtonTool(toolGroupId) {         │
│     return toolGroup.getActivePrimaryMouseButtonTool()   │
│     // → 'Crosshairs'                                    │
│   }                                                       │
│ }                                                         │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ Used by
                   ↓
Layer 3: OHIF UI Evaluators (Reactive)
┌─────────────────────────────────────────────────────────┐
│ evaluate.cornerstoneTool() {                             │
│   const toolGroup =                                      │
│     toolGroupService.getToolGroupForViewport(viewportId) │
│                                                           │
│   const toolName =                                       │
│     toolbarService.getToolNameForButton(button)          │
│   // → 'Crosshairs'                                      │
│                                                           │
│   const isPrimaryActive =                                │
│     toolGroup.getActivePrimaryMouseButtonTool() ===      │
│     toolName                                             │
│   // → true                                              │
│                                                           │
│   return {                                               │
│     disabled: false,                                     │
│     isActive: isPrimaryActive  ← Drives UI state         │
│   }                                                       │
│ }                                                         │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ Updates
                   ↓
Layer 4: UI Button (Visual Representation)
┌─────────────────────────────────────────────────────────┐
│ <ToolButton                                              │
│   id="Crosshairs"                                        │
│   isActive={true}  ← From evaluator                      │
│   className="!text-black bg-primary-light" ← Highlighted│
│   onClick={...}                                          │
│ />                                                        │
└─────────────────────────────────────────────────────────┘
```

---

## 8. Event Flow During Crosshairs Interaction

```
┌───────────────────────────────────────────────────────────────┐
│              Crosshairs Mouse Drag Interaction                 │
└───────────────────────────────────────────────────────────────┘

User drags crosshair handle
         │
         ↓
┌────────────────────────────────────────────────────────────────┐
│ Browser MouseEvent                                             │
│  - type: 'mousemove'                                           │
│  - target: <canvas>                                            │
│  - clientX, clientY                                            │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ Cornerstone3D Event Target                                     │
│                                                                 │
│  eventTarget.dispatchEvent(new CustomEvent(                    │
│    'MOUSE_DRAG',                                               │
│    {                                                            │
│      detail: {                                                 │
│        element,                                                │
│        currentPoints: { canvas, world },                       │
│        deltaPoints: { canvas, world }                          │
│      }                                                          │
│    }                                                            │
│  ))                                                             │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ CrosshairsTool Event Handler                                   │
│                                                                 │
│  onMouseDrag(evt) {                                            │
│    // Get annotation being dragged                             │
│    const annotation = this.getAnnotationAtPoint(...)           │
│                                                                 │
│    // Update annotation position                               │
│    annotation.data.handles.center = evt.detail.currentPoints   │
│                                                                 │
│    // Update other viewports                                   │
│    this.updateLinkedViewports()                                │
│      │                                                          │
│      ↓                                                          │
│    For each linked viewport:                                   │
│      - Calculate new slice index                               │
│      - Update viewport camera                                  │
│      - Trigger render                                          │
│  }                                                              │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ Cornerstone3D Rendering Pipeline                               │
│                                                                 │
│  For each viewport:                                            │
│    1. Clear canvas                                             │
│    2. Render volume at new slice position                      │
│    3. Render crosshair annotations                             │
│    4. Draw reference lines with updated position               │
│                                                                 │
│  Broadcasts: IMAGE_RENDERED event                              │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ OHIF Viewport Overlays Update                                  │
│                                                                 │
│  useEffect(() => {                                             │
│    element.addEventListener(                                   │
│      Enums.Events.IMAGE_RENDERED,                              │
│      updateOverlay                                             │
│    )                                                            │
│  })                                                             │
│                                                                 │
│  Updates slice number, orientation labels, etc.                │
└────────────────────────────────────────────────────────────────┘
```

---

## 9. Data Flow for getReferenceLineColor

```
┌───────────────────────────────────────────────────────────────┐
│           Dynamic Color Assignment for Reference Lines         │
└───────────────────────────────────────────────────────────────┘

CrosshairsTool needs to render reference lines
         │
         ↓
┌────────────────────────────────────────────────────────────────┐
│ CrosshairsTool.renderAnnotation(viewport, annotation)          │
│                                                                 │
│  For each viewport in tool group:                              │
│    const color = this.configuration.getReferenceLineColor(     │
│      targetViewportId                                          │
│    )                                                            │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓ Callback into OHIF
┌────────────────────────────────────────────────────────────────┐
│ OHIF Configuration Callback                                    │
│ (Defined in initToolGroups.ts)                                 │
│                                                                 │
│  getReferenceLineColor: viewportId => {                        │
│    // Step 1: Get viewport metadata from OHIF service          │
│    const viewportInfo =                                        │
│      cornerstoneViewportService.getViewportInfo(viewportId)    │
│         │                                                       │
│         ↓                                                       │
│    Returns: {                                                  │
│      viewportOptions: {                                        │
│        id: 'viewport-0',                                       │
│        orientation: 'axial',                                   │
│        viewportType: 'volume',                                 │
│        ...                                                      │
│      },                                                         │
│      ...                                                        │
│    }                                                            │
│                                                                 │
│    // Step 2: Lookup color by viewport ID or orientation       │
│    const viewportOptions = viewportInfo?.viewportOptions       │
│                                                                 │
│    if (viewportOptions) {                                      │
│      return (                                                  │
│        colours[viewportOptions.id] ||  // Try ID first         │
│        colorsByOrientation[viewportOptions.orientation] || //  │
│        '#0c0'  // Fallback green                               │
│      )                                                          │
│    }                                                            │
│                                                                 │
│    return '#0c0'  // Default fallback                          │
│  }                                                              │
│                                                                 │
│  Color Mappings:                                               │
│  ┌─────────────────┬──────────────────┬─────────────┐         │
│  │ Viewport        │ Orientation      │ Color       │         │
│  ├─────────────────┼──────────────────┼─────────────┤         │
│  │ viewport-0      │ axial            │ Red         │         │
│  │ viewport-1      │ sagittal         │ Yellow      │         │
│  │ viewport-2      │ coronal          │ Green       │         │
│  └─────────────────┴──────────────────┴─────────────┘         │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓ Returns color string
┌────────────────────────────────────────────────────────────────┐
│ CrosshairsTool receives color                                  │
│                                                                 │
│  color = 'rgb(200, 0, 0)'  (for axial view)                    │
│                                                                 │
│  Draws reference line with this color on SVG layer             │
└────────────────────────────────────────────────────────────────┘
```

---

## 10. Complete Lifecycle Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                   Crosshairs Complete Lifecycle                  │
└─────────────────────────────────────────────────────────────────┘

INITIALIZATION (Mode Entry)
    │
    ├─► initToolGroups() → Creates 'mpr' tool group
    │       └─► Adds Crosshairs tool in DISABLED state
    │
    ├─► elementEnabledHandler() → Viewports created
    │       └─► Tool group assigned to viewports
    │
    └─► Ready for user interaction


USER ACTIVATION
    │
    ├─► Click Crosshairs button
    │       ↓
    ├─► setToolActiveToolbar('Crosshairs')
    │       ↓
    ├─► Tool state: DISABLED → ACTIVE
    │       ↓
    ├─► CrosshairsTool.onSetToolActive()
    │       ├─► computeToolCenter()
    │       ├─► createAnnotations()
    │       └─► addEventListeners()
    │           ├─► MOUSE_MOVE
    │           ├─► MOUSE_DOWN
    │           ├─► MOUSE_DRAG
    │           └─► CAMERA_MODIFIED
    │
    └─► Rendering → Crosshairs visible


USER INTERACTION
    │
    ├─► Drag crosshair handle
    │       ↓
    │   MOUSE_DRAG event
    │       ↓
    │   Update annotation position
    │       ↓
    │   Update linked viewports
    │       ↓
    │   Render all viewports
    │
    ├─► Pan/Zoom viewport
    │       ↓
    │   CAMERA_MODIFIED event
    │       ↓
    │   CrosshairsTool updates reference lines
    │       ↓
    │   Render
    │
    └─► Rotate slab
            ↓
        Update crosshair orientation
            ↓
        Render


VIEWPORT CHANGES
    │
    ├─► Load new series
    │       ↓
    │   updateViewport()
    │       ↓
    │   Broadcast VIEWPORT_DATA_CHANGED
    │       ↓
    │   ✅ Event listener (Fix #1)
    │       ↓
    │   resetCrosshairs()
    │       ├─► computeToolCenter()
    │       └─► Render
    │
    ├─► Change hanging protocol
    │       ↓
    │   PROTOCOL_CHANGED event
    │       ↓
    │   resetCrosshairs()
    │       └─► Recalculate centers
    │
    └─► Camera reset
            ↓
        CAMERA_RESET event
            ↓
        resetCrosshairs()
            └─► Restore default position


USER DEACTIVATION
    │
    ├─► Click Crosshairs button again (Toggle)
    │       ↓
    │   ✅ Detect toggle (Fix #2)
    │       ↓
    │   Tool state: ACTIVE → DISABLED
    │       ↓
    │   CrosshairsTool.onSetToolDisabled()
    │       ├─► Remove annotations
    │       ├─► Remove event listeners
    │       └─► Clear SVG layer
    │           ↓
    │   Restore previous tool (WindowLevel)
    │       ↓
    │   Render → Crosshairs disappear
    │
    └─► Click another tool (e.g., Pan)
            ↓
        Deactivate Crosshairs
            ↓
        Tool state: ACTIVE → DISABLED
            ↓
        Activate Pan
            ↓
        Render → Crosshairs disappear


CLEANUP (Mode Exit)
    │
    ├─► Unsubscribe event listeners
    │       └─► ✅ VIEWPORT_DATA_CHANGED listener
    │
    ├─► Destroy tool groups
    │       └─► ToolGroupManager.destroyToolGroup('mpr')
    │
    └─► Clean up viewports
```

---

## Summary

These diagrams illustrate:

1. **Component Architecture**: How OHIF layers on top of Cornerstone3D
2. **Activation Flow**: Step-by-step tool activation process
3. **Bug Scenarios**: Before and after fixes for both bugs
4. **State Synchronization**: How tool state flows through layers
5. **Event Handling**: Mouse interaction and viewport event flow
6. **Data Callbacks**: How OHIF configuration integrates with Cornerstone
7. **Complete Lifecycle**: From initialization to cleanup

The key takeaways:
- **Bug #1**: Missing event listener connection
- **Bug #2**: Incorrect toggle logic and config check
- **Solution**: Add event listener + improve toggle detection

All fixes are localized to two files:
- `extensions/cornerstone/src/init.tsx` (Bug #1)
- `extensions/cornerstone/src/commandsModule.ts` (Bug #2)

```

Now let me create a concise README to tie everything together:

```markdown
# OHIF Crosshairs - Complete Technical Documentation

## 📚 Documentation Overview

This documentation provides a complete technical analysis of how OHIF uses Cornerstone3D's CrosshairsTool for Multi-Planar Reconstruction (MPR) views, including identified bugs and their solutions.

### 📄 Documentation Files

1. **[CROSSHAIRS_TECHNICAL_GUIDE.md](./CROSSHAIRS_TECHNICAL_GUIDE.md)**
   - Comprehensive technical deep dive
   - Initialization and configuration details
   - Tool activation flow
   - Viewport state integration
   - Detailed bug analysis with root causes
   - Solution recommendations

2. **[CROSSHAIRS_FIX_IMPLEMENTATION.md](./CROSSHAIRS_FIX_IMPLEMENTATION.md)**
   - Ready-to-use code fixes
   - Implementation instructions
   - Testing procedures
   - Before/after comparisons
   - Code examples with explanations

3. **[CROSSHAIRS_ARCHITECTURE_DIAGRAM.md](./CROSSHAIRS_ARCHITECTURE_DIAGRAM.md)**
   - Visual flow diagrams
   - Component interaction maps
   - Event flow illustrations
   - State synchronization diagrams
   - Complete lifecycle overview

---

## 🐛 Identified Bugs

### Bug #1: Crosshairs Don't Update After Viewport Change

**Symptom:**
When viewport data changes (e.g., dragging a new series into the viewport, changing display sets), the crosshairs remain at their old position instead of recalculating the center.

**Root Cause:**
- No event listener connects `VIEWPORT_DATA_CHANGED` events to crosshairs updates
- The `resetCrosshairs` command is only called on camera reset, not on viewport data changes

**Impact:**
- Crosshairs appear at incorrect positions
- User must manually toggle crosshairs off/on to fix positioning
- Poor user experience in MPR workflows

---

### Bug #2: Crosshairs Cannot Be Removed After Toggling

**Symptom:**
Once crosshairs are activated, clicking the crosshairs button again doesn't deactivate them. The tool remains active and visible.

**Root Cause:**
- The `setToolActive` function doesn't detect when the same tool is being clicked (toggle behavior)
- The code checks `disableOnPassive` on the wrong tool (the previously active tool instead of the tool being deactivated)
- No early return when toggling, causing immediate reactivation

**Impact:**
- Users cannot turn off crosshairs via the toolbar button
- Only way to remove crosshairs is to close and reopen the viewer
- Tools with `disableOnPassive: true` configuration don't work correctly

---

## ✅ Solutions

### Fix #1: Auto-Update Crosshairs on Viewport Change

**File:** `extensions/cornerstone/src/init.tsx`  
**Location:** After line 281

**What it does:**
- Adds an event listener for `VIEWPORT_DATA_CHANGED`
- Automatically calls `resetCrosshairs` when viewport data changes
- Only resets if crosshairs are currently active

**Code:** See [CROSSHAIRS_FIX_IMPLEMENTATION.md - Fix #1](./CROSSHAIRS_FIX_IMPLEMENTATION.md#fix-1-auto-update-crosshairs-on-viewport-change)

---

### Fix #2: Proper Crosshairs Toggle Behavior

**File:** `extensions/cornerstone/src/commandsModule.ts`  
**Location:** Replace `setToolActive` function (Lines 939-973)

**What it does:**
- Detects when the same tool is clicked again (toggle behavior)
- Checks the correct tool's `disableOnPassive` configuration
- Properly disables the tool and restores the previous tool
- Forces immediate render to update UI

**Code:** See [CROSSHAIRS_FIX_IMPLEMENTATION.md - Fix #2](./CROSSHAIRS_FIX_IMPLEMENTATION.md#fix-2-proper-crosshairs-toggle-behavior)

---

## 🗂️ Key Files in Codebase

### Core Files

| File | Purpose |
|------|---------|
| `extensions/cornerstone/src/initCornerstoneTools.js` | Registers CrosshairsTool globally |
| `modes/basic/src/initToolGroups.ts` | Configures crosshairs for MPR tool group |
| `extensions/cornerstone/src/commandsModule.ts` | Tool activation/deactivation commands |
| `extensions/cornerstone/src/services/ToolGroupService/ToolGroupService.ts` | Tool group state management |
| `extensions/cornerstone/src/services/ViewportService/CornerstoneViewportService.ts` | Viewport lifecycle and events |
| `extensions/cornerstone/src/init.tsx` | Extension initialization and event handlers |

### Configuration Files

| File | Purpose |
|------|---------|
| `modes/basic/src/toolbarButtons.ts` | Crosshairs button definition |
| `modes/segmentation/src/initToolGroups.ts` | Segmentation mode crosshairs config |
| `modes/tmtv/src/utils/setCrosshairsConfiguration.js` | TMTV-specific crosshairs setup |

### UI Files

| File | Purpose |
|------|---------|
| `extensions/cornerstone/src/getToolbarModule.tsx` | Tool evaluators (button state logic) |
| `platform/core/src/services/ToolBarService/ToolbarService.ts` | Toolbar state management |

### Test Files

| File | Purpose |
|------|---------|
| `tests/Crosshairs.spec.ts` | E2E tests for crosshairs functionality |

---

## 🔍 How Crosshairs Work

### High-Level Flow

```
1. Tool Registration
   └─► Cornerstone3D adds CrosshairsTool to registry

2. Tool Group Configuration
   └─► OHIF creates 'mpr' tool group with crosshairs in DISABLED state

3. User Activation
   └─► Click button → setToolActiveToolbar → Tool becomes ACTIVE

4. Rendering
   └─► CrosshairsTool renders reference lines on SVG layer
   └─► Calls getReferenceLineColor callback for viewport-specific colors

5. Viewport Updates (🐛 Bug #1)
   └─► Viewport data changes → Should reset crosshairs

6. User Deactivation (🐛 Bug #2)
   └─► Click button again → Should toggle off → Tool becomes DISABLED
```

### Tool State Machine

```
DISABLED → ACTIVE → DISABLED
   ↑         ↓         ↑
   └─────────┴─────────┘
     (Toggle behavior)
```

### Viewport State Integration

```
CornerstoneViewportService
  └─► updateViewport()
       └─► Broadcast VIEWPORT_DATA_CHANGED
            └─► (Missing) Event listener
                 └─► resetCrosshairs
                      └─► computeToolCenter()
```

---

## 🧪 Testing

### Test Scenarios

1. **Viewport Change**
   - Load MPR view
   - Activate crosshairs
   - Drag new series → ✅ Crosshairs update

2. **Toggle Off**
   - Activate crosshairs
   - Click button again → ✅ Crosshairs disappear

3. **Switch Tools**
   - Activate crosshairs
   - Click Pan button → ✅ Crosshairs disappear, Pan active

4. **Camera Reset**
   - Pan/zoom viewports
   - Click Reset → ✅ Crosshairs reposition to center

### Expected Console Logs

```javascript
// Fix #1 (Viewport Change)
"[VIEWPORT_DATA_CHANGED] viewportId: mpr-axial"
"[resetCrosshairs] Resetting 1 crosshair instances"
"[resetCrosshairs] Reset crosshairs for toolGroup: mpr"

// Fix #2 (Toggle Off)
"[setToolActive] Toggling off tool: Crosshairs"
"[setToolActive] Restoring previous tool: WindowLevel"

// Fix #2 (Switch Tool)
"[setToolActive] Deactivating: Crosshairs, Activating: Pan"
```

---

## 📋 Configuration Reference

### Crosshairs Configuration Object

```javascript
{
  toolName: 'Crosshairs',
  configuration: {
    // Show viewport indicators (colored circles)
    viewportIndicators: true,
    viewportIndicatorsConfig: {
      circleRadius: 5,
      xOffset: 0.95,
      yOffset: 0.05,
    },
    
    // ⚠️ CRITICAL: Ensures tool is disabled (not passive) when deactivated
    disableOnPassive: true,
    
    // Auto-pan feature
    autoPan: {
      enabled: false,
      panSize: 10,
    },
    
    // Dynamic color assignment
    getReferenceLineColor: viewportId => {
      const viewportInfo = cornerstoneViewportService.getViewportInfo(viewportId);
      const orientation = viewportInfo?.viewportOptions?.orientation;
      
      // Red for axial, yellow for sagittal, green for coronal
      return colorsByOrientation[orientation] || '#0c0';
    },
  },
}
```

### Color Mappings

| Viewport | Orientation | Color | RGB |
|----------|-------------|-------|-----|
| Axial | axial | Red | `rgb(200, 0, 0)` |
| Sagittal | sagittal | Yellow | `rgb(200, 200, 0)` |
| Coronal | coronal | Green | `rgb(0, 200, 0)` |

---

## 🚀 Quick Start

### For Understanding the System

1. Read [CROSSHAIRS_TECHNICAL_GUIDE.md](./CROSSHAIRS_TECHNICAL_GUIDE.md) sections 1-3
2. Review [CROSSHAIRS_ARCHITECTURE_DIAGRAM.md](./CROSSHAIRS_ARCHITECTURE_DIAGRAM.md) diagrams 1-2
3. Understand the bug scenarios in sections 3-6

### For Implementing Fixes

1. Go to [CROSSHAIRS_FIX_IMPLEMENTATION.md](./CROSSHAIRS_FIX_IMPLEMENTATION.md)
2. Apply Fix #1 code to `init.tsx`
3. Apply Fix #2 code to `commandsModule.ts`
4. Follow testing instructions
5. Verify console logs

### For Debugging

1. Check [CROSSHAIRS_ARCHITECTURE_DIAGRAM.md](./CROSSHAIRS_ARCHITECTURE_DIAGRAM.md) section 10 (Complete Lifecycle)
2. Review event flow diagrams (sections 8-9)
3. Add console logs at key decision points
4. Use browser DevTools to inspect tool state

---

## 🔗 External Resources

### Cornerstone3D Documentation
- **CrosshairsTool:** https://www.cornerstonejs.org/docs/concepts/cornerstone-tools/tools#crosshairs-tool
- **Tool Groups:** https://www.cornerstonejs.org/docs/concepts/cornerstone-tools/tool-groups
- **Annotations:** https://www.cornerstonejs.org/docs/concepts/cornerstone-tools/annotations

### OHIF Documentation
- **Extensions:** https://docs.ohif.org/platform/extensions/
- **Tool Integration:** https://docs.ohif.org/platform/extensions/modules/toolbar
- **Services:** https://docs.ohif.org/platform/services/

---

## 📝 Summary

### Problems

1. ❌ Crosshairs don't update when viewport data changes
2. ❌ Crosshairs can't be removed after clicking the button again

### Root Causes

1. Missing event listener for `VIEWPORT_DATA_CHANGED`
2. Incorrect toggle detection in `setToolActive`
3. Wrong `disableOnPassive` check (checks old tool, not current)

### Solutions

1. ✅ Add event listener in `init.tsx` → Auto-reset crosshairs
2. ✅ Fix toggle logic in `commandsModule.ts` → Proper deactivation
3. ✅ Check correct tool's configuration → Proper state transition

### Files to Modify

- `extensions/cornerstone/src/init.tsx` (Add ~30 lines)
- `extensions/cornerstone/src/commandsModule.ts` (Replace ~35 lines)

### Impact

- ✅ Crosshairs auto-update on viewport changes
- ✅ Toggle button works correctly
- ✅ Switching tools properly removes crosshairs
- ✅ Improved user experience in MPR workflows

---

## 📞 Support

For questions or issues:
1. Review the detailed technical guide
2. Check the architecture diagrams
3. Follow the implementation guide step-by-step
4. Test using provided test scenarios

**Last Updated:** 2025-01-30  
**Documentation Version:** 1.0  
**OHIF Version:** 3.x  
**Cornerstone3D Version:** 1.x

```

Perfect! Now let me create one final summary for you:

## Summary

I've created a comprehensive technical guide on how OHIF uses Cornerstone3D for crosshairs manipulation in MPR (Multi-Planar Reconstruction) views. Here's what I've provided:

### 📚 Four Complete Documentation Files:

1. **CROSSHAIRS_GUIDE_README.md** - Quick reference and navigation guide
2. **CROSSHAIRS_TECHNICAL_GUIDE.md** - Detailed technical deep dive (8,000+ words)
3. **CROSSHAIRS_FIX_IMPLEMENTATION.md** - Ready-to-implement code fixes
4. **CROSSHAIRS_ARCHITECTURE_DIAGRAM.md** - Visual flow diagrams and architecture

### 🔍 Key Findings:

#### **Bug #1: Crosshairs Don't Update After Viewport Change**

**Root Cause:**
- No event listener connects `VIEWPORT_DATA_CHANGED` events to crosshairs updates
- When you load a new series or change viewport data, crosshairs stay at the old position

**Fix Location:** `extensions/cornerstone/src/init.tsx` (after line 281)
```typescript
// Add event listener for VIEWPORT_DATA_CHANGED
cornerstoneViewportService.subscribe(
  cornerstoneViewportService.EVENTS.VIEWPORT_DATA_CHANGED,
  ({ viewportId }) => {
    // Check if crosshairs are active
    // If so, call resetCrosshairs command
  }
)
```

#### **Bug #2: Crosshairs Cannot Be Removed After Toggling**

**Root Cause:**
- No toggle detection: clicking the same button doesn't check if tool is already active
- Wrong configuration check: code checks the old tool's `disableOnPassive` instead of the current tool's
- Tool gets deactivated then immediately reactivated

**Fix Location:** `extensions/cornerstone/src/commandsModule.ts` (lines 939-973)
```typescript
setToolActive: ({ toolName, toolGroupId }) => {
  const activeToolName = toolGroup.getActivePrimaryMouseButtonTool();
  
  // NEW: Detect toggle (same tool clicked again)
  if (activeToolName === toolName) {
    // Get the CURRENT tool's config
    const toolConfig = toolGroup.getToolConfiguration(toolName);
    
    // Deactivate properly
    if (toolConfig?.disableOnPassive) {
      toolGroup.setToolDisabled(toolName);
    }
    
    // Restore previous tool
    const prevTool = toolGroup.getPrevActivePrimaryToolName();
    if (prevTool) {
      toolGroup.setToolActive(prevTool);
    }
    
    return; // Exit early!
  }
  
  // Normal activation logic...
}
```

### 🏗️ Architecture Overview:

```
User Clicks Crosshairs Button
  ↓
CommandsManager.runCommand('setToolActiveToolbar')
  ↓
ToolGroupService.setToolActive('Crosshairs')
  ↓
Cornerstone3D ToolGroup.setToolActive()
  ↓
CrosshairsTool.onSetToolActive()
  ├─► computeToolCenter() - Calculate center position
  ├─► createAnnotations() - Create crosshair lines
  └─► addEventListeners() - Listen for mouse/camera events
  ↓
RenderingEngine.render()
  └─► Calls getReferenceLineColor(viewportId) callback
      └─► OHIF provides viewport-specific colors
  ↓
Crosshairs Rendered on Canvas/SVG
```

### 📁 Key Files:

**Configuration:**
- `modes/basic/src/initToolGroups.ts` - Where crosshairs are configured with `disableOnPassive: true`
- `modes/basic/src/toolbarButtons.ts` - Crosshairs button definition

**Implementation:**
- `extensions/cornerstone/src/commandsModule.ts` - Tool activation commands (Bug #2)
- `extensions/cornerstone/src/init.tsx` - Event listeners and initialization (Bug #1)
- `extensions/cornerstone/src/services/ToolGroupService/ToolGroupService.ts` - Tool state management
- `extensions/cornerstone/src/services/ViewportService/CornerstoneViewportService.ts` - Viewport events

All the documentation files have been created in your workspace and include:
- Detailed explanations of the rendering pipeline
- Code snippets with line numbers
- Visual diagrams of data and event flow
- Testing instructions
- Complete fix implementations ready to apply

You can start by reading **CROSSHAIRS_GUIDE_README.md** for a quick overview, then dive into the specific guides as needed!

```typescript
// Add event listener for VIEWPORT_DATA_CHANGED
cornerstoneViewportService.subscribe(
  cornerstoneViewportService.EVENTS.VIEWPORT_DATA_CHANGED,
  ({ viewportId }) => {
    // Check if crosshairs are active
    // If so, call resetCrosshairs command
  }
)
```

```typescript
setToolActive: ({ toolName, toolGroupId }) => {
  const activeToolName = toolGroup.getActivePrimaryMouseButtonTool();
  
  // NEW: Detect toggle (same tool clicked again)
  if (activeToolName === toolName) {
    // Get the CURRENT tool's config
    const toolConfig = toolGroup.getToolConfiguration(toolName);
    
    // Deactivate properly
    if (toolConfig?.disableOnPassive) {
      toolGroup.setToolDisabled(toolName);
    }
    
    // Restore previous tool
    const prevTool = toolGroup.getPrevActivePrimaryToolName();
    if (prevTool) {
      toolGroup.setToolActive(prevTool);
    }
    
    return; // Exit early!
  }
  
  // Normal activation logic...
}
```

```plaintext
User Clicks Crosshairs Button
  ↓
CommandsManager.runCommand('setToolActiveToolbar')
  ↓
ToolGroupService.setToolActive('Crosshairs')
  ↓
Cornerstone3D ToolGroup.setToolActive()
  ↓
CrosshairsTool.onSetToolActive()
  ├─► computeToolCenter() - Calculate center position
  ├─► createAnnotations() - Create crosshair lines
  └─► addEventListeners() - Listen for mouse/camera events
  ↓
RenderingEngine.render()
  └─► Calls getReferenceLineColor(viewportId) callback
      └─► OHIF provides viewport-specific colors
  ↓
Crosshairs Rendered on Canvas/SVG
```

