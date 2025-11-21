# Orientation Handling Analysis - Crosshair and MPR Updates

**Date:** November 21, 2025
**Issue:** Tracking data includes orientation/rotation, but only position is used to update crosshair and MPR views
**Status:** Analysis Complete - Implementation Needed

---

## 📋 Current Implementation

### Data Flow

```
NDI Tracker
  ↓ Outputs: position + orientation (rotation matrix)
  ↓
TrackingServer (Python)
  ↓ Sends: position_mm + rotation_deg + 4x4 matrix
  ↓
ProtobufBridge (Node.js)
  ↓ Forwards via WebSocket
  ↓
TrackingService.ts
  ├─ Extracts: position, orientation, matrix
  └─ Broadcasts: TRACKING_UPDATE event
  ↓
NavigationController.ts
  ├─ Receives: position, orientation, matrix
  ├─ ❌ ONLY USES: position
  └─ ❌ IGNORES: orientation, matrix
  ↓
Viewport Updates
  └─ Only updates camera focalPoint (position)
```

---

## 🔍 Current Code Analysis

### 1. TrackingService.ts - Data Extraction ✅

**File:** `Viewers/extensions/lifesync/src/services/TrackingService.ts`

**Lines 528-555:**

```typescript
if (primaryTool) {
  // Extract position, orientation, and matrix
  const position = primaryTool.coordinates?.register?.position_mm;
  const rotation = primaryTool.coordinates?.register?.rotation_deg || [0, 0, 0];

  // Construct matrix key dynamically (rM + toolId, e.g., rMEE, rMDR-VR06-A33)
  const matrixKey = `rM${primaryToolId}`;
  const matrix = primaryTool.coordinates?.register?.[matrixKey] ||
                primaryTool.coordinates?.register?.rMEE ||
                primaryTool.coordinates?.register?.rMcrosshair;

  // Pass to tracking update handler
  this._handleTrackingUpdate({
    position: position,
    orientation: rotation,  // ✅ Extracted
    matrix: matrix,         // ✅ Extracted
    timestamp: messageData.timestamp,
    frame_id: messageData.frame_number,
    quality: primaryTool.quality,
    quality_score: primaryTool.quality_score,
    visible: primaryTool.visible,
    tool_id: primaryToolId,
    tool_name: primaryTool.tool_name,
    // ... other fields
  });
}
```

**Status:** ✅ **Correctly extracts orientation and matrix**

---

### 2. TrackingService.ts - Event Broadcasting ✅

**Lines 634-646:**

```typescript
// Broadcast to listeners (NavigationController will handle this)
this._broadcastEvent(EVENTS.TRACKING_UPDATE, {
  position,
  orientation,    // ✅ Broadcasted
  timestamp,
  frame_id,
  matrix: data.matrix,  // ✅ Broadcasted
  quality: data.quality,
  quality_score: data.quality_score,
  visible: data.visible,
  tools: data.tools,
});
```

**Status:** ✅ **Correctly broadcasts orientation and matrix**

---

### 3. NavigationController.ts - Event Reception ⚠️

**File:** `Viewers/extensions/lifesync/src/utils/navigationController.ts`

**Lines 154-204:**

```typescript
private _handleTrackingUpdate(event: any): void {
  const { position, orientation, frame_id } = event;  // ✅ Receives orientation
  const { cornerstoneViewportService } = this.servicesManager.services;

  this.updateCount++;

  // Throttle UI updates to target FPS
  const now = performance.now();
  const timeSinceLastRender = now - this.lastRenderTime;

  if (timeSinceLastRender < this.minRenderInterval) {
    return; // Skip this update
  }

  // Calculate data and render Hz
  this.dataUpdateTimes.push(now);
  if (this.dataUpdateTimes.length > 100) {
    this.dataUpdateTimes.shift();
  }

  const dataHz = this.dataUpdateTimes.length > 1
    ? 1000 / ((now - this.dataUpdateTimes[0]) / (this.dataUpdateTimes.length - 1))
    : 0;

  const renderHz = this.lastRenderTime > 0
    ? 1000 / timeSinceLastRender
    : 0;

  // Transform from register to DICOM coordinates
  const dicomPosition = this.coordinateTransformer.transformPoint(position);

  // Log periodically
  if (this.updateCount % 25 === 0) {
    if (this.updateCount === 25) {
      console.log(`📍 Coordinate transformation:`);
      console.log(`   Register: [${position.map(v => v.toFixed(1)).join(', ')}]`);
      console.log(`   DICOM:    [${dicomPosition.map(v => v.toFixed(1)).join(', ')}]`);
    } else {
      console.log(`🔄 Update #${this.updateCount} | Data: ${dataHz.toFixed(1)} Hz | UI: ${renderHz.toFixed(1)} Hz → [${dicomPosition.map(v => v.toFixed(1)).join(', ')}]`);
    }
  }

  try {
    // Update crosshair for each viewport using DICOM coordinates
    this._updateCrosshairPosition(dicomPosition, orientation);  // ✅ Passes orientation
    this.lastRenderTime = now;
  } catch (error) {
    console.error('❌ Error updating crosshair:', error);
  }
}
```

**Status:** ⚠️ **Receives and passes orientation, but...**

---

### 4. NavigationController.ts - Crosshair Update ❌

**Lines 210-219:**

```typescript
private _updateCrosshairPosition(position: number[], orientation: number[]): void {
  const { cornerstoneViewportService } = this.servicesManager.services;

  if (!cornerstoneViewportService) {
    return;
  }

  // Use the proper viewport state update method
  this._updateViewportStates(position);  // ❌ ONLY passes position, orientation DROPPED!
}
```

**Status:** ❌ **PROBLEM: Orientation parameter received but NOT passed to `_updateViewportStates()`**

---

### 5. NavigationController.ts - Viewport State Update ❌

**Lines 225-347:**

```typescript
private _updateViewportStates(position: number[]): void {
  // ❌ NO orientation parameter!

  const { cornerstoneViewportService } = this.servicesManager.services;

  if (!cornerstoneViewportService) {
    console.warn('⚠️ No cornerstoneViewportService');
    return;
  }

  // ... position clamping and validation ...

  viewports.forEach(vp => {
    try {
      const camera = vp.getCamera();

      // Calculate new camera position maintaining view direction
      const viewPlaneNormal = vec3.create();
      vec3.subtract(viewPlaneNormal, camera.position, camera.focalPoint);
      const distance = vec3.length(viewPlaneNormal);
      vec3.normalize(viewPlaneNormal, viewPlaneNormal);

      const newFocalPoint: cs3DTypes.Point3 = [
        clampedPosition[0],
        clampedPosition[1],
        clampedPosition[2]
      ];
      const newPosition: cs3DTypes.Point3 = [
        newFocalPoint[0] + viewPlaneNormal[0] * distance,
        newFocalPoint[1] + viewPlaneNormal[1] * distance,
        newFocalPoint[2] + viewPlaneNormal[2] * distance,
      ];

      // Update camera WITHOUT triggering reference updates
      // Just pan the view smoothly
      vp.setCamera({
        focalPoint: newFocalPoint,
        position: newPosition,
        viewUp: camera.viewUp,  // ❌ Uses EXISTING viewUp, doesn't update from orientation!
      });

      // Render the viewport
      vp.render();
      updatedCount++;
    } catch (error) {
      console.error(`❌ Error updating ${vp.id}:`, error);
    }
  });

  this.lastPosition = clampedPosition;
}
```

**Status:** ❌ **PROBLEM: Only updates position (focalPoint), keeps existing viewUp/orientation**

---

## ❌ Identified Problems

### Problem 1: Orientation Parameter Dropped

**Location:** `_updateCrosshairPosition()` method

```typescript
// Receives orientation but doesn't pass it forward
private _updateCrosshairPosition(position: number[], orientation: number[]): void {
  this._updateViewportStates(position);  // ❌ orientation lost here
}
```

### Problem 2: No Orientation Handling in Viewport Update

**Location:** `_updateViewportStates()` method

```typescript
// Only accepts position, no orientation parameter
private _updateViewportStates(position: number[]): void {
  // ...
  vp.setCamera({
    focalPoint: newFocalPoint,
    position: newPosition,
    viewUp: camera.viewUp,  // ❌ Uses existing viewUp, doesn't update
  });
}
```

### Problem 3: Camera Orientation Not Updated

**Issue:** The camera's `viewUp` vector determines the MPR slice orientation, but it's never updated from the tracking data.

**Current Behavior:**
- Only `focalPoint` is updated (crosshair position moves)
- `viewUp` remains unchanged (MPR slices don't rotate)
- `position` is recalculated to maintain view distance but not orientation

---

## 📊 Data Available vs. Data Used

| Data Type | Available in Tracking | Used in Navigation |
|-----------|----------------------|-------------------|
| Position (x, y, z) | ✅ Yes | ✅ Yes |
| Orientation (Euler angles) | ✅ Yes | ❌ No |
| 4x4 Transformation Matrix | ✅ Yes | ❌ No |
| Rotation Matrix (3x3) | ✅ Yes (in 4x4) | ❌ No |

---

## 🎯 What Should Happen

### Ideal Behavior

1. **Position Update** (Currently Working ✅)
   - Crosshair center moves to tracked tool position
   - MPR slices pan to follow the tool

2. **Orientation Update** (Currently Missing ❌)
   - MPR slices rotate to align with tracked tool orientation
   - Axial/Sagittal/Coronal views adjust based on tool angle
   - Camera `viewUp` vector updates from orientation data

### Use Cases

#### Use Case 1: Surgical Tool Tracking
- **Scenario:** Surgeon moves a tracked pointer/drill
- **Expected:**
  - Crosshair follows tool tip position ✅
  - MPR views rotate to show tool axis ❌ (not implemented)
  - Slices align with tool orientation ❌ (not implemented)

#### Use Case 2: Patient Reference Movement
- **Scenario:** Patient moves slightly during surgery
- **Expected:**
  - All views adjust for patient movement ✅ (position)
  - Views maintain correct anatomical orientation ❌ (rotation not tracked)

---

## 🔧 Proposed Solution

### Option 1: Use Euler Angles (rotation_deg)

**Pros:**
- Simple to understand (roll, pitch, yaw)
- Already available in tracking data

**Cons:**
- Gimbal lock issues
- Euler angle conventions can be confusing
- Need to convert to viewUp vector

**Implementation:**

```typescript
private _updateViewportStates(position: number[], orientation: number[]): void {
  // orientation = [roll, pitch, yaw] in degrees

  viewports.forEach(vp => {
    const camera = vp.getCamera();

    // Convert Euler angles to viewUp vector
    const viewUp = this._eulerToViewUp(orientation);

    // Calculate view direction from orientation
    const viewPlaneNormal = this._eulerToViewDirection(orientation);

    const newFocalPoint = position;
    const distance = vec3.length(vec3.subtract(vec3.create(), camera.position, camera.focalPoint));
    const newPosition = [
      newFocalPoint[0] + viewPlaneNormal[0] * distance,
      newFocalPoint[1] + viewPlaneNormal[1] * distance,
      newFocalPoint[2] + viewPlaneNormal[2] * distance,
    ];

    vp.setCamera({
      focalPoint: newFocalPoint,
      position: newPosition,
      viewUp: viewUp,  // ✅ Now updates orientation
    });

    vp.render();
  });
}
```

### Option 2: Use 4x4 Transformation Matrix (Recommended ✅)

**Pros:**
- No gimbal lock
- Direct representation of tool pose
- Already computed by NDI tracker
- Standard in surgical navigation

**Cons:**
- Slightly more complex to extract vectors
- Need to handle matrix format

**Implementation:**

```typescript
private _updateViewportStates(position: number[], orientation: number[], matrix: number[]): void {
  // matrix is 4x4 transformation matrix (row-major or column-major)

  viewports.forEach(vp => {
    const camera = vp.getCamera();

    // Extract rotation matrix (3x3) from 4x4 transformation matrix
    // Assuming row-major format: [m00, m01, m02, m03, m10, m11, ...]
    const rotationMatrix = this._extractRotationMatrix(matrix);

    // Extract view direction (typically Z-axis of tool)
    const viewDirection = [
      rotationMatrix[2][0],  // Z-axis X component
      rotationMatrix[2][1],  // Z-axis Y component
      rotationMatrix[2][2],  // Z-axis Z component
    ];

    // Extract viewUp (typically Y-axis of tool)
    const viewUp = [
      rotationMatrix[1][0],  // Y-axis X component
      rotationMatrix[1][1],  // Y-axis Y component
      rotationMatrix[1][2],  // Y-axis Z component
    ];

    const newFocalPoint = position;
    const distance = vec3.length(vec3.subtract(vec3.create(), camera.position, camera.focalPoint));
    const newPosition = [
      newFocalPoint[0] - viewDirection[0] * distance,
      newFocalPoint[1] - viewDirection[1] * distance,
      newFocalPoint[2] - viewDirection[2] * distance,
    ];

    vp.setCamera({
      focalPoint: newFocalPoint,
      position: newPosition,
      viewUp: viewUp,  // ✅ Updates from tool orientation
    });

    vp.render();
  });
}

private _extractRotationMatrix(matrix: number[]): number[][] {
  // Convert flat array to 3x3 rotation matrix
  // Assuming 4x4 row-major: [m00, m01, m02, m03, m10, m11, m12, m13, ...]
  return [
    [matrix[0], matrix[1], matrix[2]],   // X-axis
    [matrix[4], matrix[5], matrix[6]],   // Y-axis
    [matrix[8], matrix[9], matrix[10]],  // Z-axis
  ];
}
```

### Option 3: Hybrid Approach

**Use Case Dependent:**
- For simple crosshair tracking: Position only (current)
- For tool-aligned views: Position + Orientation
- For advanced navigation: Full 4x4 matrix

**Implementation:**

```typescript
// Add configuration option
private useOrientation: boolean = false;  // Default: position only

public enableOrientationTracking(enable: boolean): void {
  this.useOrientation = enable;
  console.log(`🔄 Orientation tracking: ${enable ? 'ENABLED' : 'DISABLED'}`);
}

private _updateViewportStates(position: number[], orientation?: number[], matrix?: number[]): void {
  if (!this.useOrientation) {
    // Current behavior: position only
    this._updatePositionOnly(position);
  } else if (matrix) {
    // Preferred: use full transformation matrix
    this._updateWithMatrix(position, matrix);
  } else if (orientation) {
    // Fallback: use Euler angles
    this._updateWithEulerAngles(position, orientation);
  } else {
    // No orientation data available
    this._updatePositionOnly(position);
  }
}
```

---

## 🚀 Recommended Implementation Plan

### Phase 1: Add Matrix Support (High Priority)

1. **Update `_updateCrosshairPosition()` signature:**
   ```typescript
   private _updateCrosshairPosition(
     position: number[],
     orientation: number[],
     matrix?: number[]  // Add matrix parameter
   ): void
   ```

2. **Update `_updateViewportStates()` signature:**
   ```typescript
   private _updateViewportStates(
     position: number[],
     orientation: number[],
     matrix?: number[]  // Add matrix parameter
   ): void
   ```

3. **Implement `_extractRotationMatrix()` helper**

4. **Implement `_updateCameraWithOrientation()` method**

5. **Add configuration toggle for orientation tracking**

### Phase 2: Handle Coordinate Transformation (Medium Priority)

- Orientation also needs coordinate transformation (register → DICOM)
- Update `CoordinateTransformer` to handle rotation matrices
- Transform both position and orientation consistently

### Phase 3: UI Controls (Low Priority)

- Add toggle in Tracking Panel: "Track Orientation"
- Add visualization of tool orientation (arrow/axis display)
- Add option to lock/unlock orientation tracking

---

## 📝 Required Code Changes

### File 1: `navigationController.ts`

**Changes:**

1. Update method signatures to pass orientation and matrix
2. Implement matrix-based camera orientation update
3. Add helper methods for matrix operations
4. Add configuration option for orientation tracking

**Estimated Lines:** ~150 lines of new code

### File 2: `TrackingService.ts`

**Changes:**

1. Ensure matrix is correctly passed in TRACKING_UPDATE event (already done ✅)

**Estimated Lines:** No changes needed

### File 3: `CoordinateTransformer.ts`

**Changes:**

1. Add method to transform rotation matrices
2. Handle orientation transformation from register to DICOM space

**Estimated Lines:** ~50 lines of new code

### File 4: `TrackingPanel.tsx` (Optional)

**Changes:**

1. Add toggle for "Track Orientation"
2. Add UI indicator for orientation tracking status

**Estimated Lines:** ~20 lines of new code

---

## ⚠️ Considerations

### 1. Performance

- Matrix operations at 100Hz could impact performance
- Consider caching rotation matrix extraction
- Profile before/after implementation

### 2. User Experience

- Sudden orientation changes could be disorienting
- Consider smoothing/interpolation for orientation updates
- Add option to disable orientation tracking

### 3. Coordinate Systems

- Ensure orientation transformation is consistent with position transformation
- Verify tool coordinate system matches expected axes
- Document axis conventions (X=right, Y=up, Z=forward?)

### 4. Backward Compatibility

- Default to position-only mode (current behavior)
- Orientation tracking opt-in via configuration
- Graceful degradation if orientation data unavailable

---

## 🧪 Testing Plan

### Test 1: Position Only (Baseline)
- Verify current behavior still works
- Crosshair moves correctly
- No orientation changes

### Test 2: Static Orientation
- Set tool at fixed position with different orientations
- Verify MPR views rotate correctly
- Check all three orthogonal views

### Test 3: Dynamic Orientation
- Move tool with changing orientation
- Verify smooth updates
- Check for gimbal lock or singularities

### Test 4: Coordinate Transformation
- Verify orientation transforms correctly from register to DICOM
- Check consistency with position transformation

### Test 5: Performance
- Measure frame rate with orientation tracking
- Compare to position-only mode
- Ensure 60Hz updates maintained

---

## ✅ Summary

| Aspect | Status | Priority |
|--------|--------|----------|
| Data Extraction | ✅ Working | - |
| Data Broadcasting | ✅ Working | - |
| Position Update | ✅ Working | - |
| Orientation Update | ❌ Missing | 🔴 High |
| Matrix Support | ❌ Missing | 🔴 High |
| Coordinate Transform | ⚠️ Partial | 🟡 Medium |
| UI Controls | ❌ Missing | 🟢 Low |

**Next Steps:**
1. Discuss approach with team (Option 2 recommended)
2. Implement matrix-based orientation update
3. Test with real tracking data
4. Add UI controls for orientation tracking
5. Document axis conventions and coordinate systems

---

**Conclusion:** The tracking system correctly extracts and broadcasts orientation data, but the navigation controller only uses position. Implementing matrix-based orientation updates will enable proper MPR slice rotation aligned with the tracked tool.
