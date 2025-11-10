# Hardened Transform Approach for Model Cutting

## Overview

This document explains the "hardened transform" approach implemented for cutting 3D models with VTK plane cutters. This approach optimizes performance and simplifies the coordinate system workflow, especially for future UI-based model manipulation.

## The Problem

Initially, the model's transformations (rotation, scale, position) were applied only to the **actor**, not the underlying **polyData**. This created a mismatch:

- ❌ **Visual Model**: Displayed with -90° rotation, 10x scale, position offset (applied to actor)
- ❌ **PolyData**: Raw geometry without any transformations
- ❌ **Cutter**: Operating on raw polyData → incorrect intersection results

## Previous Approach: Inverse Transform (Rejected)

The first solution attempted to transform the cutting plane into the model's local coordinate space using inverse transforms. While this worked, it had several problems:

1. **Complex calculations**: Required computing inverse transformation matrices
2. **Performance issues**: With multiple user-controlled transforms, calculations would compound
3. **Coordinate confusion**: Mixing world space and local space coordinates
4. **Not scalable**: Future UI controls for model manipulation would make this worse

## New Approach: Hardened Transforms ✅

Instead, we now **"bake" all transformations directly into the polyData geometry**, creating a `transformedPolyData` that exists in world space.

### Implementation

#### 1. Store Single PolyData (In World Space)

```typescript
export interface LoadedModel {
  metadata: ModelMetadata;
  actor: any; // vtkActor
  mapper: any; // vtkMapper
  reader: any; // vtkOBJReader
  polyData?: any; // vtkPolyData (with all transformations baked in, in world space)
  planeCutters?: PlaneCutter[];
}
```

**Memory Optimization**: Only one polyData is stored (the transformed one), saving memory.

#### 2. Apply Initial DICOM Transform (Separated Function)

Initial transformations are now cleanly separated into `_applyInitialDicomTransform()`:

```typescript
private _applyInitialDicomTransform(actor: any, options: ModelLoadOptions): void {
  // DICOM coordinate system alignment: -90° rotation around X-axis
  const dicomAlignmentRotation = [-90, 0, 0];
  actor.setOrientation(dicomAlignmentRotation[0], dicomAlignmentRotation[1], dicomAlignmentRotation[2]);

  // Default scale: 10x for visibility
  const defaultScale = [10, 10, 10];
  actor.setScale(defaultScale[0], defaultScale[1], defaultScale[2]);

  // Apply custom position/rotation/scale from options...
}
```

**See:** `modelStateService.ts`, lines 629-680

#### 3. Harden Transformations In-Place (Memory Efficient)

The `_hardenPolyDataTransform()` function modifies polyData **IN-PLACE** to save memory:

```typescript
private _hardenPolyDataTransform(polyData: any, actor: any): void {
  // Get transformation parameters from actor
  const orientation = actor.getOrientation();
  const scale = actor.getScale();
  const position = actor.getPosition();

  // Build transformation matrix
  const transformMatrix = vtkMatrixBuilder
    .buildFromDegree()
    .scale(scale[0], scale[1], scale[2])
    .rotateX(orientation[0])
    .rotateY(orientation[1])
    .rotateZ(orientation[2])
    .translate(position[0], position[1], position[2])
    .getMatrix();

  // Transform each vertex IN-PLACE (modifies original array)
  const pointsData = polyData.getPoints().getData();
  for (let i = 0; i < numPoints; i++) {
    const idx = i * 3;
    const x = pointsData[idx];
    const y = pointsData[idx + 1];
    const z = pointsData[idx + 2];

    // Apply 4x4 transformation matrix (homogeneous coordinates)
    pointsData[idx] = transformMatrix[0] * x + transformMatrix[1] * y + transformMatrix[2] * z + transformMatrix[3];
    pointsData[idx + 1] = transformMatrix[4] * x + transformMatrix[5] * y + transformMatrix[6] * z + transformMatrix[7];
    pointsData[idx + 2] = transformMatrix[8] * x + transformMatrix[9] * y + transformMatrix[10] * z + transformMatrix[11];
  }

  points.modified(); // Notify VTK that points changed
}
```

**See:** `modelStateService.ts`, lines 682-729

**Key Advantage**: Modifies the existing polyData array instead of creating a new one, **saving ~50% memory**.

#### 4. Clean Model Creation Flow

The main `_createModelFromText()` function is now much cleaner:

```typescript
private _createModelFromText(...): LoadedModel {
  // Load OBJ file
  reader = vtkOBJReader.newInstance();
  reader.parseAsText(content);

  // Create mapper and actor
  const mapper = vtkMapper.newInstance();
  const actor = vtkActor.newInstance();
  actor.setMapper(mapper);

  // Apply initial DICOM alignment (separated into clean function)
  this._applyInitialDicomTransform(actor, options);
  actor.setVisibility(metadata.visible);

  // Get polyData and harden transformations (modifies in-place)
  const polyData = mapper.getInputData();
  this._hardenPolyDataTransform(polyData, actor);

  // Reset actor transform to identity (geometry is now in world space)
  actor.setOrientation(0, 0, 0);
  actor.setScale(1, 1, 1);
  actor.setPosition(0, 0, 0);

  return { metadata, actor, mapper, reader, polyData };
}
```

**See:** `modelStateService.ts`, lines 731-788

#### 5. Simplified Cutting Code

With polyData in world space, cutting becomes trivial:

```typescript
// Create plane directly in world space (from camera)
const plane = vtkPlane.newInstance();
plane.setOrigin(focalPoint[0], focalPoint[1], focalPoint[2]);
plane.setNormal(viewPlaneNormal[0], viewPlaneNormal[1], viewPlaneNormal[2]);

// Cut using polyData (already in world space)
const cutter = vtkCutter.newInstance();
cutter.setCutFunction(plane);
cutter.setInputData(loadedModel.polyData); // Simple!

// Create actor with identity transform (no transformations needed)
const actor = vtkActor.newInstance();
actor.setMapper(mapper);
// That's it - geometry is already positioned correctly!
```

**See:** `modelStateService.ts`, lines 233-265

## Benefits

### ✅ Performance
- **No runtime transform calculations**: Transformations are baked in once at load time
- **Fast cutting**: Cutter operates directly in world space with no coordinate conversions
- **Scales with complexity**: Adding more transforms doesn't impact cutting performance
- **In-place modification**: Transforms polyData in-place, avoiding array copies

### ✅ Memory Efficiency
- **~50% memory savings**: Only stores one polyData (transformed), not two (raw + transformed)
- **In-place transformation**: Modifies existing vertex array instead of creating a new one
- **Scalable**: Memory usage stays constant regardless of transformation complexity

### ✅ Code Quality
- **Separated concerns**: DICOM transform in dedicated `_applyInitialDicomTransform()` function
- **Reusable**: `_hardenPolyDataTransform()` can be called anytime to regenerate transforms
- **Clean flow**: Main loading function is concise and easy to understand
- **All coordinates in world space**: No mixing of local and world coordinate systems

### ✅ Future-Proof
- **UI manipulation ready**: When you add UI controls for X/Y/Z position and rotation:
  1. Store the original raw polyData on initial load (if needed for future transforms)
  2. Apply new transformations to actor
  3. Call `_hardenPolyDataTransform()` to regenerate world-space geometry
  4. Cutting automatically works correctly
- **No accumulation issues**: Can always reload from original file if needed

### ✅ Correctness
- **Perfect alignment**: Cut contours appear exactly where the 3D model is rendered
- **Accurate intersections**: Plane cuts at the correct position on the final transformed model
- **All transformations included**: Rotation (-90°), scale (10x), and position offset all accounted for

## Workflow for Future Model Manipulation

When implementing UI controls to move/rotate models:

### Option 1: Keep Raw PolyData for Re-transformation (Recommended)

```typescript
// Store raw polyData on initial load (add to LoadedModel interface)
export interface LoadedModel {
  // ... existing fields ...
  rawPolyData?: any; // Original geometry from file (optional, for re-transformation)
}

// User adjusts model position/rotation via UI
function updateModelTransform(modelId: string, newPosition, newRotation, newScale) {
  const loadedModel = this.loadedModels.get(modelId);

  // 1. Reset polyData to raw state (if you kept it)
  if (loadedModel.rawPolyData) {
    const points = loadedModel.rawPolyData.getPoints();
    loadedModel.polyData.getPoints().setData(points.getData(), 3);
  }

  // 2. Update actor transformations
  loadedModel.actor.setPosition(newPosition[0], newPosition[1], newPosition[2]);
  loadedModel.actor.setOrientation(newRotation[0], newRotation[1], newRotation[2]);
  loadedModel.actor.setScale(newScale[0], newScale[1], newScale[2]);

  // 3. Re-harden transformations
  this._hardenPolyDataTransform(loadedModel.polyData, loadedModel.actor);

  // 4. Reset actor to identity (geometry is now in world space)
  loadedModel.actor.setOrientation(0, 0, 0);
  loadedModel.actor.setScale(1, 1, 1);
  loadedModel.actor.setPosition(0, 0, 0);

  // 5. Update any active cutters (they automatically use the updated polyData)
  loadedModel.planeCutters?.forEach(planeCutter => {
    planeCutter.cutter.update();
  });

  // That's it! Cutting automatically works correctly with new transforms
}
```

### Option 2: Reload from File (Simpler, No Extra Memory)

```typescript
// Just reload the model with new options
function updateModelTransform(modelId: string, newPosition, newRotation, newScale) {
  const loadedModel = this.loadedModels.get(modelId);

  // Reload with new transformation options
  await this.loadModel(
    loadedModel.metadata.filePath,
    {
      position: newPosition,
      rotation: newRotation,
      scale: newScale,
      // ... other options
    }
  );

  // Cutters are automatically recreated with correct transforms
}
```

## Key Files Modified

- **`modelStateService.ts`**:
  - Lines 61-68: Updated `LoadedModel` interface (single `polyData` field)
  - Lines 629-680: New `_applyInitialDicomTransform()` function (separated DICOM alignment)
  - Lines 682-729: New `_hardenPolyDataTransform()` function (in-place transformation)
  - Lines 731-788: Refactored `_createModelFromText()` (now cleaner and uses helper functions)
  - Lines 233-265: Simplified cutting code to use world-space polyData
  - Lines 352-353: Removed position offset logic (no longer needed)

## Technical Details

### Matrix Order
Transformations are applied in order: **Scale → Rotate → Translate**

This matches VTK's convention and ensures correct transformation composition.

### Memory Considerations
- **Single polyData**: Only the transformed version is stored (in world space)
- **In-place modification**: Transforms directly modify the existing vertex array
- **Memory savings**: ~50% reduction compared to keeping both raw and transformed versions
- **Trade-off**: Cannot easily "undo" transformations without reloading from file

For typical medical models (100K-1M vertices), this approach provides both excellent performance and minimal memory footprint.

**Optional**: You can choose to keep `rawPolyData` if you need to frequently re-transform models with different parameters.

### When to Re-harden Transformations
Call `_hardenPolyDataTransform()` when:
- Model is first loaded ✅ (done automatically)
- User changes position/rotation/scale via UI (future - see workflow examples above)
- Model needs to be aligned to different DICOM series (future)

## Summary

The refactored hardened transform approach provides:
- 🚀 **Better performance**: No runtime transform calculations, in-place modifications
- 💾 **Memory efficient**: ~50% memory savings by storing only one polyData
- 🎯 **Cleaner code**: Separated concerns with dedicated helper functions
- 📖 **Better maintainability**: Clear, well-documented transformation flow
- 🔮 **Future-ready**: Scales well with UI-based manipulation
- ✅ **Correct results**: Perfect alignment between model and cut contours

This is the optimal solution for the current requirements and future workflow.
