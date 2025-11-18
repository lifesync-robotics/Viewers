# 🧪 Quick Test - Phase 3 Coordinate Transformation

## 30-Second Test

```bash
# 1. Ensure all services running (from previous phases)
# Check: http://localhost:3001/api/health
# Check: Python simulator showing frames

# 2. Open OHIF: http://localhost:3000

# 3. Load any DICOM study with MPR view

# 4. Open browser console (F12) and run:
```

```javascript
// Load identity transformation (no change)
const identityMatrix = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1]
];

window.__navigationController.loadTransformation(identityMatrix);

// Start navigation
window.__commandsManager.run({ commandName: 'startNavigation' });
```

## ✅ Expected Results

**Console Output:**
```
✅ Coordinate transformation loaded successfully
🔄 Transformation is identity matrix (register = DICOM)
🔗 Connecting to SyncForge tracking API...
✅ WebSocket connected - tracking data streaming at 100Hz
🔄 Update #25 | Data: 99.8 Hz | UI: 25.1 Hz → [75.2, 0.1, -20.0]
```

**Visual:**
- ✅ Crosshair moves in circular motion
- ✅ All 3 MPR views synchronized
- ✅ Smooth 25 Hz updates (no lag)

---

## Advanced Test (With Translation)

```javascript
// Load translation matrix (+50mm X, -30mm Y, +10mm Z)
const translationMatrix = [
  [1, 0, 0, 50],
  [0, 1, 0, -30],
  [0, 0, 1, 10],
  [0, 0, 0, 1]
];

window.__navigationController.clearTransformation();
window.__navigationController.loadTransformation(translationMatrix);

// Restart navigation
window.__commandsManager.run({ commandName: 'stopNavigation' });
window.__commandsManager.run({ commandName: 'startNavigation' });
```

**Expected:**
```
🔄 Update #25 | Data: 99.8 Hz | UI: 25.1 Hz
   Register: [75.2, 0.1, -20.0]    ← From tracking
   DICOM:    [25.2, 30.1, -30.0]   ← Transformed for OHIF
```

**Verify Math:**
```
DICOM = inv(rMd) @ Register
X: 75.2 - 50  = 25.2  ✅
Y: 0.1  + 30  = 30.1  ✅
Z: -20.0 - 10 = -30.0 ✅
```

---

## Check Status

```javascript
const status = window.__navigationController.getStatus();
console.log(JSON.stringify(status, null, 2));
```

**Expected:**
```json
{
  "navigating": true,
  "updateCount": 123,
  "targetFPS": 25,
  "actualFPS": 24.9,
  "transformation": {
    "loaded": true,
    "isIdentity": false,
    "rMd": [[1,0,0,50], [0,1,0,-30], [0,0,1,10], [0,0,0,1]],
    "invRMd": [[1,0,0,-50], [0,1,0,30], [0,0,1,-10], [0,0,0,1]]
  }
}
```

---

## Stop Navigation

```javascript
window.__commandsManager.run({ commandName: 'stopNavigation' });
```

---

## Full Test Suite

```javascript
// Run complete test suite (copy/paste entire block)
(async function() {
  const controller = window.__navigationController;

  // Test 1: Identity
  controller.loadTransformation([[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]);
  console.assert(controller.getStatus().transformation.isIdentity, 'Identity test');

  // Test 2: Translation
  controller.loadTransformation([[1,0,0,50],[0,1,0,-30],[0,0,1,10],[0,0,0,1]]);
  console.assert(!controller.getStatus().transformation.isIdentity, 'Translation test');

  // Test 3: Clear
  controller.clearTransformation();
  console.assert(!controller.getStatus().transformation.loaded, 'Clear test');

  console.log('✅ All tests passed!');
})();
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `__navigationController is undefined` | Navigation not started yet - start navigation first |
| Transformation not applied | Call `loadTransformation()` BEFORE `startNavigation()` |
| Console shows error | Check matrix is valid 4x4 with finite numbers |
| Crosshair doesn't move | Check Python simulator and API are running |

---

**Quick Links:**
- Full Testing Guide: `PHASE3_TESTING_GUIDE.md`
- Implementation Docs: `PHASE3_COORDINATE_TRANSFORMATION.md`
- Throttling Info: `THROTTLING_EXPLANATION.md`
