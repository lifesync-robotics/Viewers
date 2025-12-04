# Defensive Programming Implementation - Planner Mode

## Overview

This document describes the comprehensive defensive programming patterns implemented in the Planner mode to handle viewport initialization issues gracefully, specifically addressing the "not iterable" and `computeViewport()` errors that occur when tools try to access viewports before they're fully initialized.

## Implementation Date
December 4, 2025

## Problem Statement

The orientation marker tool was encountering errors when trying to call `computeViewport()` before viewports were fully ready:

```javascript
// ❌ ERROR: computeViewport() returns null or iterator error
const viewport = renderingEngine.getViewport(viewportId);
const viewportData = viewport.computeViewport(); // Not iterable!
```

This happens because:
- Viewport is created but not fully initialized
- Camera, actors, or rendering pipeline aren't ready yet
- `computeViewport()` may return `null` or invalid data

## Solution Architecture

### 1. OrientationMarkerRenderer Utility Class
**Location:** `Viewers/modes/planner/src/utils/OrientationMarkerRenderer.ts`

A reusable utility class that implements all defensive programming patterns for managing orientation markers safely.

#### Key Features:

**Pattern 1: Viewport Status Checking**
```typescript
enum ViewportReadiness {
  NOT_READY = 'NOT_READY',
  INITIALIZING = 'INITIALIZING',
  READY = 'READY',
  ERROR = 'ERROR',
  DESTROYED = 'DESTROYED'
}
```

**Pattern 2: Safe Viewport Access**
```typescript
private getViewportSafely(): Types.IViewport | null {
  try {
    const renderingEngine = getRenderingEngine(this.renderingEngineId);
    
    // Guard: Check rendering engine exists
    if (!renderingEngine) {
      console.debug('Rendering engine not found');
      return null;
    }

    const viewport = renderingEngine.getViewport(this.viewportId);
    
    // Guard: Check viewport exists
    if (!viewport) {
      console.debug('Viewport not found');
      return null;
    }

    return viewport;
  } catch (error) {
    console.warn('Error getting viewport:', error);
    return null;
  }
}
```

**Pattern 3: Comprehensive Readiness Checks**
```typescript
private isViewportReady(): boolean {
  const viewport = this.getViewportSafely();
  
  if (!viewport) return false;

  try {
    // Check element attached
    if (!viewport.element) return false;
    
    // Check canvas exists
    if (!viewport.canvas) return false;
    
    // Check camera data (critical for orientation markers)
    const camera = viewport.getCamera?.();
    if (!camera) return false;
    
    // Check for image data
    if ('hasImageData' in viewport && typeof viewport.hasImageData === 'function') {
      if (!viewport.hasImageData()) return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}
```

**Pattern 4: Event-Driven Initialization**
```typescript
private waitForViewportReady(timeoutMs: number = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    // Listen for ELEMENT_ENABLED and IMAGE_RENDERED events
    element.addEventListener(Enums.Events.ELEMENT_ENABLED, handleElementEnabled);
    element.addEventListener(Enums.Events.IMAGE_RENDERED, handleImageRendered);
    
    // With timeout fallback
    setTimeout(() => {
      if (!resolved) {
        cleanup();
        resolve(false);
      }
    }, timeoutMs);
  });
}
```

**Pattern 5: Guard Clauses for Rendering**
```typescript
canRender(): boolean {
  // Guard: Check initialization state
  if (this.readiness !== ViewportReadiness.READY) {
    return false;
  }

  // Guard: Check viewport is still valid
  if (!this.isViewportReady()) {
    this.readiness = ViewportReadiness.ERROR;
    return false;
  }

  return true;
}
```

### 2. Planner Mode Implementation
**Location:** `Viewers/modes/planner/src/index.ts`

#### Defensive Patterns Applied:

**Pattern 1: Safe Base Mode Initialization**
```typescript
try {
  baseOnModeEnter.call(this, args);
  console.log('✅ Base mode initialization complete');
} catch (error) {
  console.error('❌ Error in base mode initialization:', error);
  // Continue anyway - don't let base mode errors prevent planner mode
}
```

**Pattern 2: Safe Tool Names Extraction**
```typescript
let toolNames;
try {
  const utilityModule = extensionManager.getModuleEntry(
    '@ohif/extension-cornerstone.utilityModule.tools'
  );
  
  if (!utilityModule?.exports?.toolNames) {
    throw new Error('Tool names not available in utility module');
  }
  
  toolNames = utilityModule.exports.toolNames;
} catch (error) {
  console.error('❌ Failed to get tool names:', error);
  return; // Cannot proceed without tool names
}
```

**Pattern 3: Individual Tool Group Error Handling**
```typescript
const successfulToolGroups = new Set<string>();
toolGroupIds.forEach(toolGroupId => {
  try {
    if (!toolGroupService?.addToolsToToolGroup) {
      console.warn('Tool group service not available');
      return;
    }

    toolGroupService.addToolsToToolGroup(toolGroupId, orientationMarkerConfig);
    successfulToolGroups.add(toolGroupId);
  } catch (error) {
    console.warn(`Failed to add OrientationMarker to ${toolGroupId}:`, error);
    // Continue with other tool groups
  }
});
```

**Pattern 4: Using OrientationMarkerRenderer**
```typescript
const enableOrientationMarkersWithDefensiveChecks = async () => {
  // Multiple guard clauses
  if (!cornerstoneViewportService) return;
  
  const renderingEngine = cornerstoneViewportService.getRenderingEngine();
  if (!renderingEngine) return;
  
  const viewports = renderingEngine.getViewports();
  if (!viewports || viewports.length === 0) return;

  // Use defensive renderer
  const renderers = await initializeOrientationMarkers(
    renderingEngineId,
    viewportIds,
    toolNames.OrientationMarker,
    configuration
  );

  // Only activate tools for successfully initialized viewports
  const readyViewports = Array.from(renderers.entries())
    .filter(([_, renderer]) => renderer.isReady())
    .map(([viewportId, _]) => viewportId);
};
```

**Pattern 5: Tool Activation with Error Handling**
```typescript
Array.from(successfulToolGroups).forEach(toolGroupId => {
  try {
    if (!commandsManager?.runCommand) {
      console.warn('Commands manager not available');
      return;
    }

    commandsManager.runCommand('setToolActive', {
      toolGroupId,
      toolName: toolNames.OrientationMarker,
    });
    activatedToolGroups.add(toolGroupId);
  } catch (error) {
    console.warn(`Error activating OrientationMarker for ${toolGroupId}:`, error.message);
    // Continue with other tool groups
  }
});
```

**Pattern 6: Event Subscription with Timeout**
```typescript
const { unsubscribe } = viewportGridService.subscribe(
  viewportGridService.EVENTS.VIEWPORTS_READY,
  () => {
    // Use setTimeout to ensure event processing completes
    setTimeout(() => {
      enableOrientationMarkersWithDefensiveChecks()
        .catch(error => {
          console.error('Unhandled error:', error);
        });
    }, 100);
    
    // Unsubscribe after first event
    try {
      unsubscribe();
    } catch (error) {
      console.warn('Error unsubscribing:', error);
    }
  }
);
```

**Pattern 7: Comprehensive Cleanup**
```typescript
function plannerOnModeExit(args) {
  // Clean up orientation marker renderers
  try {
    if (this._orientationMarkerRenderers) {
      cleanupOrientationMarkers(this._orientationMarkerRenderers);
      this._orientationMarkerRenderers = null;
    }
  } catch (error) {
    console.warn('Error cleaning up renderers:', error);
  }

  // Clean up viewport subscription
  try {
    if (this._orientationMarkerSubscription) {
      this._orientationMarkerSubscription();
      this._orientationMarkerSubscription = null;
    }
  } catch (error) {
    console.warn('Error cleaning up subscription:', error);
  }

  // Call base mode exit
  try {
    const baseOnModeExit = basicModeInstance.onModeExit;
    if (baseOnModeExit) {
      baseOnModeExit.call(this, args);
    }
  } catch (error) {
    console.error('Error in base mode cleanup:', error);
  }
}
```

### 3. Tool Group Initialization (initToolGroups.ts)
**Location:** `Viewers/modes/basic/src/initToolGroups.ts`

#### Defensive Patterns Applied:

**Pattern 1: Input Validation**
```typescript
function initDefaultToolGroup(extensionManager, toolGroupService, commandsManager, toolGroupId) {
  if (!extensionManager || !toolGroupService || !commandsManager || !toolGroupId) {
    console.error('Missing required parameters');
    return false;
  }
  // ...
}
```

**Pattern 2: Module Existence Checks**
```typescript
const utilityModule = extensionManager.getModuleEntry(
  '@ohif/extension-cornerstone.utilityModule.tools'
);

if (!utilityModule?.exports) {
  console.error('Cornerstone utility module not found');
  return false;
}

const { toolNames, Enums } = utilityModule.exports;

if (!toolNames || !Enums) {
  console.error('Tool names or Enums not available');
  return false;
}
```

**Pattern 3: Safe Command Execution**
```typescript
let updatedTools = tools;
try {
  if (commandsManager?.run) {
    updatedTools = commandsManager.run('initializeSegmentLabelTool', { tools });
  }
} catch (error) {
  console.warn('Error running initializeSegmentLabelTool command:', error);
  // Continue with original tools if command fails
}
```

**Pattern 4: Safe Tool Group Creation**
```typescript
if (!toolGroupService?.createToolGroupAndAddTools) {
  console.error('createToolGroupAndAddTools method not available');
  return false;
}

toolGroupService.createToolGroupAndAddTools(toolGroupId, updatedTools);
return true;
```

**Pattern 5: Comprehensive Error Tracking**
```typescript
function initToolGroups(extensionManager, toolGroupService, commandsManager) {
  const results = {
    success: true,
    initialized: [],
    failed: [],
  };

  try {
    if (initDefaultToolGroup(...)) {
      results.initialized.push('default');
    } else {
      results.failed.push('default');
      results.success = false;
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    results.failed.push('default');
    results.success = false;
  }

  // ... repeat for all tool groups

  console.log('Initialization complete:');
  console.log(`✅ Successful: ${results.initialized.join(', ')}`);
  console.log(`❌ Failed: ${results.failed.join(', ')}`);

  return results;
}
```

**Pattern 6: Safe Callback Functions**
```typescript
getReferenceLineColor: viewportId => {
  try {
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
  } catch (error) {
    console.warn('Error getting reference line color:', error);
    return '#0c0';
  }
}
```

## Benefits of This Implementation

### 1. **Graceful Degradation**
- Application continues to work even if some viewports fail to initialize
- Tools are only activated on successfully initialized viewports
- Non-critical tools don't prevent mode initialization

### 2. **Comprehensive Logging**
- Clear console messages for debugging
- Success/failure tracking for each component
- Detailed error information without stack traces cluttering logs

### 3. **Resource Management**
- Proper cleanup of event listeners
- No memory leaks from orphaned subscriptions
- Graceful handling of destroyed viewports

### 4. **Maintainability**
- Clear separation of concerns
- Reusable OrientationMarkerRenderer utility
- Consistent error handling patterns across all functions

### 5. **Testability**
- Return values indicate success/failure
- State tracking allows for inspection
- Isolated functions for unit testing

## Console Output Examples

### Successful Initialization
```
✅ [Planner Mode] Base mode initialization complete
✅ [Planner Mode] Tool names loaded: WindowLevel, Pan, Zoom, ...
✅ [Planner Mode] OrientationMarker added to default
✅ [Planner Mode] OrientationMarker added to mpr
✅ [Planner Mode] OrientationMarker added to SRToolGroup
📋 [Planner Mode] Viewports ready, waiting for render...
🔒 [Planner Mode] Starting defensive orientation marker initialization...
📋 [Planner Mode] Using rendering engine: cornerstone-rendering-engine
📡 [Planner Mode] Found 3 viewports, initializing with defensive patterns...
[OrientationMarker] Initializing for viewport viewport-1...
✅ [OrientationMarker] Viewport viewport-1 is already ready
✅ [OrientationMarker] Successfully initialized for viewport-1
✅ [Planner Mode] 3/3 viewports ready for tool activation
✅ [Planner Mode] OrientationMarker activated for default
✅ [Planner Mode] OrientationMarker activated for mpr
✅ [Planner Mode] Crosshairs tool activated
🎉 [Planner Mode] Tool activation complete
   - Orientation markers: 3/3 tool groups
   - Ready viewports: 3/3
```

### Partial Failure (Still Works)
```
✅ [Planner Mode] Base mode initialization complete
✅ [Planner Mode] Tool names loaded
✅ [Planner Mode] OrientationMarker added to default
⚠️ [Planner Mode] Failed to add OrientationMarker to mpr: Tool group not found
✅ [Planner Mode] OrientationMarker added to SRToolGroup
📋 [Planner Mode] Viewports ready, waiting for render...
⏳ [OrientationMarker] Waiting for viewport viewport-1 to be ready...
✅ [OrientationMarker] Viewport viewport-1 ready via IMAGE_RENDERED
⚠️ [OrientationMarker] Viewport viewport-2 failed to become ready
✅ [Planner Mode] 2/3 viewports ready for tool activation
✅ [Planner Mode] OrientationMarker activated for default
⚠️ [Planner Mode] Error activating OrientationMarker for mpr: Tool group not found
🎉 [Planner Mode] Tool activation complete
   - Orientation markers: 2/3 tool groups
   - Ready viewports: 2/3
```

## Testing Recommendations

### 1. Normal Operation
- Load a multi-viewport study
- Verify orientation markers appear in all viewports
- Check console for successful initialization messages

### 2. Slow Network
- Throttle network to simulate slow image loading
- Verify tools wait for viewports to be ready
- Check that timeout handling works (5-second default)

### 3. Missing Extensions
- Temporarily remove an extension
- Verify graceful degradation
- Check that mode still loads with reduced functionality

### 4. Rapid Mode Switching
- Quickly switch between modes
- Verify cleanup happens properly
- Check for memory leaks or orphaned listeners

### 5. Viewport Destruction
- Close viewports while tools are initializing
- Verify no errors occur
- Check that cleanup handles destroyed viewports

## Future Enhancements

1. **Retry Logic**: Add automatic retry for failed viewport initializations
2. **Performance Metrics**: Track initialization timing
3. **Health Checks**: Periodic verification that viewports remain ready
4. **Adaptive Timeouts**: Adjust timeouts based on system performance
5. **User Notifications**: Optional UI feedback for initialization issues

## Related Files

- `Viewers/modes/planner/src/index.ts` - Mode implementation
- `Viewers/modes/planner/src/utils/OrientationMarkerRenderer.ts` - Utility class
- `Viewers/modes/basic/src/initToolGroups.ts` - Tool group initialization
- `ORIENTATION_MARKER_FIX_EXPLANATION.md` - Background information
- `ORIENTATION_MARKER_IMPLEMENTATION.md` - Previous implementation notes

## Key Takeaways

| Strategy | Implementation | Benefit |
|----------|---------------|---------|
| **Viewport Status Check** | `isViewportReady()` | Prevents premature access |
| **Event Listeners** | `waitForViewportReady()` | Responds to actual readiness |
| **Try-Catch Blocks** | All critical operations | Prevents app crashes |
| **Guard Clauses** | Early returns on null checks | Cleaner code flow |
| **Return Values** | Boolean success indicators | Enables error tracking |
| **Optional Chaining** | `viewport?.element` | Safe property access |
| **Nullish Coalescing** | `value ?? default` | Safe defaults |
| **Promise Timeouts** | 5-second fallbacks | Prevents infinite waits |
| **Comprehensive Logging** | Emoji-prefixed messages | Easy debugging |
| **Cleanup Tracking** | State management | No resource leaks |

## Conclusion

This defensive programming implementation ensures that the Planner mode handles viewport initialization gracefully, prevents crashes from premature tool access, provides excellent debugging information, and maintains clean resource management throughout the viewport lifecycle.

The patterns implemented here follow OHIF and Cornerstone3D best practices and can be adapted to other modes and tools as needed.

