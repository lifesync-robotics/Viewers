# 3D Four Mesh Viewport Implementation

## Overview
This document describes the implementation of the new "3D Four Mesh" viewport layout, which extends the existing "3D Four Up" viewport. This new viewport provides the same 2x2 grid layout with one 3D volume viewport and three MPR (multi-planar reconstruction) viewports.

## Implementation Date
November 6, 2025

## Changes Made

### 1. Created New Hanging Protocol
**File:** `extensions/cornerstone/src/hps/fourUpMesh.ts` (NEW)

Created a new hanging protocol by copying and modifying the existing `fourUp.ts` file:
- **ID:** `fourUpMesh`
- **Name:** Translated key `Hps:3D four mesh`
- **Icon:** `layout-advanced-3d-four-up` (reusing existing icon)
- **Layout:** 2x2 grid (2 rows, 2 columns)
- **Stage ID:** `fourUpMeshStage`

**Viewport Configuration:**
1. **Top-left:** Axial MPR viewport (volume, orientation: axial)
2. **Top-right:** 3D Volume viewport (volume3d, orientation: coronal)
3. **Bottom-left:** Coronal MPR viewport (volume, orientation: coronal)
4. **Bottom-right:** Sagittal MPR viewport (volume, orientation: sagittal)

### 2. Registered Hanging Protocol
**File:** `extensions/cornerstone/src/getHangingProtocolModule.ts`

Added import and registration:
```typescript
import { fourUpMesh } from './hps/fourUpMesh';

// Added to protocol array:
{
  name: fourUpMesh.id,
  protocol: fourUpMesh,
}
```

### 3. Added to Toolbar Layout Selector
**File:** `extensions/default/src/Toolbar/ToolbarLayoutSelector.tsx`

Added new layout option to the advanced presets:
```typescript
{
  title: '3D four mesh',
  icon: 'layout-advanced-3d-four-up',
  commandOptions: {
    protocolId: 'fourUpMesh',
  },
}
```

### 4. Added Internationalization (i18n)
**Files Updated:**
- `platform/i18n/src/locales/en-US/Hps.json`
- `platform/i18n/src/locales/zh/Hps.json`
- `platform/i18n/src/locales/test-LNG/Hps.json`

**Translations Added:**
- **English:** `"3D four mesh": "3D four mesh"`
- **Chinese:** `"3D four mesh": "三维四网格"`
- **Test Language:** `"3D four mesh": "Test 3D four mesh"`

### 5. Icon Configuration
**Icon Used:** `layout-advanced-3d-four-up`

The icon is already registered in:
- `platform/ui-next/src/components/Icons/Sources/Layout.tsx` (SVG definition)
- `platform/ui-next/src/components/Icons/Icons.tsx` (icon mapping)

## How to Use

### From the UI
1. Open the OHIF Viewer
2. Click on the Layout Selector button in the toolbar
3. Navigate to the "Advanced" section
4. Click on "3D four mesh" option
5. The viewport will change to the 2x2 grid layout

### Programmatically
Use the command manager to set the hanging protocol:

```javascript
commandsManager.run({
  commandName: 'setHangingProtocol',
  commandOptions: {
    protocolId: 'fourUpMesh',
  },
});
```

## Files Modified Summary

| File | Type | Action |
|------|------|--------|
| `extensions/cornerstone/src/hps/fourUpMesh.ts` | TypeScript | Created |
| `extensions/cornerstone/src/getHangingProtocolModule.ts` | TypeScript | Modified |
| `extensions/default/src/Toolbar/ToolbarLayoutSelector.tsx` | TSX | Modified |
| `platform/i18n/src/locales/en-US/Hps.json` | JSON | Modified |
| `platform/i18n/src/locales/zh/Hps.json` | JSON | Modified |
| `platform/i18n/src/locales/test-LNG/Hps.json` | JSON | Modified |

## Technical Details

### Tool Groups Used
- **mpr:** Used for the three 2D slice viewports (axial, coronal, sagittal)
- **volume3d:** Used for the 3D volume rendering viewport

### Sync Groups
- **VOI_SYNC_GROUP:** Synchronizes volume of interest (window/level) across MPR viewports
- **HYDRATE_SEG_SYNC_GROUP:** Synchronizes segmentation hydration across all viewports

### Display Set Matching
The hanging protocol requires display sets that have the `isReconstructable` attribute set to `true`, ensuring it only applies to volumetric data that can be reconstructed into MPR and 3D views.

## Future Enhancements

Potential enhancements for the "3D Four Mesh" viewport:
1. Create a custom icon specific to the mesh layout (currently reusing the 4-up icon)
2. Add mesh-specific viewport options or tool configurations
3. Add mesh loading capabilities to the 3D viewport
4. Configure specific preset options for mesh visualization
5. Add mesh manipulation tools to the toolbar

## Testing Checklist

- [x] No linter errors introduced
- [x] Hanging protocol registered successfully
- [x] Layout appears in toolbar selector
- [x] All translations added (en-US, zh, test-LNG)
- [x] Icon displays correctly in UI
- [ ] Manual testing: Verify layout switches correctly
- [ ] Manual testing: Verify viewports render properly
- [ ] Manual testing: Verify sync groups work as expected
- [ ] Manual testing: Verify viewport interactions (zoom, pan, etc.)

## Notes

- The viewport configuration is identical to "3D Four Up" at this stage
- This provides a foundation for extending with mesh-specific functionality
- The protocol ID `fourUpMesh` should be used when referencing this layout programmatically
- The implementation follows the same pattern as existing hanging protocols for consistency
