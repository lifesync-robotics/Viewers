# Merge Conflict Analysis: planner2d → navigation Mode

## Overview
This document simulates merging the `planner2d` mode into the `navigation` mode to combine:
- **Navigation features**: Tracking, registration panels, measurements
- **Planner2d features**: Screw management, MPR hanging protocol, Crosshairs auto-activation

---

## Current State Analysis

### Navigation Mode (Current)
```typescript
// Right Panels
rightPanels: [
  tracked.trackingPanel,           // ✅ Tracking panel
  tracked.registrationPanel,       // ✅ Registration panel
  cornerstone.segmentation,         // ✅ Segmentation panel
  tracked.measurements,             // ✅ Tracked measurements
  tracked.screwManagement          // ✅ Screw management (already present!)
]

// Hanging Protocol
hangingProtocol: undefined (uses default)

// onModeEnter
onModeEnter: basicModeInstance.onModeEnter (inherited from basic mode)
```

### Planner2d Mode (To Merge)
```typescript
// Right Panels
rightPanels: [
  tracked.screwManagement          // ✅ Screw management only
]

// Hanging Protocol
hangingProtocol: 'mpr'             // ⚠️ MPR protocol

// onModeEnter
onModeEnter: plannerOnModeEnter     // ⚠️ Custom function with Crosshairs activation
```

---

## Identified Conflicts

### 🔴 **CONFLICT #1: Right Panel Configuration**

**Location**: `src/index.ts` → `navigationInstance.props.rightPanels`

**Navigation (Current)**:
```typescript
rightPanels: [
  tracked.trackingPanel,           // Panel 1
  tracked.registrationPanel,        // Panel 2
  cornerstone.segmentation,         // Panel 3
  tracked.measurements,             // Panel 4
  tracked.screwManagement          // Panel 5
]
```

**Planner2d (To Merge)**:
```typescript
rightPanels: [
  tracked.screwManagement          // Only panel
]
```

**Conflict Type**: **ADDITIVE** - Navigation has more panels, planner2d has fewer

**Resolution Strategy**:
- **Option A (Recommended)**: Keep all navigation panels + add planner2d features
  ```typescript
  rightPanels: [
    tracked.trackingPanel,
    tracked.registrationPanel,
    tracked.screwManagement,        // Keep screw management prominent
    cornerstone.segmentation,
    tracked.measurements
  ]
  ```
- **Option B**: Make panels configurable via modeConfiguration
- **Option C**: Create separate routes for different workflows

**Impact**: 
- ✅ Low risk - panels are additive
- ⚠️ UI may become cluttered with many panels
- 💡 Consider panel ordering/priority

---

### 🔴 **CONFLICT #2: onModeEnter Lifecycle Hook**

**Location**: `src/index.ts` → `modeInstance.onModeEnter`

**Navigation (Current)**:
```typescript
onModeEnter: basicModeInstance.onModeEnter  // Inherited from basic mode
// No custom implementation
```

**Planner2d (To Merge)**:
```typescript
function plannerOnModeEnter(args) {
  const { commandsManager } = args;
  
  // Call base mode's onModeEnter first
  const baseOnModeEnter = basicModeInstance.onModeEnter;
  if (baseOnModeEnter) {
    baseOnModeEnter.call(this, args);
  }
  
  // Auto-activate Crosshairs on mpr tool group
  setTimeout(() => {
    commandsManager.runCommand('setToolActive', {
      toolName: 'Crosshairs',
      toolGroupId: 'mpr',
    });
    console.log('✅ [Planner Mode] Crosshairs tool activated on mpr tool group');
  }, 100);
}
```

**Conflict Type**: **REPLACEMENT** - Need to merge both behaviors

**Resolution Strategy**:
- **Option A (Recommended)**: Create merged function that calls both
  ```typescript
  function navigationOnModeEnter(args) {
    // First, call basic mode's onModeEnter
    const baseOnModeEnter = basicModeInstance.onModeEnter;
    if (baseOnModeEnter) {
      baseOnModeEnter.call(this, args);
    }
    
    // Then, activate Crosshairs for screw planning
    const { commandsManager } = args;
    setTimeout(() => {
      commandsManager.runCommand('setToolActive', {
        toolName: 'Crosshairs',
        toolGroupId: 'mpr',
      });
      console.log('✅ [Navigation Mode] Crosshairs tool activated on mpr tool group');
    }, 100);
  }
  ```
- **Option B**: Make Crosshairs activation conditional/configurable
- **Option C**: Use composition pattern with multiple hooks

**Impact**:
- ⚠️ Medium risk - lifecycle hooks must be carefully merged
- ✅ Both behaviors can coexist
- 💡 Consider if Crosshairs should always activate or be conditional

---

### 🟡 **CONFLICT #3: Hanging Protocol**

**Location**: `src/index.ts` → `modeInstance.hangingProtocol`

**Navigation (Current)**:
```typescript
hangingProtocol: undefined  // Uses default hanging protocol
```

**Planner2d (To Merge)**:
```typescript
hangingProtocol: 'mpr'      // Uses MPR (Multi-Planar Reconstruction) protocol
```

**Conflict Type**: **REPLACEMENT** - Different hanging protocols

**Resolution Strategy**:
- **Option A (Recommended)**: Use MPR protocol (required for screw planning)
  ```typescript
  hangingProtocol: 'mpr'
  ```
- **Option B**: Make hanging protocol configurable
- **Option C**: Use array of protocols with ranking

**Impact**:
- ⚠️ Medium risk - MPR protocol may change viewport layout
- ✅ MPR is required for proper screw planning visualization
- 💡 Verify MPR protocol exists and is compatible

**Dependencies**:
- Requires `@ohif/extension-default.hangingProtocolModule.mpr` to exist
- May require specific viewport configurations

---

### 🟢 **NO CONFLICT: Extension Dependencies**

**Location**: `src/index.ts` → `extensionDependencies`

**Navigation (Current)**:
```typescript
extensionDependencies = {
  ...basicDependencies,
  '@ohif/extension-measurement-tracking': '^3.0.0',
}
```

**Planner2d (To Merge)**:
```typescript
extensionDependencies = {
  ...basicDependencies,
  '@ohif/extension-measurement-tracking': '^3.0.0',
}
```

**Status**: ✅ **NO CONFLICT** - Both use same dependencies

**Resolution**: No changes needed

---

### 🟢 **NO CONFLICT: Tracked Object Definitions**

**Location**: `src/index.ts` → `tracked` object

**Navigation (Current)**:
```typescript
export const tracked = {
  measurements: '@ohif/extension-measurement-tracking.panelModule.trackedMeasurements',
  thumbnailList: '@ohif/extension-measurement-tracking.panelModule.seriesList',
  viewport: '@ohif/extension-measurement-tracking.viewportModule.cornerstone-tracked',
  viewportState: '@ohif/extension-cornerstone.panelModule.viewport-state',
  screwManagement: '@ohif/extension-lifesync.panelModule.screw-management',
  trackingPanel: '@ohif/extension-lifesync.panelModule.trackingPanel',
  registrationPanel: '@ohif/extension-lifesync.panelModule.registration-panel',
};
```

**Planner2d (To Merge)**:
```typescript
export const tracked = {
  screwManagement: '@ohif/extension-lifesync.panelModule.screw-management',
  viewport: '@ohif/extension-measurement-tracking.viewportModule.cornerstone-tracked',
  thumbnailList: '@ohif/extension-measurement-tracking.panelModule.seriesList',
  measurements: '@ohif/extension-measurement-tracking.panelModule.trackedMeasurements',
  viewportState: '@ohif/extension-cornerstone.panelModule.viewport-state',
};
```

**Status**: ✅ **NO CONFLICT** - Navigation has all planner2d definitions + more

**Resolution**: Keep navigation's tracked object (it's a superset)

---

### 🟡 **POTENTIAL CONFLICT #4: Import Statement**

**Location**: `src/index.ts` → Top of file

**Navigation (Current)**:
```typescript
import i18n from 'i18next';
import { id } from './id';
import { initToolGroups, toolbarButtons, cornerstone,
  ohif,
  dicomsr,
  dicomvideo,
  basicLayout,
  basicRoute,
  extensionDependencies as basicDependencies,
  mode as basicMode,
  modeInstance as basicModeInstance,
} from '@ohif/mode-basic';
```

**Planner2d (To Merge)**:
```typescript
import i18n from 'i18next';
import { id } from './id';
import { initToolGroups, toolbarButtons, cornerstone,
  ohif,
  dicomsr,
  dicomvideo,
  basicLayout,
  basicRoute,
  extensionDependencies as basicDependencies,
  mode as basicMode,
  modeInstance as basicModeInstance,
} from '@ohif/mode-basic';
import { HangingProtocol } from 'platform/core/src/types';  // ⚠️ Additional import
```

**Conflict Type**: **ADDITIVE** - Planner2d has extra import

**Resolution Strategy**:
- **Option A**: Add the import if needed for type checking
- **Option B**: Remove if not actually used (check usage)
- **Option C**: Keep for future type safety

**Impact**:
- ✅ Low risk - import is optional
- ⚠️ May cause build issues if path is incorrect
- 💡 Verify import path is correct

---

### 🟡 **POTENTIAL CONFLICT #5: Left Panel Configuration**

**Location**: `src/index.ts` → `navigationInstance.props.leftPanels`

**Navigation (Current)**:
```typescript
leftPanels: [tracked.thumbnailList]
// leftPanelClosed: not specified (defaults to false)
```

**Planner2d (To Merge)**:
```typescript
leftPanels: [tracked.thumbnailList]
leftPanelClosed: false  // Explicitly set
```

**Status**: ✅ **NO CONFLICT** - Same configuration, planner2d is explicit

**Resolution**: No changes needed (navigation already has same config)

---

### 🟡 **POTENTIAL CONFLICT #6: Viewport Configuration**

**Location**: `src/index.ts` → `navigationInstance.props.viewports`

**Navigation (Current)**:
```typescript
viewports: [
  {
    namespace: tracked.viewport,
    displaySetsToDisplay: basicLayout.props.viewports[0].displaySetsToDisplay,
  },
  ...basicLayout.props.viewports,
]
```

**Planner2d (To Merge)**:
```typescript
viewports: [
  {
    namespace: tracked.viewport,
    displaySetsToDisplay: basicLayout.props.viewports[0].displaySetsToDisplay,
  },
  ...basicLayout.props.viewports,
]
```

**Status**: ✅ **NO CONFLICT** - Identical configuration

**Resolution**: No changes needed

---

## Summary of Conflicts

| # | Conflict | Type | Severity | Resolution Complexity |
|---|----------|------|----------|----------------------|
| 1 | Right Panel Configuration | Additive | 🟡 Medium | Low |
| 2 | onModeEnter Hook | Replacement | 🔴 High | Medium |
| 3 | Hanging Protocol | Replacement | 🟡 Medium | Low |
| 4 | Import Statement | Additive | 🟢 Low | Low |
| 5 | Left Panel Config | None | ✅ None | None |
| 6 | Viewport Config | None | ✅ None | None |

---

## Recommended Merge Strategy

### Phase 1: Low-Risk Changes
1. ✅ Add `HangingProtocol` import (if needed)
2. ✅ Set `hangingProtocol: 'mpr'`
3. ✅ Verify all tracked object properties are present

### Phase 2: Medium-Risk Changes
1. ⚠️ Merge `onModeEnter` hooks:
   - Call basic mode's `onModeEnter` first
   - Add Crosshairs activation with timeout
   - Add proper error handling

### Phase 3: UI Configuration
1. ⚠️ Configure right panels:
   - Keep all navigation panels
   - Ensure screwManagement is accessible
   - Consider panel ordering for UX

### Phase 4: Testing
1. ✅ Test mode entry and Crosshairs activation
2. ✅ Test screw management functionality
3. ✅ Test tracking features
4. ✅ Test MPR hanging protocol
5. ✅ Verify all panels load correctly

---

## Expected Final Configuration

```typescript
// Merged navigation mode with planner2d features
export const navigationInstance = {
  ...basicLayout,
  id: ohif.layout,
  props: {
    ...basicLayout.props,
    leftPanels: [tracked.thumbnailList],
    leftPanelClosed: false,
    rightPanels: [
      tracked.trackingPanel,
      tracked.registrationPanel,
      tracked.screwManagement,      // Screw planning feature
      cornerstone.segmentation,
      tracked.measurements,
    ],
    rightPanelClosed: false,
    viewports: [
      {
        namespace: tracked.viewport,
        displaySetsToDisplay: basicLayout.props.viewports[0].displaySetsToDisplay,
      },
      ...basicLayout.props.viewports,
    ],
  },
};

export const modeInstance = {
  ...basicModeInstance,
  id,
  routeName: 'navigation',
  displayName: i18n.t('Modes:Navigation'),
  routes: [navigationRoute],
  hangingProtocol: 'mpr',                    // From planner2d
  extensions: extensionDependencies,
  onModeEnter: navigationOnModeEnter,        // Merged function
};

function navigationOnModeEnter(args) {
  // Call basic mode's onModeEnter
  const baseOnModeEnter = basicModeInstance.onModeEnter;
  if (baseOnModeEnter) {
    baseOnModeEnter.call(this, args);
  }
  
  // Activate Crosshairs for screw planning
  const { commandsManager } = args;
  setTimeout(() => {
    commandsManager.runCommand('setToolActive', {
      toolName: 'Crosshairs',
      toolGroupId: 'mpr',
    });
    console.log('✅ [Navigation Mode] Crosshairs tool activated on mpr tool group');
  }, 100);
}
```

---

## Risk Assessment

### High Risk Areas
1. **onModeEnter merge** - Must ensure both behaviors execute correctly
2. **MPR hanging protocol** - May affect viewport layout and tool groups

### Medium Risk Areas
1. **Panel ordering** - Too many panels may clutter UI
2. **Crosshairs activation timing** - setTimeout may need adjustment

### Low Risk Areas
1. **Extension dependencies** - Already compatible
2. **Viewport configuration** - No changes needed
3. **Import statements** - Simple addition

---

## Testing Checklist

After merge, verify:

- [ ] Mode loads without errors
- [ ] All panels are accessible
- [ ] Screw management panel works
- [ ] Tracking features work
- [ ] Registration panel works
- [ ] Crosshairs tool activates automatically
- [ ] MPR hanging protocol loads correctly
- [ ] Measurements can be tracked
- [ ] Screw placement works with crosshairs
- [ ] No console errors
- [ ] Mode exit cleans up properly

---

## Notes

1. **Screw Management**: Already present in navigation mode, so this is primarily about ensuring it works with MPR protocol and Crosshairs
2. **Crosshairs Dependency**: Screw planning requires Crosshairs tool to be active for position detection
3. **MPR Protocol**: Required for proper 3D visualization of screws
4. **Panel Priority**: Consider making panels collapsible or using tabs if UI becomes cluttered

---

**Generated**: $(date)
**Mode**: Navigation (with planner2d features)
**Status**: Ready for merge implementation

