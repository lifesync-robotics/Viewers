# Phase 3 Testing Guide - Coordinate Transformation

## 🧪 Quick Test Plan

Test the coordinate transformation system to ensure tracking data is correctly converted from register (r) to DICOM (d) coordinates.

---

## Prerequisites

### 1. **Ensure Phase 1 & 2 are running:**

```bash
# Terminal 1: SyncForge API Server
cd /home/asclepius/robotics/ModularPlatformPrototype/00_SyncForgeAPI
npm start

# Terminal 2: Python Tracking Simulator
cd /home/asclepius/robotics/ModularPlatformPrototype/04_Tracking
conda run -n asclepius python3 tracking_simulator.py

# Both should be running and connected
```

### 2. **Start OHIF:**

```bash
# Terminal 3: OHIF Viewer
cd /home/asclepius/github/Viewers
yarn run dev

# Open browser: http://localhost:3000
```

---

## Test 1: Unit Test - Transformation Math

### Browser Console Test

Open browser console (F12) and run:

```javascript
// Test 1: Identity Matrix (no transformation)
const identityMatrix = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1]
];

// Get navigation controller
const controller = window.__navigationController;

// Load identity transformation
controller.loadTransformation(identityMatrix);

// Check status
const status = controller.getStatus();
console.log('Transformation loaded:', status.transformation.loaded);  // true
console.log('Is identity:', status.transformation.isIdentity);  // true

// Test 2: Translation Matrix
const translationMatrix = [
  [1, 0, 0, 50],   // +50mm in X
  [0, 1, 0, -30],  // -30mm in Y
  [0, 0, 1, 10],   // +10mm in Z
  [0, 0, 0, 1]
];

controller.loadTransformation(translationMatrix);

const newStatus = controller.getStatus();
console.log('Transformation loaded:', newStatus.transformation.loaded);  // true
console.log('Is identity:', newStatus.transformation.isIdentity);  // false
console.log('rMd matrix:', newStatus.transformation.rMd);
console.log('inv(rMd) matrix:', newStatus.transformation.invRMd);

// Expected inv(rMd):
// [1, 0, 0, -50]   // Reverse X offset
// [0, 1, 0, 30]    // Reverse Y offset
// [0, 0, 1, -10]   // Reverse Z offset
// [0, 0, 0, 1]
```

**Expected Output:**
```
✅ Coordinate transformation loaded successfully
🔄 Transformation matrix loaded:
   rMd (register → DICOM): [[1,0,0,50], [0,1,0,-30], [0,0,1,10], [0,0,0,1]]
   inv(rMd) (DICOM → register): [[1,0,0,-50], [0,1,0,30], [0,0,1,-10], [0,0,0,1]]
```

---

## Test 2: Integration Test - Navigation with Identity Matrix

### Step-by-Step

**1. Load a DICOM study** in OHIF (any CT/MRI with MPR view)

**2. Load identity transformation** (register = DICOM):

```javascript
// Browser console
const identityMatrix = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1]
];

window.__navigationController.loadTransformation(identityMatrix);
```

**3. Start navigation:**

```javascript
// Browser console
window.__commandsManager.run({ commandName: 'startNavigation' });
```

**4. Observe console output:**

```
🧭 NavigationController initialized { targetFPS: 25 }
✅ Coordinate transformation loaded successfully
🔄 Transformation is identity matrix (register = DICOM)
🔗 Connecting to SyncForge tracking API...
✅ Got WebSocket URL: ws://localhost:3001/ws/tracking
✅ WebSocket connected - tracking data streaming at 100Hz
🔄 Update #25 | Data: 99.8 Hz | UI: 25.1 Hz → [75.2, 0.1, -20.0]
```

**5. Verify:**
- ✅ Crosshair moves in circular motion
- ✅ Console shows single coordinate (identity = no transform)
- ✅ MPR views stay synchronized

---

## Test 3: Integration Test - Navigation with Translation

### Step-by-Step

**1. Load translation transformation** (50mm offset in X):

```javascript
// Browser console
const translationMatrix = [
  [1, 0, 0, 50],   // +50mm in X
  [0, 1, 0, 0],    // No change in Y
  [0, 0, 1, 0],    // No change in Z
  [0, 0, 0, 1]
];

window.__navigationController.loadTransformation(translationMatrix);
```

**2. Start navigation:**

```javascript
window.__commandsManager.run({ commandName: 'startNavigation' });
```

**3. Observe console output:**

```
✅ Coordinate transformation loaded successfully
🔄 Transformation matrix loaded:
   rMd (register → DICOM): [[1,0,0,50], [0,1,0,0], [0,0,1,0], [0,0,0,1]]
   inv(rMd): [[1,0,0,-50], [0,1,0,0], [0,0,1,0], [0,0,0,1]]

🔄 Update #25 | Data: 99.8 Hz | UI: 25.1 Hz
   Register: [75.2, 0.1, -20.0]
   DICOM:    [25.2, 0.1, -20.0]  ← Note: X decreased by 50mm!
```

**4. Verify:**
- ✅ Console shows BOTH register and DICOM coordinates
- ✅ DICOM X coordinate is 50mm less than register X
- ✅ Y and Z coordinates unchanged
- ✅ Crosshair still moves smoothly

**5. Mathematical verification:**

```
Register position: [75.2, 0.1, -20.0]
Transformation: inv(rMd) = [[1,0,0,-50], ...]
DICOM position: [75.2-50, 0.1, -20.0] = [25.2, 0.1, -20.0] ✅
```

---

## Test 4: Visual Verification with Fiducials

### Setup

**1. Place fiducial markers** at known positions:

```javascript
// Browser console - place 3 fiducials at known DICOM coordinates
// (Assuming addFiducialAtCrosshair is available)
```

**2. Load transformation and start navigation**

**3. Observe:**
- When tracking data (register) matches a fiducial position
- The crosshair should appear exactly at that fiducial (in DICOM space)

---

## Test 5: Rotation Test

### Advanced Test with Rotation

```javascript
// 30° rotation around Z-axis + translation
const cos30 = Math.cos(30 * Math.PI / 180);  // 0.866
const sin30 = Math.sin(30 * Math.PI / 180);  // 0.5

const rotationMatrix = [
  [cos30, -sin30, 0, 10],
  [sin30,  cos30, 0, 20],
  [0,      0,     1, 30],
  [0,      0,     0,  1]
];

window.__navigationController.loadTransformation(rotationMatrix);
```

**Expected Behavior:**
- Register position `[100, 0, 0]` transforms to rotated + translated DICOM position
- Console shows both coordinate systems
- Crosshair appears at correct location in DICOM space

---

## Test 6: Error Handling

### Test Invalid Matrix

```javascript
// Test 1: Wrong dimensions
try {
  const badMatrix = [[1, 0], [0, 1]];  // 2x2 instead of 4x4
  window.__navigationController.loadTransformation(badMatrix);
} catch (error) {
  console.log('✅ Correctly rejected:', error.message);
}

// Test 2: Singular matrix (det = 0)
try {
  const singularMatrix = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 1]
  ];
  window.__navigationController.loadTransformation(singularMatrix);
} catch (error) {
  console.log('✅ Correctly rejected:', error.message);
  // Expected: "Singular matrix - cannot invert"
}

// Test 3: Non-numeric values
try {
  const invalidMatrix = [
    [1, 0, 0, NaN],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1]
  ];
  window.__navigationController.loadTransformation(invalidMatrix);
} catch (error) {
  console.log('✅ Correctly rejected:', error.message);
}
```

---

## Test 7: Performance Test

### Measure Transformation Overhead

```javascript
// Measure transformation time
const controller = window.__navigationController;
const transformer = controller.coordinateTransformer;

const translationMatrix = [
  [1, 0, 0, 50],
  [0, 1, 0, -30],
  [0, 0, 1, 10],
  [0, 0, 0, 1]
];

transformer.loadTransform(translationMatrix);

// Benchmark
const iterations = 10000;
const testPosition = [75.2, 0.1, -20.0];

console.time('10000 transformations');
for (let i = 0; i < iterations; i++) {
  transformer.registerToDICOM(testPosition);
}
console.timeEnd('10000 transformations');

// Expected: < 10ms total (< 0.001ms per transform)
```

**Expected Output:**
```
10000 transformations: 8.234ms
Per transform: 0.0008ms ✅
```

---

## Test 8: Real Case Data Test

### Using case.json from SurgicalCase

**1. Load rMd from your generated case.json:**

```javascript
// Example from your generated case files
const caseRMd = {
  "matrix": [
    [1.0, 0.0, 0.0, 0.0],
    [0.0, 1.0, 0.0, 0.0],
    [0.0, 0.0, 1.0, 0.0],
    [0.0, 0.0, 0.0, 1.0]
  ],
  "description": "Identity matrix - register frame aligned with DICOM frame",
  "notes": "Identity matrix - register frame aligned with DICOM frame during planning"
};

window.__navigationController.loadTransformation(caseRMd.matrix);
```

**2. Start navigation and verify:**
- Transformation loads successfully
- Identity matrix detected (for simulation)
- Navigation works correctly

---

## Automated Test Script

### Complete Test Suite

```javascript
// Complete test suite - run in browser console
(async function testCoordinateTransformation() {
  console.log('🧪 Starting Coordinate Transformation Test Suite...\n');

  const controller = window.__navigationController;
  let passed = 0;
  let failed = 0;

  // Test 1: Identity Matrix
  console.log('Test 1: Identity Matrix');
  try {
    const identity = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1]
    ];
    controller.loadTransformation(identity);
    const status = controller.getStatus();
    console.assert(status.transformation.loaded, 'Should be loaded');
    console.assert(status.transformation.isIdentity, 'Should be identity');
    console.log('✅ PASS\n');
    passed++;
  } catch (error) {
    console.log('❌ FAIL:', error.message, '\n');
    failed++;
  }

  // Test 2: Translation Matrix
  console.log('Test 2: Translation Matrix');
  try {
    const translation = [
      [1, 0, 0, 50],
      [0, 1, 0, -30],
      [0, 0, 1, 10],
      [0, 0, 0, 1]
    ];
    controller.loadTransformation(translation);
    const status = controller.getStatus();
    console.assert(status.transformation.loaded, 'Should be loaded');
    console.assert(!status.transformation.isIdentity, 'Should not be identity');

    // Verify inverse
    const invRMd = status.transformation.invRMd;
    console.assert(invRMd[0][3] === -50, 'X offset should be -50');
    console.assert(invRMd[1][3] === 30, 'Y offset should be 30');
    console.assert(invRMd[2][3] === -10, 'Z offset should be -10');

    console.log('✅ PASS\n');
    passed++;
  } catch (error) {
    console.log('❌ FAIL:', error.message, '\n');
    failed++;
  }

  // Test 3: Clear Transformation
  console.log('Test 3: Clear Transformation');
  try {
    controller.clearTransformation();
    const status = controller.getStatus();
    console.assert(!status.transformation.loaded, 'Should not be loaded');
    console.log('✅ PASS\n');
    passed++;
  } catch (error) {
    console.log('❌ FAIL:', error.message, '\n');
    failed++;
  }

  // Test 4: Invalid Matrix (should reject)
  console.log('Test 4: Invalid Matrix Handling');
  try {
    const invalid = [[1, 0], [0, 1]];  // Wrong size
    try {
      controller.loadTransformation(invalid);
      console.log('❌ FAIL: Should have thrown error\n');
      failed++;
    } catch {
      console.log('✅ PASS: Correctly rejected invalid matrix\n');
      passed++;
    }
  } catch (error) {
    console.log('❌ FAIL:', error.message, '\n');
    failed++;
  }

  // Summary
  console.log('═══════════════════════════════════════');
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════');

  return { passed, failed };
})();
```

---

## Success Criteria

### ✅ Phase 3 Complete When:

1. **Unit Tests Pass:**
   - ✅ Identity matrix detected correctly
   - ✅ Translation matrix inverted correctly
   - ✅ Rotation matrix inverted correctly
   - ✅ Invalid matrices rejected with error

2. **Integration Tests Pass:**
   - ✅ Transformation loads without errors
   - ✅ Navigation works with identity matrix
   - ✅ Navigation works with translation matrix
   - ✅ Console shows both register and DICOM coords (when not identity)

3. **Performance Tests Pass:**
   - ✅ < 0.01ms per transformation
   - ✅ No visible lag in navigation
   - ✅ 25 Hz UI update maintained

4. **Visual Tests Pass:**
   - ✅ Crosshair appears in correct DICOM location
   - ✅ MPR views stay synchronized
   - ✅ Smooth motion (no jitter)

---

## Troubleshooting

### Problem: Transformation not applied

**Check:**
```javascript
const status = window.__navigationController.getStatus();
console.log('Loaded?', status.transformation.loaded);
console.log('Identity?', status.transformation.isIdentity);
```

**Solution:** Ensure `loadTransformation()` called before `startNavigation()`

### Problem: Wrong coordinates

**Debug:**
```javascript
// Enable detailed logging by setting update count to 1
// This will log every frame instead of every 25th frame
```

**Check math:**
- Verify rMd matrix values
- Verify inv(rMd) computed correctly
- Test with simple identity matrix first

### Problem: Performance issues

**Measure:**
```javascript
// Check if transformation is causing slowdown
controller.clearTransformation();  // Remove transform
// If faster → transformation overhead
// If same → other issue
```

---

## Next Steps After Testing

Once all tests pass:

1. ✅ Commit Phase 3 changes
2. ✅ Document test results
3. ✅ Proceed to Phase 4 (UI Components)

---

**Version:** 1.0
**Date:** 2025-11-08
**Status:** Ready for Testing
