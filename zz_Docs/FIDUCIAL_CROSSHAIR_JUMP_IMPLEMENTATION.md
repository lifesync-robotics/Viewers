# Fiducial Crosshair Jump Feature

## 📋 Overview

This feature enables the crosshairs to automatically move to a fiducial marker's position when the user clicks on that fiducial in the measurement table. This provides seamless navigation to fiducial markers in MPR views.

---

## ✨ Feature Description

**What it does:**
- When a user clicks/highlights a fiducial marker in the measurement table
- The crosshairs automatically move to that fiducial's exact 3D world position
- All linked MPR viewports (axial, sagittal, coronal) update to show the fiducial location

**User Workflow:**
1. User creates fiducial markers using the FiducialMarker tool
2. Fiducials appear in the measurement panel/table
3. User clicks on a fiducial row in the measurement table
4. **✨ NEW:** Crosshairs immediately jump to that fiducial's position
5. All viewports update to center on the fiducial location

---

## 🔧 Implementation

### Modified File

**File:** `extensions/cornerstone/src/commandsModule.ts`

**Location:** Lines 156-200 in the `jumpToMeasurementViewport` action

### Key Changes (v2 - Fixed)

The implementation was moved to the **beginning** of `jumpToMeasurementViewport` to handle FiducialMarker as a special case that returns early, avoiding viewport reference errors.

### Code Changes

Added FiducialMarker special handling at the **start** of `jumpToMeasurementViewport` to avoid viewport reference errors:

```typescript
// Special handling for FiducialMarker - jump directly to position
if (measurement.toolName === 'FiducialMarker') {
  console.log('🎯 FiducialMarker clicked - Jumping to fiducial position');
  
  // Get the fiducial's world position
  const annotation = cornerstoneTools.annotation.state.getAnnotation(annotationUID);
  if (annotation?.data?.handles?.points?.[0]) {
    const fiducialWorldPosition = annotation.data.handles.points[0];
    console.log('📍 Fiducial world position:', fiducialWorldPosition);
    
    // Move all viewports' cameras to the fiducial position
    const viewportIds = viewportGridService.getState().viewports.map(vp => vp.viewportId);
    viewportIds.forEach(vpId => {
      const viewport = cornerstoneViewportService.getCornerstoneViewport(vpId);
      if (viewport) {
        const camera = viewport.getCamera();
        const { position: cameraPosition, focalPoint: cameraFocalPoint } = camera;
        
        // Calculate new camera position maintaining the same viewing direction
        const viewDirection = vec3.sub(vec3.create(), cameraPosition, cameraFocalPoint);
        const newPosition = vec3.add(vec3.create(), fiducialWorldPosition, viewDirection);
        
        viewport.setCamera({ 
          focalPoint: fiducialWorldPosition, 
          position: newPosition as any 
        });
        viewport.render();
      }
    });
    
    // Move crosshairs to fiducial position
    const toolGroupIds = toolGroupService.getToolGroupIds();
    toolGroupIds.forEach(toolGroupId => {
      const toolGroup = toolGroupService.getToolGroup(toolGroupId);
      const crosshairInstance = toolGroup?.getToolInstance?.('Crosshairs');
      
      if (crosshairInstance && typeof crosshairInstance.setToolCenter === 'function') {
        console.log(`🎯 Moving crosshairs in tool group ${toolGroupId} to fiducial position`);
        crosshairInstance.setToolCenter(fiducialWorldPosition, false);
      }
    });
  } else {
    console.warn('⚠️ Could not find fiducial position in annotation data');
  }
  return; // Exit early for fiducials
}
```

---

## 🎯 How It Works

### Flow Diagram

```
User clicks fiducial in measurement table
           ↓
MeasurementTable fires "jumpToMeasurement" action
           ↓
measurementService broadcasts JUMP_TO_MEASUREMENT event
           ↓
jumpToMeasurementViewport command is called
           ↓
Command moves viewport camera to measurement
           ↓
✨ NEW: Command checks if measurement.toolName === 'FiducialMarker'
           ↓
If yes → Get annotation from annotation state
           ↓
Extract world position: annotation.data.handles.points[0]
           ↓
Get all tool groups from toolGroupService
           ↓
For each tool group:
  - Get Crosshairs tool instance
  - Call crosshairInstance.setToolCenter(fiducialWorldPosition)
           ↓
Crosshairs move to fiducial position
           ↓
All MPR viewports update to show fiducial location
```

### Key Components

1. **Measurement Table**
   - File: `platform/ui-next/src/components/MeasurementTable/MeasurementTable.tsx`
   - Triggers: `onAction(e, 'jumpToMeasurement', uid)` when row is selected

2. **MeasurementService**
   - File: `platform/core/src/services/MeasurementService/MeasurementService.ts`
   - Method: `jumpToMeasurement(viewportId, measurementUID)`
   - Broadcasts: `EVENTS.JUMP_TO_MEASUREMENT`

3. **Event Listener**
   - File: `extensions/cornerstone/src/init.tsx` (lines 199-203)
   - Subscribes to `JUMP_TO_MEASUREMENT` event
   - Runs: `jumpToMeasurementViewport` command

4. **Command Implementation** ✨ NEW
   - File: `extensions/cornerstone/src/commandsModule.ts`
   - Action: `jumpToMeasurementViewport`
   - Enhancement: Moves crosshairs for FiducialMarker measurements

---

## 🧪 Testing

### Prerequisites
- Load a study in MPR mode (e.g., CT scan)
- Enable Crosshairs tool from toolbar
- Create 2-3 fiducial markers in different locations

### Test Steps

1. **Test Basic Jump:**
   ```
   - Click on fiducial #1 in measurement table
   - ✅ Crosshairs should move to fiducial #1 position
   - ✅ All MPR views should center on fiducial #1
   ```

2. **Test Multiple Fiducials:**
   ```
   - Click on fiducial #2 in measurement table
   - ✅ Crosshairs should move to fiducial #2
   - Click on fiducial #3
   - ✅ Crosshairs should move to fiducial #3
   ```

3. **Test Console Logging:**
   ```
   - Open browser console
   - Click on a fiducial
   - ✅ Should see: "🎯 FiducialMarker clicked - Moving crosshairs to fiducial position"
   - ✅ Should see: "📍 Fiducial world position: [x, y, z]"
   - ✅ Should see: "🎯 Moving crosshairs in tool group [id] to fiducial position"
   ```

4. **Test Without Crosshairs Active:**
   ```
   - Disable crosshairs tool
   - Click on fiducial in measurement table
   - ✅ Should still navigate to fiducial (camera moves)
   - ✅ No errors in console
   ```

5. **Test With Other Measurements:**
   ```
   - Create a Length measurement
   - Click on Length in measurement table
   - ✅ Should jump to Length measurement normally
   - ✅ No crosshair movement (only fiducials trigger crosshair movement)
   ```

---

## 🔍 Debugging

### Console Logs

The implementation includes helpful console logs for debugging:

| Log Message | Meaning |
|------------|---------|
| `🎯 FiducialMarker clicked - Moving crosshairs to fiducial position` | A fiducial was clicked and the system is processing it |
| `📍 Fiducial world position: [x, y, z]` | The 3D world coordinates of the fiducial |
| `🎯 Moving crosshairs in tool group [id] to fiducial position` | Crosshairs in a specific tool group are being moved |
| `⚠️ Crosshairs tool does not have setToolCenter method` | The crosshairs tool instance doesn't support this method |
| `⚠️ Could not find fiducial position in annotation data` | The annotation data structure is unexpected |

### Troubleshooting

**Problem:** "Unable to apply reference viewable Object" error when clicking fiducial

**Solution:** ✅ FIXED in v2
- The implementation now handles FiducialMarker as a special case BEFORE trying to apply viewport references
- FiducialMarker navigation returns early, avoiding the viewport reference code path

**Problem:** Crosshairs don't move when clicking fiducial

**Possible Causes:**
1. Crosshairs tool is not active/enabled
   - Solution: Enable crosshairs from toolbar first

2. `setToolCenter` method doesn't exist on crosshairs tool
   - Check console for warning: "⚠️ Crosshairs tool does not have setToolCenter method"
   - Solution: This is a Cornerstone3D API issue - check Cornerstone3D version

3. Annotation not found in annotation state
   - Check console for warning: "⚠️ Could not find fiducial position in annotation data"
   - Solution: Verify fiducial was created properly and annotation UID is correct

**Problem:** Crosshairs move but to wrong position

**Possible Causes:**
1. Fiducial world coordinates are incorrect
   - Check console log: "📍 Fiducial world position: [x, y, z]"
   - Verify coordinates are in world space (not canvas/image space)

2. Coordinate system mismatch
   - Verify that fiducial uses same coordinate system as crosshairs

---

## 📚 Related Files

### Core Implementation
- `extensions/cornerstone/src/commandsModule.ts` - Main implementation
- `extensions/cornerstone/src/tools/FiducialMarkerTool.ts` - Fiducial tool definition

### Measurement System
- `platform/core/src/services/MeasurementService/MeasurementService.ts` - Service that manages measurements
- `platform/ui-next/src/components/MeasurementTable/MeasurementTable.tsx` - UI component
- `extensions/cornerstone/src/initMeasurementService.ts` - Measurement service setup

### Crosshairs System
- Crosshairs tool is from `@cornerstonejs/tools` package
- `extensions/cornerstone/src/initCornerstoneTools.js` - Crosshairs tool registration
- Documentation: `CROSSHAIRS_TECHNICAL_GUIDE.md`, `CROSSHAIR_TOOL_CENTER_LOGGING_GUIDE.md`

---

## 🚀 Future Enhancements

1. **Animation**
   - Add smooth animation when crosshairs move to fiducial
   - Could use easing function for natural motion

2. **Visual Feedback**
   - Highlight the target fiducial briefly when jumped to
   - Add ripple effect or glow around fiducial

3. **Settings**
   - Add user preference to enable/disable auto-crosshair movement
   - Allow configuration of which measurement types trigger crosshair movement

4. **Multi-Viewport Support**
   - Optimize for different hanging protocols
   - Handle single viewport vs MPR layouts differently

---

## 📝 Notes

- This feature only affects FiducialMarker measurements
- Other measurement types (Length, Angle, etc.) are not affected
- Crosshairs must be active/enabled for the movement to work
- The implementation is backwards compatible - works whether crosshairs are on or off
- Console logs are included for debugging and can be removed in production if desired

---

## ✅ Status

**Implementation Status:** ✅ Complete

**Testing Status:** ⏳ Pending user testing

**Known Issues:** None

---

Last Updated: 2025-11-07
