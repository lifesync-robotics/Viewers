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





