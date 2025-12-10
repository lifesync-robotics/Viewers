# 2D Projection Calculation Analysis

## Current Implementation (`ToolProjectionRenderer.ts`)

### Step-by-Step Process:

#### 1. **Get Viewport Camera Info** (lines 166-176)
```typescript
const camera = viewport.getCamera();
const planeNormal = vec3.fromValues(
  camera.viewPlaneNormal[0],
  camera.viewPlaneNormal[1],
  camera.viewPlaneNormal[2]
);
const planePoint = vec3.fromValues(
  camera.focalPoint[0],
  camera.focalPoint[1],
  camera.focalPoint[2]
);
```
- Uses `camera.viewPlaneNormal` directly from viewport
- Uses `camera.focalPoint` as plane point
- **ISSUE**: Doesn't verify viewport name, assumes camera normal is correct

#### 2. **Identify Plane Type** (lines 183-188)
```typescript
let planeType = 'Unknown';
if (Math.abs(planeNormal[2]) > 0.9) planeType = 'Axial (Z-normal)';
else if (Math.abs(planeNormal[0]) > 0.9) planeType = 'Sagittal (X-normal)';
else if (Math.abs(planeNormal[1]) > 0.9) planeType = 'Coronal (Y-normal)';
```
- Identifies plane by checking which axis is dominant in normal
- Axial: Z-axis dominant (normal ≈ [0, 0, ±1])
- Sagittal: X-axis dominant (normal ≈ [±1, 0, 0])
- Coronal: Y-axis dominant (normal ≈ [0, ±1, 0])
- **ISSUE**: Relies on camera normal being correct, doesn't cross-check with viewport name

#### 3. **Calculate Tool Line** (lines 192-196)
```typescript
const originVec = vec3.fromValues(origin[0], origin[1], origin[2]);
const tipVec = vec3.fromValues(tipPoint[0], tipPoint[1], tipPoint[2]);
const toolDirection = vec3.subtract(vec3.create(), tipVec, originVec);
const toolLength = vec3.length(toolDirection);
vec3.normalize(toolDirection, toolDirection);
```
- Creates vector from tool origin to tip
- Normalizes direction for intersection calculation

#### 4. **Line-Plane Intersection Math** (lines 204-280)
```typescript
// Plane equation: n · (P - P0) = 0
// Line equation: P = origin + t * toolDirection
// Solve for t: t = n · (P0 - origin) / (n · toolDirection)

const originToPlane = vec3.subtract(vec3.create(), planePoint, originVec);
const numerator = vec3.dot(planeNormal, originToPlane);
const denominator = vec3.dot(planeNormal, toolDirection);
const t = numerator / denominator;
```
- Standard line-plane intersection formula
- Checks if line is parallel to plane (denominator ≈ 0)
- Calculates intersection parameter `t`
- Verifies intersection is within tool segment (0 < t < toolLength)

#### 5. **Convert to Canvas Coordinates** (lines 322-323, 357-358)
```typescript
const originCanvas = viewport.worldToCanvas([origin[0], origin[1], origin[2]]);
const tipCanvas = viewport.worldToCanvas([tip[0], tip[1], tip[2]]);
```
- Converts 3D world coordinates to 2D screen coordinates
- This is where rotation issues might occur if viewport camera is not aligned correctly

## **Identified Issues:**

### Issue 1: No Viewport Name Verification
- Current code uses `viewport.id` only for logging
- Doesn't check if viewport is actually axial/coronal/sagittal
- Trusts `camera.viewPlaneNormal` without validation

### Issue 2: Camera Normal May Be Incorrect
- User reports: "yellow projection on sagittal looks like it should be on coronal"
- Suggests camera normals might be swapped or rotated
- Need to use **known normals** for each plane type

### Issue 3: Potential Coordinate System Issue
- User reports: "axial 2D projection looks like it needs 90-degree rotation"
- Might be related to how `worldToCanvas()` handles rotation
- Coordinate system note: cornerstone stores patient space as axis-aligned; DICOM patient coords are LPS, some tooling presents RAS. For the plane test we only need axis dominance (X/Y/Z), not sign; sign is validated against the camera normal.

## **Recommended Fix:**

### 1. Identify Viewport by Name First
```typescript
const viewportName = this._identifyViewportType(viewport);
```

### 2. Use Known Normals Based on Viewport Name
```typescript
const standardNormals = {
  'axial': [0, 0, 1],      // Z-axis
  'sagittal': [1, 0, 0],   // X-axis  
  'coronal': [0, 1, 0]     // Y-axis
};
const planeNormal = standardNormals[viewportName] || camera.viewPlaneNormal;
```

### 3. Cross-Validate Camera Normal vs Viewport Name
```typescript
const cameraNormal = camera.viewPlaneNormal;
const expectedNormal = standardNormals[viewportName];
if (!this._normalsMatch(cameraNormal, expectedNormal)) {
  console.warn(`⚠️ Camera normal mismatch for ${viewportName}`);
  // Use expected normal instead
}
```

### 4. Add Detailed Debug Logging
- Log viewport name
- Log both camera normal and expected normal
- Log intersection results
- Log canvas projection coordinates

## **Next Steps:**

1. Implement `_identifyViewportType()` method
2. Add standard normal definitions
3. Use viewport-specific normals for intersection calculation
4. Add cross-validation and warnings
5. Test on all three planes

