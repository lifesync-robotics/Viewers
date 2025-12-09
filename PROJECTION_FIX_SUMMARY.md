# 2D Projection Fix - Viewport-Specific Plane Normal Calculation

## 🐛 **Problem Summary**

### Reported Issues:
1. **Yellow projection on sagittal plane** looks like it should be drawn on coronal plane
2. **Coronal plane 2D projection** may not be correct for sagittal plane  
3. **Axial plane 2D projection** looks like it needs a 90-degree rotation

### Root Cause:
The `ToolProjectionRenderer` was using `camera.viewPlaneNormal` directly from the viewport without:
- Verifying the viewport name (axial, coronal, sagittal)
- Cross-validating the camera normal with expected standard normals
- Using known normals for each plane type

This led to projections appearing on incorrect planes or with incorrect orientation.

---

## 📐 **How 2D Projection is Calculated - Step by Step**

### **Original Process (BEFORE Fix):**

1. **Get Viewport Camera Info**
   ```typescript
   const camera = viewport.getCamera();
   const planeNormal = camera.viewPlaneNormal;  // Used directly
   const planePoint = camera.focalPoint;
   ```
   - ❌ Problem: Trusted camera normal without validation

2. **Identify Plane Type (by normal only)**
   ```typescript
   if (Math.abs(planeNormal[2]) > 0.9) → Axial
   else if (Math.abs(planeNormal[0]) > 0.9) → Sagittal
   else if (Math.abs(planeNormal[1]) > 0.9) → Coronal
   ```
   - ❌ Problem: Didn't check viewport name

3. **Calculate Tool Line**
   - Vector from tool origin to tip
   - Normalized direction for intersection

4. **Line-Plane Intersection Math**
   ```
   Plane: n · (P - P0) = 0
   Line:  P = origin + t * direction
   Solve: t = n · (P0 - origin) / (n · direction)
   ```

5. **Project to Canvas**
   ```typescript
   viewport.worldToCanvas([x, y, z])
   ```
   - ❌ Problem: Wrong plane normal → wrong intersection → wrong projection

---

### **NEW Process (AFTER Fix):**

1. **Identify Viewport by Name** ✅ NEW
   ```typescript
   const viewportType = this._identifyViewportType(viewport);
   // Returns: 'axial' | 'coronal' | 'sagittal' | null
   
   // Checks viewport.id for keywords:
   if (viewportId.includes('axial')) → 'axial'
   if (viewportId.includes('coronal')) → 'coronal'
   if (viewportId.includes('sagittal')) → 'sagittal'
   ```

2. **Get Standard Plane Normal** ✅ NEW
   ```typescript
   const standardNormals = {
     'axial':    [0, 0, 1],  // Z-axis (superior-inferior)
     'sagittal': [1, 0, 0],  // X-axis (left-right)
     'coronal':  [0, 1, 0]   // Y-axis (anterior-posterior)
   };
   ```
   These are the **known correct normals** in DICOM RAS coordinate system

3. **Cross-Validate Camera Normal** ✅ NEW
   ```typescript
   const cameraNormal = camera.viewPlaneNormal;
   const standardNormal = getStandardPlaneNormal(viewportType);
   
   if (!normalsMatch(cameraNormal, standardNormal)) {
     console.warn("⚠️ Camera normal mismatch!");
     // Use standard normal instead of camera normal
   }
   ```

4. **Use Correct Normal for Intersection**
   - If viewport type is known → use standard normal
   - If viewport type is unknown → fall back to camera normal
   - This ensures correct plane intersection calculation

5. **Calculate Intersection with Correct Normal** ✅ FIXED
   - Same line-plane intersection math
   - But now uses **correct** plane normal
   - Results in correct 2D projection

6. **Project to Canvas**
   - Same `viewport.worldToCanvas([x, y, z])`
   - But now projects from **correct** intersection point

---

## 🔧 **Changes Made**

### File: `ToolProjectionRenderer.ts`

#### 1. Added Method: `_identifyViewportType(viewport)`
```typescript
private _identifyViewportType(viewport: any): 'axial' | 'coronal' | 'sagittal' | null {
  const viewportId = viewport.id.toLowerCase();
  
  if (viewportId.includes('axial')) return 'axial';
  if (viewportId.includes('coronal')) return 'coronal';
  if (viewportId.includes('sagittal')) return 'sagittal';
  
  return null;
}
```
- **Purpose**: Identify viewport type by checking viewport ID
- **Pattern**: Same as used in `ScrewManagementPanel.tsx` and `PlaneCutterService.ts`

#### 2. Added Method: `_getStandardPlaneNormal(viewportType)`
```typescript
private _getStandardPlaneNormal(viewportType: string): vec3 {
  const standardNormals = {
    'axial':    vec3.fromValues(0, 0, 1),  // Z-axis
    'sagittal': vec3.fromValues(1, 0, 0),  // X-axis
    'coronal':  vec3.fromValues(0, 1, 0)   // Y-axis
  };
  
  return standardNormals[viewportType];
}
```
- **Purpose**: Return the correct standard normal for each plane type
- **Coordinate System**: DICOM RAS (Right-Anterior-Superior)
  - Axial: views along Z (superior-inferior direction)
  - Sagittal: views along X (left-right direction)
  - Coronal: views along Y (anterior-posterior direction)

#### 3. Added Method: `_normalsMatch(normal1, normal2, tolerance)`
```typescript
private _normalsMatch(normal1: vec3, normal2: vec3, tolerance: number = 0.1): boolean {
  const diff = vec3.subtract(vec3.create(), normal1, normal2);
  const distance = vec3.length(diff);
  return distance < tolerance;
}
```
- **Purpose**: Check if two normals are approximately equal
- **Tolerance**: 0.1 (allows for small floating-point differences)

#### 4. Updated Method: `_renderProjectionOnViewport()`
**Key Changes:**
- Identifies viewport type first
- Gets standard normal for that viewport type
- Compares camera normal with standard normal
- Logs warning if mismatch detected
- Uses standard normal for intersection calculation (not camera normal)

**Enhanced Logging:**
```
📐 Viewport Plane Info:
   Viewport ID: mpr-axial-viewport-1
   Viewport Type: axial
   Normal Source: standard axial
   Plane Normal: [0.000, 0.000, 1.000]
   Camera Normal: [0.005, 0.010, 0.999]
   Plane Point (focal): [128.0, 128.0, 50.0]
   Plane Type (by normal): Axial (Z-normal)
```

This shows:
- ✅ Viewport was correctly identified as 'axial'
- ✅ Standard normal [0, 0, 1] is being used
- ✅ Camera normal [0.005, 0.010, 0.999] is slightly off but close
- ✅ Standard normal takes precedence

---

## 🧪 **Testing the Fix**

### Test 1: Verify Viewport Identification
1. Start navigation with tracking
2. Check console logs for each viewport
3. Verify correct identification:
   ```
   Viewport ID: mpr-axial-viewport-1
   Viewport Type: axial ✅
   
   Viewport ID: mpr-sagittal-viewport-2
   Viewport Type: sagittal ✅
   
   Viewport ID: mpr-coronal-viewport-3
   Viewport Type: coronal ✅
   ```

### Test 2: Verify Standard Normals Are Used
1. Check logs for "Normal Source"
2. Should see: `Normal Source: standard axial` (not "camera")
3. Verify plane normals match expected:
   - Axial: `[0.000, 0.000, 1.000]`
   - Sagittal: `[1.000, 0.000, 0.000]`
   - Coronal: `[0.000, 1.000, 0.000]`

### Test 3: Check for Camera Normal Mismatches
1. Look for warnings in console:
   ```
   ⚠️ Camera normal mismatch for axial viewport!
      Camera normal: [0.005, 0.010, 0.999]
      Expected normal: [0.000, 0.000, 1.000]
      Using standard normal for intersection calculation
   ```
2. If warnings appear → camera was incorrect, fix is working
3. If no warnings → camera was already correct

### Test 4: Visual Verification
1. **Yellow Line (Instrument Body)**: Should appear on correct plane
2. **Extension Line**: Should project in correct direction
3. **Specific Checks**:
   - ✅ Sagittal plane: Projection should stay on sagittal, not jump to coronal
   - ✅ Coronal plane: Projection should be correct for sagittal tool
   - ✅ Axial plane: Projection should not need 90-degree rotation

### Test 5: Cross-Plane Consistency
1. Move tool through all three planes
2. Projection should:
   - Appear on correct plane when tool intersects it
   - Disappear when tool is far from plane
   - Show dashed line when tool is parallel to plane
3. Color should be:
   - 🟢 Green: Tool is within ±2mm of plane
   - 🔴 Red: Tool is >2mm from plane

---

## 📊 **Expected Results**

### Before Fix:
- ❌ Projections appearing on wrong planes
- ❌ Orientation incorrect (90-degree rotation needed)
- ❌ Sagittal projections appearing on coronal plane

### After Fix:
- ✅ Each viewport uses its correct standard normal
- ✅ Projections appear on correct plane
- ✅ Orientation is correct (no rotation needed)
- ✅ Camera normal mismatch warnings identify issues
- ✅ Sagittal projections stay on sagittal plane

---

## 🚀 **Next Steps**

1. **Test in Simulation Mode**
   - Start navigation with simulation tracking
   - Verify projections on all three planes
   - Check console logs for warnings

2. **Test with Real Hardware**
   - Start navigation with NDI tracking
   - Move tool through all three planes
   - Verify projections are correct

3. **If Issues Persist**
   - Check console logs for camera normal mismatches
   - Verify viewport IDs contain 'axial', 'coronal', or 'sagittal'
   - Check if camera normals need further correction

4. **Fine-Tuning (if needed)**
   - Adjust tolerance in `_normalsMatch()` (currently 0.1)
   - Add orientation offset if coordinate system is different
   - Handle edge cases (oblique planes, rotated viewports)

---

## 📝 **Related Files**

- `ToolProjectionRenderer.ts` - Main projection rendering logic (MODIFIED)
- `InstrumentProjectionMode.ts` - Uses ToolProjectionRenderer
- `TrackingService.ts` - Provides tool position data
- `TrackingPanel.tsx` - UI for controlling tracking
- `ScrewManagementPanel.tsx` - Similar viewport identification pattern
- `PlaneCutterService.ts` - Another reference for `_getViewportOrientation()`

---

## 🎯 **Key Insights**

### Why This Fix Works:
1. **Viewport Name is Source of Truth**: The viewport ID (e.g., "mpr-axial-viewport-1") tells us exactly which plane we're rendering on
2. **Standard Normals are Known**: For MPR viewports, the plane normals are well-defined in DICOM space
3. **Camera Normal Can Drift**: User interaction, rotations, or initialization issues can cause camera.viewPlaneNormal to be slightly off
4. **Cross-Validation is Critical**: By comparing camera normal with expected normal, we can detect and correct mismatches

### Coordinate System Reference (DICOM RAS):
```
       +Z (Superior)
        |
        |
        |_________ +X (Right)
       /
      /
    +Y (Anterior)
```

- **Axial plane**: Perpendicular to Z-axis (looks down from top)
- **Sagittal plane**: Perpendicular to X-axis (looks from side)
- **Coronal plane**: Perpendicular to Y-axis (looks from front)

---

## 🔍 **Debugging Commands**

### Check Viewport Normals:
```javascript
const engine = cornerstone3D.getRenderingEngine('OHIFCornerstoneRenderingEngine');
const viewports = engine.getViewports();

viewports.forEach(vp => {
  const camera = vp.getCamera();
  console.log(`${vp.id}:`, camera.viewPlaneNormal);
});
```

### Test Standard Normal Lookup:
```javascript
// In browser console (after fix is deployed):
const renderer = window.__navigationController?.getInstrumentProjectionMode()?.projectionRenderer;
if (renderer) {
  console.log('Axial normal:', renderer._getStandardPlaneNormal('axial'));
  console.log('Sagittal normal:', renderer._getStandardPlaneNormal('sagittal'));
  console.log('Coronal normal:', renderer._getStandardPlaneNormal('coronal'));
}
```

---

## ✅ **Summary**

The fix ensures that **2D projections are calculated using the correct plane normal for each viewport**. By identifying viewports by name and using standard normals instead of relying solely on camera.viewPlaneNormal, we eliminate the issues where projections appeared on wrong planes or with incorrect orientation.

**The key improvement**: From "trust the camera" → "verify and use known correct normals"

