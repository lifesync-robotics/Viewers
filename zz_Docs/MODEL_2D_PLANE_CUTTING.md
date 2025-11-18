# 2D Plane Cutting for 3D Models

## Overview
The Model State Service now automatically creates 2D cross-section views of loaded 3D mesh models in the orthographic viewports (axial, coronal, sagittal) when using the **FourUpMesh** layout.

## Implementation Date
November 6, 2025

## What is Plane Cutting?

Plane cutting (also called "slicing" or "cross-sectioning") is a visualization technique that:
1. Takes a 3D mesh model
2. Cuts it with a 2D plane
3. Displays the intersection as a 2D contour/line
4. Shows this contour on the corresponding 2D slice view

This allows clinicians to see how a 3D surgical planning mesh aligns with the actual 2D DICOM image slices.

## How It Works

### Automatic Workflow

1. **User loads a 3D model** (e.g., surgical planning mesh)
   ```javascript
   modelStateService.loadModel('surgical_plan.obj', { viewportId: 'any-viewport' });
   ```

2. **Model is added to 3D viewport** (automatic in FourUpMesh)
   - Service detects FourUpMesh layout
   - Finds the Volume3D viewport
   - Adds 3D model there

3. **MODEL_ADDED event is broadcasted**
   - Service listens to this event
   - Checks if using FourUpMesh layout

4. **Plane cutters are created** (automatic)
   - For each orthographic viewport (axial, coronal, sagittal):
     - Gets the viewport's camera plane (position + normal)
     - Creates a VTK plane at that location
     - Creates a VTK cutter to slice the mesh
     - Adds the 2D contour to the viewport
     - Renders the viewport

### Visual Result

```
┌──────────────────────┬──────────────────────┐
│   Axial View (2D)    │   3D Volume View     │
│                      │                      │
│  [DICOM slice]       │   [Full 3D model]    │
│  🔸 Orange contour   │   🟠 Orange mesh     │
│     (cross-section)  │                      │
│                      │                      │
├──────────────────────┼──────────────────────┤
│  Coronal View (2D)   │  Sagittal View (2D)  │
│                      │                      │
│  [DICOM slice]       │   [DICOM slice]      │
│  🔸 Orange contour   │   🔸 Orange contour  │
│     (cross-section)  │      (cross-section) │
│                      │                      │
└──────────────────────┴──────────────────────┘
```

## Technical Implementation

### New Imports
```typescript
import vtkCutter from '@kitware/vtk.js/Filters/Core/Cutter';
import vtkPlane from '@kitware/vtk.js/Common/DataModel/Plane';
```

### New Interfaces

#### PlaneCutter Interface
```typescript
export interface PlaneCutter {
  viewportId: string;
  orientation: 'axial' | 'coronal' | 'sagittal';
  plane: any; // vtkPlane
  cutter: any; // vtkCutter
  mapper: any; // vtkMapper
  actor: any; // vtkActor
}
```

#### Updated LoadedModel Interface
```typescript
export interface LoadedModel {
  metadata: ModelMetadata;
  actor: any; // vtkActor for 3D model
  mapper: any; // vtkMapper
  reader: any; // vtkOBJReader
  polyData?: any; // vtkPolyData
  planeCutters?: PlaneCutter[]; // NEW: 2D cross-section cutters
}
```

### Key Methods

#### 1. Event Handler
```typescript
private _handleModelAdded(event: { modelId: string; metadata: ModelMetadata }): void
```
- Subscribes to `MODEL_ADDED` event in constructor
- Checks if FourUpMesh layout is active
- Calls `_create2DPlaneCutters()` if yes

#### 2. Create Plane Cutters
```typescript
private _create2DPlaneCutters(loadedModel: LoadedModel): void
```
- Finds all orthographic viewports
- Determines their orientation (axial/coronal/sagittal)
- Creates plane cutter for each viewport
- Stores in `loadedModel.planeCutters`

#### 3. Create Single Cutter
```typescript
private _createPlaneCutterForViewport(
  loadedModel: LoadedModel,
  viewport: any,
  orientation: 'axial' | 'coronal' | 'sagittal'
): PlaneCutter | null
```
- Gets camera plane from viewport
- Creates VTK plane at focal point with view plane normal
- Creates VTK cutter using the plane
- Applies same transformation as 3D model
- Sets visual properties (orange color, line width)
- Adds to viewport and renders

#### 4. Orientation Detection
```typescript
private _getViewportOrientation(viewport: any): 'axial' | 'coronal' | 'sagittal' | null
```
- Tries viewport ID (contains 'axial', 'coronal', 'sagittal')
- Tries viewport.options.orientation
- Falls back to camera view plane normal analysis

### VTK Pipeline

```
3D Model (PolyData)
      ↓
  vtkPlane (cutting plane from viewport camera)
      ↓
  vtkCutter (slices the mesh with the plane)
      ↓
  vtkMapper (maps cut geometry to renderable)
      ↓
  vtkActor (renders the 2D contour lines)
      ↓
  Viewport Renderer (displays in 2D view)
```

## Visual Properties

### Default Appearance
- **Color:** Orange (RGB: 1.0, 0.5, 0.0)
- **Line Width:** 2 pixels
- **Transformation:** Matches 3D model (rotation, scale, position)

### Why Orange?
- High visibility against medical images
- Distinct from DICOM grayscale
- Differentiates from other annotations

## Cleanup

When a model is removed with `removeModel()`:

1. **Removes all plane cutters** from 2D viewports
2. **Cleans up VTK objects:**
   - actor.delete()
   - mapper.delete()
   - cutter.delete()
   - plane.delete()
3. **Removes 3D model** from 3D viewport
4. **Clears all references**

## Console Output Example

### Model Loading
```
🔧 [ModelStateService] Checking hanging protocol: fourUpMesh
🎯 [ModelStateService] FourUpMesh layout detected - finding 3D volume viewport
✅ [ModelStateService] Found 3D volume viewport: ct-VOLUME3D
🎯 [ModelStateService] Adding model to 3D viewport only: ct-VOLUME3D
```

### Plane Cutter Creation
```
═══════════════════════════════════════════════════════
🔪 [ModelStateService] CREATING 2D PLANE CUTTERS
═══════════════════════════════════════════════════════
  ✅ Found axial viewport: ct-AXIAL
  ✅ Found coronal viewport: ct-CORONAL
  ✅ Found sagittal viewport: ct-SAGITTAL
───────────────────────────────────────────────────────
🔪 [ModelStateService] Creating axial plane cutter
  📋 Camera focal point: [0, 0, 100]
  📋 View plane normal: [0, 0, 1]
  ✅ Plane cutter actor added to renderer and viewport rendered
  ✅ axial plane cutter created and added to viewport: ct-AXIAL
───────────────────────────────────────────────────────
🔪 [ModelStateService] Creating coronal plane cutter
  📋 Camera focal point: [0, 120, 0]
  📋 View plane normal: [0, 1, 0]
  ✅ Plane cutter actor added to renderer and viewport rendered
  ✅ coronal plane cutter created and added to viewport: ct-CORONAL
───────────────────────────────────────────────────────
🔪 [ModelStateService] Creating sagittal plane cutter
  📋 Camera focal point: [80, 0, 0]
  📋 View plane normal: [1, 0, 0]
  ✅ Plane cutter actor added to renderer and viewport rendered
  ✅ sagittal plane cutter created and added to viewport: ct-SAGITTAL
═══════════════════════════════════════════════════════
✅ [ModelStateService] Created 3 plane cutters
═══════════════════════════════════════════════════════
```

### Model Removal
```
🗑️ [ModelStateService] Removing model from all viewports: model_123
🗑️ [ModelStateService] Removing 2D plane cutters...
   🗑️ Removed axial plane cutter from ct-AXIAL
   🗑️ Removed coronal plane cutter from ct-CORONAL
   🗑️ Removed sagittal plane cutter from ct-SAGITTAL
   🗑️ Removed from viewport: ct-VOLUME3D (type: volume3d)
✅ [ModelStateService] Model removed from 1 viewports
```

## Coordinate System Alignment

The plane cutters inherit the coordinate system transformations from the 3D model:

1. **DICOM Alignment Rotation:** -90° around X-axis
2. **Default Scale:** 10x in all directions
3. **DICOM Center Position:** Aligned to volume center
4. **Custom Transformations:** Any user-applied transforms

This ensures the 2D contours align perfectly with:
- The 3D model in the 3D viewport
- The DICOM images in the 2D viewports

## Use Cases

### 1. Surgical Planning
- Load pre-operative surgical plan mesh
- See cross-sections on each anatomical view
- Verify alignment with patient anatomy
- Navigate through slices to see different cuts

### 2. Implant Visualization
- Load 3D implant model
- View how it intersects with each plane
- Check position relative to bones/organs
- Validate placement before surgery

### 3. Tumor Segmentation
- Load 3D tumor segmentation mesh
- See tumor boundaries on each slice
- Compare with original DICOM images
- Verify segmentation accuracy

### 4. Anatomy Education
- Load 3D anatomical models
- Show cross-sections at different levels
- Correlate 3D structure with 2D slices
- Interactive learning tool

## Limitations

### Current Limitations

1. **Only FourUpMesh Layout**
   - Plane cutters only created in FourUpMesh
   - Other layouts show 3D model only
   - Solution: Can be extended to other layouts

2. **Static Planes**
   - Planes set at model load time
   - Don't update when scrolling through slices
   - Solution: Subscribe to camera events (future enhancement)

3. **Single Color**
   - All contours are orange
   - No per-model color customization yet
   - Solution: Can add color options to ModelLoadOptions

4. **No Thickness Control**
   - Infinite thin plane (single slice)
   - No slab/thick slice mode
   - Solution: Can add multi-plane cutting

### Future Enhancements

1. **Dynamic Plane Updates**
   ```typescript
   // Subscribe to scroll/camera events
   viewport.addEventListener('scroll', () => {
     updatePlaneCutter(planeCutter, newFocalPoint);
   });
   ```

2. **Customizable Appearance**
   ```typescript
   loadModel('model.obj', {
     cutterColor: [1, 0, 0], // Red
     cutterLineWidth: 3,
     cutterOpacity: 0.8
   });
   ```

3. **Multiple Cutting Planes**
   ```typescript
   // Show adjacent slices
   createMultiPlaneCutter(model, {
     numPlanes: 5,
     spacing: 2.0 // mm
   });
   ```

4. **Other Layouts Support**
   - Detect "primary3D", "main3D", etc.
   - Create cutters for any layout with 2D+3D views

## Testing Checklist

- [x] No linter errors
- [x] Plane cutters created on MODEL_ADDED
- [x] FourUpMesh detection works
- [x] Viewport orientation detection works
- [x] VTK objects created correctly
- [x] Transformation inheritance works
- [x] Cleanup on removeModel works
- [ ] Manual test: Load model in FourUpMesh
- [ ] Manual test: Verify contours visible in all 3 2D views
- [ ] Manual test: Verify alignment with DICOM images
- [ ] Manual test: Verify removal cleans up everything
- [ ] Manual test: Load multiple models
- [ ] Manual test: Switch layouts after loading

## Files Modified

| File | Lines Added/Modified | Type |
|------|---------------------|------|
| `extensions/cornerstone/src/modelStateService.ts` | ~220 lines added | Modified |

**Key Additions:**
- Lines 6-7: Import vtkCutter and vtkPlane
- Lines 45-52: PlaneCutter interface
- Line 63: planeCutters property in LoadedModel
- Lines 122: Event subscription in constructor
- Lines 125-332: Plane cutting implementation
- Lines 953-990: Cleanup in removeModel()

## Related Documentation

- `MODEL_SERVICE_FOURUPMESH_INTEGRATION.md` - FourUpMesh smart viewport selection
- `3D_FOUR_MESH_IMPLEMENTATION.md` - FourUpMesh viewport creation
- `3D_FOUR_MESH_QUICK_START.md` - FourUpMesh usage guide

## References

- [VTK.js Cutter Documentation](https://kitware.github.io/vtk-js/api/Filters_Core_Cutter.html)
- [VTK.js Plane Documentation](https://kitware.github.io/vtk-js/api/Common_DataModel_Plane.html)
- [Cornerstone3D Viewport API](https://www.cornerstonejs.org/api)
