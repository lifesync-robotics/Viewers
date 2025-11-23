# Color Consistency Implementation

**Date:** November 18, 2025
**Status:** ✅ COMPLETED

## Overview

Implemented a unified color system for screw rendering that ensures consistency between 3D VTK rendering and 2D plane cutter cross-sections. Colors are now deterministic and based on screw anatomical labels (e.g., L3-R, L4-L, T5-R).

## Problem Statement

Previously, screws were rendered with mismatched colors:
- **3D VTK Rendering:** Gold color `[1.0, 0.84, 0.0]`
- **2D Plane Cutter:** Orange color `[1.0, 0.5, 0.0]` (from rotating palette)

This made it difficult to correlate the same screw across different views.

## Solution

### 1. **Screw Color Scheme Utility** (`screwColorScheme.ts`)

Created a new utility module that provides:

**Features:**
- **Deterministic Colors:** Same screw name → same color always
- **Anatomical Labels:** Recognizes standard vertebral screw naming:
  - Lumbar: `L1L`, `L1R`, `L2L`, ..., `L5R`
  - Sacral: `S1L`, `S1R`
  - Thoracic: `T1L`, `T1R`, ..., `T12R`
  - Cervical: `C1L`, `C1R`, ..., `C7R`
- **Flexible Pattern Matching:** Extracts labels from various formats:
  - `"L3-R1"` → `"L3R"`
  - `"L4-L2"` → `"L4L"`
  - `"Custom Screw L3-R"` → `"L3R"`
- **Fallback:** Hash-based color generation for non-standard names

**Color Generation:**
```typescript
// Color palette based on Python simple_gui.py
// Combinations of [1, 0.75, 0.25, 0] for RGB
const COLOR_VALUES = [1, 0.75, 0.25, 0];
// Generates 64 distinct colors (4³)
```

**API:**
```typescript
import { getScrewColor } from '../../utils/screwColorScheme';

// Get color for a screw
const color = getScrewColor('L3-R1');  // Returns [r, g, b]
```

### 2. **ScrewManagementPanel Updates**

**Changes:**
1. Added `screwLabel` parameter to `loadScrewModel()` function
2. Calls `getScrewColor(screwLabel)` to determine color
3. Passes color to `modelStateService.loadModelFromServer()` options
4. Color is stored in model metadata

**Key Code:**
```typescript
const loadScrewModel = async (radius, length, transform, screwLabel = null) => {
  // Determine color based on screw label
  const screwColor = screwLabel ? getScrewColor(screwLabel) : [1.0, 0.84, 0.0];
  console.log(`🎨 Using color [${screwColor}] for screw "${screwLabel || 'default'}"`);

  await modelStateService.loadModelFromServer(modelUrl, {
    viewportId: getCurrentViewportId(),
    color: screwColor,  // Color based on screw name/label
    opacity: 0.9
  });
};
```

**All Call Sites Updated:**
- `saveScrew()` → passes `screwLabel`
- `restoreScrew()` → passes `displayInfo.label`
- `loadPlan()` → passes `displayInfo.label`

### 3. **PlaneCutterService Updates**

**Changes:**
1. Renamed `COLOR_PALETTE` → `FALLBACK_COLOR_PALETTE`
2. Modified `_getColorForModel()` to use 3-tier priority:
   - **Priority 1:** Model metadata color (source of truth)
   - **Priority 2:** Cached color
   - **Priority 3:** Fallback palette

**Key Code:**
```typescript
private _getColorForModel(modelId: string): [number, number, number] {
  // First, try to get color from model metadata (source of truth)
  const { modelStateService } = this.servicesManager.services;
  const loadedModel = modelStateService?.getModel(modelId);

  if (loadedModel && loadedModel.metadata && loadedModel.metadata.color) {
    const metadataColor = loadedModel.metadata.color;

    if (Array.isArray(metadataColor) && metadataColor.length === 3) {
      const color: [number, number, number] = [
        metadataColor[0],
        metadataColor[1],
        metadataColor[2]
      ];

      this.modelColors.set(modelId, color);
      console.log(`🎨 [PlaneCutterService] Using metadata color [${color}] for model ${modelId}`);
      return color;
    }
  }

  // Fallback logic...
}
```

### 4. **Data Flow**

```
┌──────────────────────────────────────────────────────────────┐
│ 1. User Saves Screw "L3-R1"                                  │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. ScrewManagementPanel                                       │
│    - Calls: getScrewColor('L3-R1')                           │
│    - Returns: [0.75, 1, 0.25] (deterministic green)          │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. ModelStateService                                          │
│    - Loads model with options.color = [0.75, 1, 0.25]       │
│    - Stores in metadata.color                                │
│    - Applies to VTK actor → 3D rendering uses this color     │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. PlaneCutterService (auto-triggered)                       │
│    - Receives MODEL_ADDED event                              │
│    - Calls: _getColorForModel(modelId)                       │
│    - Reads: metadata.color = [0.75, 1, 0.25]                │
│    - Applies to 2D plane cutter actor → same color!          │
└──────────────────────────────────────────────────────────────┘
```

## Benefits

### ✅ Consistency
- Same screw = same color in both 3D and 2D views
- Easy visual correlation across viewports

### ✅ Deterministic
- Screw name determines color
- Same name always produces same color
- Reproducible across sessions

### ✅ Anatomically Meaningful
- Colors map to vertebral levels
- L3-R screws always look the same
- Easy to identify screws by level

### ✅ Robust
- Handles various naming formats
- Fallback for custom/non-standard names
- No conflicts with existing models

## Testing Checklist

- [x] Screw color scheme utility created
- [x] ScrewManagementPanel uses color scheme
- [x] PlaneCutterService reads from metadata
- [x] No linter errors
- [ ] Manual testing: Save screw "L3-R1"
- [ ] Verify: 3D model shows consistent color
- [ ] Verify: 2D plane cutter shows same color
- [ ] Test: Non-standard screw names get hash-based colors
- [ ] Test: Multiple screws with different names get different colors
- [ ] Test: Same screw name in different sessions gets same color

## Files Modified

### Created:
- `extensions/lifesync/src/utils/screwColorScheme.ts` (176 lines)

### Modified:
- `extensions/lifesync/src/components/ScrewManagement/ScrewManagementPanel.tsx`
  - Added import: `getScrewColor`
  - Updated: `loadScrewModel()` signature and implementation
  - Updated: All call sites (saveScrew, restoreScrew, loadPlan)

- `extensions/cornerstone/src/services/PlaneCutterService/PlaneCutterService.ts`
  - Renamed: `COLOR_PALETTE` → `FALLBACK_COLOR_PALETTE`
  - Enhanced: `_getColorForModel()` to read from metadata

## Configuration

### Max Screws Limit
All systems synchronized to Python backend:
- **Backend:** `MAX_SCREWS = 10`
- **Frontend maxModels:** `10`
- **Frontend MAX_SNAPSHOTS:** `10`

### Color Space
- **Format:** RGB float arrays `[r, g, b]`
- **Range:** `[0.0, 1.0]` per channel
- **Palette Size:** 64 distinct colors
- **Fallback:** Hash-based generation for unlimited unique colors

## Future Enhancements

### Potential Improvements:
1. **Color Editor:** Allow users to customize colors per anatomical level
2. **Color Themes:** Predefined color schemes (rainbow, grayscale, thermal)
3. **Export/Import:** Save color schemes to file for team sharing
4. **API Integration:** Store color preferences in database per surgeon
5. **Visual Legend:** Display color-to-label mapping in UI

## Related Documentation

- `SCREW_MANAGEMENT_CHANGES_SUMMARY.md` - Screw management system overview
- `TRANSFORM_FEATURE_SUMMARY.md` - Transform handling documentation
- `DELETE_SCREW_FIX.md` - Screw deletion implementation

## Validation

```typescript
// Example validation test
const color1 = getScrewColor('L3-R1');
const color2 = getScrewColor('L3-R1');
console.assert(
  color1[0] === color2[0] && color1[1] === color2[1] && color1[2] === color2[2],
  'Same name must produce same color'
);

const color3 = getScrewColor('L4-R1');
console.assert(
  color1[0] !== color3[0] || color1[1] !== color3[1] || color1[2] !== color3[2],
  'Different names must produce different colors'
);
```

---

**Implementation Status:** ✅ **COMPLETE**
**Ready for Testing:** ✅ **YES**
**Production Ready:** ⚠️ **Pending Manual Testing**
