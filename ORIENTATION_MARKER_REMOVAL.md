# OrientationMarker 3D Toolbar Bug - Complete Eradication

## Issue Description

A major bug was causing the application to crash when:
1. Entering a mode from the case page (occasionally)
2. Moving from one stage to navigation stage (always)

**Error Message:**
```
TypeError: Cannot read properties of undefined (reading 'componentProps')
at ToolbarService.handleEvaluateNested
```

**Root Cause:**
The OrientationMarker 3D toolbar button was being added to the toolbar before:
- The volume was loaded
- VTK.js was ready
- The rendering engine was initialized

This caused the toolbar service to fail when trying to evaluate the button's state, as it couldn't access the necessary viewport/volume properties.

## Solution Implemented

**Complete removal of all OrientationMarker 3D references from all workflow modes.**

### Files Modified

#### 1. Navigation Mode (`Viewers/modes/navigation/`)
- **Modified:** `src/index.ts`
  - Removed `addOrientationMarkerWhenReady()` function
  - Removed toolbar button registration code
  - Removed MoreTools section update with OrientationMarker
  - Removed import of `navigationToolbarButtons`
  - Updated comments to reflect removal
  
- **Deleted:** `src/toolbarButtons.ts`
  - Entire file deleted (contained only OrientationMarker button definition)

#### 2. Planner Mode (`Viewers/modes/planner/`)
- **Modified:** `src/index.ts`
  - Removed `addOrientationMarkerWhenReady()` function
  - Removed toolbar button registration for OrientationMarker
  - Removed MoreTools section update with OrientationMarker
  - Removed import of `plannerToolbarButtons`
  - Updated comments to reflect removal
  
- **Deleted:** `src/toolbarButtons.ts`
  - Entire file deleted (contained OrientationMarker button and ToggleVolumeVisibility)
  - Note: ToggleVolumeVisibility is still added programmatically in index.ts

- **Deleted:** `src/commands.ts`
  - Unused commands file for OrientationMarker toggle functionality

- **Deleted:** `src/utils/OrientationMarkerRenderer.ts`
  - Unused utility class for rendering orientation markers

#### 3. Navigation-3D Mode (`Viewers/modes/navigation-3d/`)
- **Modified:** `src/index.ts`
  - Removed `addOrientationMarkerWhenReady()` function
  - Removed toolbar button registration code
  - Removed MoreTools section update with OrientationMarker
  - Removed import of `navigationToolbarButtons`
  - Removed combined toolbar buttons export
  - Updated comments to reflect removal
  
- **Deleted:** `src/toolbarButtons.ts`
  - Entire file deleted (contained only OrientationMarker button definition)

### Files NOT Modified

#### TMTV Mode (`Viewers/modes/tmtv/`)
- **NOT MODIFIED:** `src/initToolGroups.js`
  - Still contains OrientationMarker in enabled tools
  - **Reason:** TMTV is a PET/CT fusion mode not part of the surgical workflow
  - **Status:** Left as-is since it's not affected by the workflow navigation bug

## Verification

### Grep Results After Changes

**Navigation Mode:**
- Only 1 reference remaining: Comment explaining removal
- No functional code references

**Planner Mode:**
- Only references in `.md` documentation files (historical records)
- No functional code references

**Navigation-3D Mode:**
- No references found
- Completely clean

### Linter Status
✅ No linter errors in any modified files

## Impact Assessment

### What Was Removed
1. OrientationMarker 3D toolbar buttons from all workflow modes
2. All code that attempted to add OrientationMarker tools to tool groups
3. All toolbar section updates that included OrientationMarker
4. All utility files and commands related to OrientationMarker

### What Still Works
1. All other toolbar buttons remain functional
2. Volume rendering toggle (ToggleVolumeVisibility) still works in planner/navigation-3d
3. Crosshairs tool activation still works
4. All viewport functionality remains intact
5. Workflow navigation between stages

### What Users Will Notice
- The orientation marker 3D button is no longer available in the toolbar
- No more crashes when navigating between workflow stages
- No more crashes when entering modes from the case page

## Testing Recommendations

1. **Stage Navigation:**
   - Test navigating from overview → segmentation → planning → navigation
   - Verify no crashes occur at any stage transition
   - Verify toolbar loads correctly in each stage

2. **Case Page Entry:**
   - Test entering each mode directly from the case page
   - Verify no crashes occur
   - Verify toolbar loads correctly

3. **Toolbar Functionality:**
   - Verify all remaining toolbar buttons work correctly
   - Verify MoreTools menu opens without errors
   - Verify volume rendering toggle works in planner/navigation-3d

4. **Volume Rendering:**
   - Verify 3D volumes load correctly
   - Verify VTK.js rendering works
   - Verify no console errors related to orientation markers

## Future Considerations

If orientation markers are needed in the future, they should be:

1. **Added after viewport initialization:**
   - Wait for VIEWPORTS_READY event
   - Add additional delay (500ms+) to ensure volume is loaded
   - Check for volume/VTK readiness before adding

2. **Made optional:**
   - Don't add to toolbar by default
   - Provide as a user preference/setting
   - Handle missing volume gracefully

3. **Properly error-handled:**
   - Wrap all orientation marker code in try-catch
   - Check for undefined before accessing properties
   - Provide fallback behavior if initialization fails

## Related Documentation

- `Viewers/modes/planner/ORIENTATION_MARKER_FIX.md` - Historical fix attempts
- `Viewers/modes/planner/FINAL_IMPLEMENTATION.md` - Previous implementation details
- `Viewers/modes/planner/TOOLBAR_BUTTON_FIX.md` - Toolbar button debugging history

These files are kept for historical reference but describe implementations that have now been removed.

---

**Date:** December 23, 2025  
**Status:** ✅ Complete  
**Tested:** Pending user verification

