# Crosshair Annotation Structure Investigation

## Goal
Investigate the complete structure of Cornerstone3D CrosshairsTool annotation to extract both center position AND plane normal vectors for each orthogonal plane.

## Current Knowledge

### What We Know
From `viewportStateService.ts` (lines 497-509):
```typescript
const annotations = annotation.state.getAnnotations('Crosshairs', element);

if (annotations && annotations.length > 0) {
  const firstAnnotation = annotations[0];

  // The center is stored in:
  if (firstAnnotation.data?.handles?.rotationPoints) {
    center = firstAnnotation.data.handles.rotationPoints[0]; // World coordinates [x, y, z]
  } else if (firstAnnotation.data?.handles?.toolCenter) {
    center = firstAnnotation.data.handles.toolCenter; // Alternative location
  }
}
```

### Annotation Structure (Known Parts)
```typescript
{
  annotationUID: string,
  metadata: {
    toolName: 'Crosshairs',
    FrameOfReferenceUID: string,
    referencedImageId: string
  },
  data: {
    handles: {
      rotationPoints: [[x, y, z], ...],  // Multiple points for rotation?
      toolCenter: [x, y, z],              // Center point
      // What else is here???
    },
    // cachedStats: ???
    // Other properties???
  }
}
```

## Investigation Strategy

### Step 1: Log Complete Annotation Object
Add temporary logging code to examine the full annotation structure:

```typescript
// In modelStateService.ts updatePlanePosition callback
const annotations = annotation.state.getAnnotations('Crosshairs', viewport.element);

if (annotations && annotations.length > 0) {
  const firstAnnotation = annotations[0];

  // Log the complete structure
  console.log('═══════════════════════════════════════════════════');
  console.log('🔍 CROSSHAIR ANNOTATION COMPLETE STRUCTURE');
  console.log('═══════════════════════════════════════════════════');
  console.log('Annotation UID:', firstAnnotation.annotationUID);
  console.log('Metadata:', JSON.stringify(firstAnnotation.metadata, null, 2));
  console.log('Data:', JSON.stringify(firstAnnotation.data, null, 2));
  console.log('═══════════════════════════════════════════════════');
}
```

### Step 2: Search for Plane Normal Information

Possible locations for plane normals:
1. **data.handles.slabThicknessPoints** - May contain points defining plane directions
2. **data.handles.points** - Array of points defining the crosshair lines
3. **data.cachedStats** - Cached computed values (normals might be here)
4. **metadata.viewPlaneNormal** - Per-viewport plane normal
5. **Computed from rotationPoints** - Calculate normal from point positions

### Step 3: Check Viewport-Specific Data

Each viewport in MPR has its own orientation. The crosshair annotation might store:
- Per-viewport reference line data
- Plane definitions for axial, coronal, sagittal
- Normal vectors for each reference line

### Step 4: Examine CrosshairsTool Source

If annotation doesn't contain normals, we may need to:
1. Access the CrosshairsTool instance directly
2. Call methods on the tool to compute normals
3. Use viewport camera data as fallback

## Potential Solutions

### Option 1: Extract from Annotation Data
```typescript
// If annotation contains plane data
const annotation = annotations[0];
const planes = annotation.data?.planes; // Hypothetical

if (planes) {
  const axialPlane = planes.axial;
  const coronalPlane = planes.coronal;
  const sagittalPlane = planes.sagittal;

  planeNormal = axialPlane.normal; // [x, y, z]
}
```

### Option 2: Compute from Viewport Orientation
```typescript
// Map viewport orientation to standard normals
const standardNormals = {
  axial: [0, 0, 1],      // Z-axis
  coronal: [0, 1, 0],    // Y-axis
  sagittal: [1, 0, 0]    // X-axis
};

planeNormal = standardNormals[orientation];
```

### Option 3: Use Camera ViewPlaneNormal (Current Approach)
```typescript
// Already implemented as fallback
const camera = viewport.getCamera();
planeNormal = camera.viewPlaneNormal;
```

### Option 4: Calculate from RotationPoints
```typescript
// If rotationPoints define plane orientation
const points = annotation.data.handles.rotationPoints;

if (points.length >= 3) {
  // Calculate plane normal from 3 points using cross product
  const v1 = subtract(points[1], points[0]);
  const v2 = subtract(points[2], points[0]);
  planeNormal = normalize(crossProduct(v1, v2));
}
```

### Option 5: Access Tool Instance Methods
```typescript
// Get crosshair tool instance
const crosshairsTool = toolGroup.getToolInstance('Crosshairs');

// Check if tool has methods to get reference line data
if (crosshairsTool.getReferenceLineNormal) {
  planeNormal = crosshairsTool.getReferenceLineNormal(viewport.id, orientation);
}

// Or get plane information
if (crosshairsTool.getPlaneForViewport) {
  const plane = crosshairsTool.getPlaneForViewport(viewport.id);
  planeNormal = plane.normal;
}
```

## Expected Annotation Properties (To Investigate)

### Properties to Look For:
- ✅ `data.handles.rotationPoints` - Known, contains center
- ✅ `data.handles.toolCenter` - Known, contains center
- ❓ `data.handles.slabThicknessPoints` - May contain plane bounds
- ❓ `data.handles.points` - May contain reference line points
- ❓ `data.planes` - May contain plane definitions
- ❓ `data.normals` - May contain normal vectors
- ❓ `data.referenceLines` - May contain reference line data
- ❓ `data.cachedStats` - May contain computed values
- ❓ `metadata.viewPlaneNormal` - Per-viewport normal
- ❓ `metadata.orientation` - Viewport orientation

## Testing Plan

### Test Code to Add
```typescript
const updatePlanePosition = async () => {
  try {
    const { ToolGroupManager, annotation } = await import('@cornerstonejs/tools');

    // ... existing code to get annotations ...

    if (annotations && annotations.length > 0) {
      const firstAnnotation = annotations[0];

      // INVESTIGATION: Log complete structure
      console.log('═══════════════════════════════════════════════════');
      console.log(`🔍 CROSSHAIR ANNOTATION FOR ${orientation.toUpperCase()}`);
      console.log('═══════════════════════════════════════════════════');

      // Log metadata
      console.log('📋 Metadata:');
      Object.keys(firstAnnotation.metadata || {}).forEach(key => {
        console.log(`  ${key}:`, firstAnnotation.metadata[key]);
      });

      // Log data structure
      console.log('📦 Data:');
      console.log('  Keys:', Object.keys(firstAnnotation.data || {}));

      // Log handles structure
      if (firstAnnotation.data?.handles) {
        console.log('  Handles:');
        Object.keys(firstAnnotation.data.handles).forEach(key => {
          const value = firstAnnotation.data.handles[key];
          if (Array.isArray(value)) {
            console.log(`    ${key}: Array[${value.length}]`);
            value.forEach((item, idx) => {
              if (Array.isArray(item)) {
                console.log(`      [${idx}]: [${item.join(', ')}]`);
              } else if (typeof item === 'object') {
                console.log(`      [${idx}]:`, JSON.stringify(item, null, 2));
              } else {
                console.log(`      [${idx}]:`, item);
              }
            });
          } else if (typeof value === 'object') {
            console.log(`    ${key}:`, JSON.stringify(value, null, 2));
          } else {
            console.log(`    ${key}:`, value);
          }
        });
      }

      // Log any other data properties
      if (firstAnnotation.data) {
        Object.keys(firstAnnotation.data).forEach(key => {
          if (key !== 'handles') {
            console.log(`  ${key}:`, firstAnnotation.data[key]);
          }
        });
      }

      console.log('═══════════════════════════════════════════════════');
    }
  } catch (error) {
    console.error('Investigation error:', error);
  }
};
```

## Next Steps

1. **Add investigation logging** to `modelStateService.ts`
2. **Activate crosshairs tool** in the UI
3. **Load a 3D model** in FourUpMesh layout
4. **Check console output** for complete annotation structure
5. **Document findings** in this file
6. **Implement normal extraction** based on findings
7. **Test accuracy** of plane cutting with crosshair normals

## Expected Outcome

Once we understand the annotation structure, we should be able to:
- ✅ Extract crosshair center (already working)
- ✅ Extract plane normal for each orientation
- ✅ Use crosshair-synchronized normals instead of camera normals
- ✅ Achieve perfect alignment with crosshair reference lines
- ✅ Handle oblique plane orientations (future enhancement)

## Notes

- Crosshairs tool may store different data depending on viewport type (stack vs volume)
- Reference lines are viewport-specific but share a common center
- Plane normals should be in world coordinates
- May need to account for rotated/oblique slices

## References

- Cornerstone3D CrosshairsTool: https://www.cornerstonejs.org/docs/concepts/cornerstone-tools/tools/crosshairs
- VTK.js Planes: https://kitware.github.io/vtk-js/api/Common_DataModel_Plane.html
- `viewportStateService.ts` lines 445-524 - Existing crosshair access code
