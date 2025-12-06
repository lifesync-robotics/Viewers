# Testing Checklist for Matrix Multiplication Order Fix

## What Was Fixed
**CRITICAL BUG**: Matrix multiplication order was incorrect in `TrackingService.ts` line 778.
- This caused **orientation errors** in both 2D and 3D tracking visualizations
- Position appeared correct, but rotation was completely wrong

## What Should Work Now

### 1. Physical Tool Movement → Model Movement (DICOM LPS Coordinates)

Test by moving the NDI tracked tool and observing the 3D model:

#### X-axis (Left-Right in DICOM LPS)
- **Physical**: Move tool from **patient's right** → **patient's left**
- **Expected 3D model**: Moves in **+X direction** (left in LPS)
- **Expected 2D axial view**: Moves **left** on screen
- **Expected 2D coronal view**: Moves **left** on screen
- **Expected 2D sagittal view**: Moves **into the page**

#### Y-axis (Posterior-Anterior in DICOM LPS)  
- **Physical**: Move tool from **patient's back** → **patient's front**
- **Expected 3D model**: Moves in **+Y direction** (anterior in LPS)
- **Expected 2D axial view**: Moves **up** on screen
- **Expected 2D coronal view**: Moves **into the page**
- **Expected 2D sagittal view**: Moves **up** on screen

#### Z-axis (Inferior-Superior in DICOM LPS)
- **Physical**: Move tool from **patient's head** → **patient's foot**
- **Expected 3D model**: Moves in **-Z direction** (inferior in LPS)
- **Expected 2D axial view**: Slice number **decreases**
- **Expected 2D coronal view**: Moves **down** on screen
- **Expected 2D sagittal view**: Moves **down** on screen

### 2. Tool Orientation → Model Orientation

#### Test 1: Tool Flat (Horizontal)
- **Physical**: Lay the tool flat on the table
- **Expected 3D model**: Should be **horizontal** (not upright, not upside-down)
- **Expected 2D projections**: Tool axis should align with scan plane when appropriate

#### Test 2: Tool Upright (Vertical)
- **Physical**: Hold the tool vertically upright
- **Expected 3D model**: Should be **vertical upright** (same orientation)
- **Expected 2D projections**: Tool should appear as a point in axial view, full length in sagittal/coronal

#### Test 3: Tool Rotation
- **Physical**: Rotate the tool 90° around its long axis (roll)
- **Expected 3D model**: Should rotate **exactly 90°** in the same direction
- **Expected 2D projections**: Cross-section should rotate accordingly

### 3. Specific Test Cases

#### Test Case 1: Axial View (Looking Down from Head)
1. Place tool at patient's right side
2. **2D projection should show**: Tool on the right side of the image
3. **Tool orientation marker** should point in the correct direction
4. Rotate tool → orientation marker rotates correspondingly

#### Test Case 2: Sagittal View (Looking from Patient's Right)
1. Place tool at patient's back
2. **2D projection should show**: Tool at the back (posterior) of the image
3. **Tool orientation marker** should point in the correct direction
4. Move tool anterior → marker moves forward in the image

#### Test Case 3: Coronal View (Looking from Patient's Feet)
1. Place tool at patient's left side
2. **2D projection should show**: Tool on the left side of the image
3. **Tool orientation marker** should point in the correct direction
4. Move tool superior → marker moves up in the image

### 4. Calibration Verification

The calibration matrix (DR-VR06-A32) has these characteristics:
```
[-1,  0,  0, -17.08]  ← Flips X, offset -17.08mm
[ 0,  1,  0,   0.10]  ← Keeps Y, offset +0.10mm
[ 0,  0, -1,-157.82]  ← Flips Z, offset -157.82mm
[ 0,  0,  0,   1.00]
```

This means:
- The marker array center is **17.08mm to the right** of the tooltip
- The marker array center is **0.10mm behind** the tooltip
- The marker array center is **157.82mm above** the tooltip

**Expected**: When you hold the tool, the 3D model tip should be **157.82mm below** the physical marker array (this is the stylus length).

### 5. Cross-View Consistency

All three 2D views plus the 3D view should show:
- **Same position** (in their respective coordinate systems)
- **Consistent orientation** (when you rotate the tool, all views should show the rotation)
- **Synchronized movement** (no lag or mismatch between views)

## What to Report

If any test fails, please report:
1. **Which test case** failed
2. **Physical tool position/orientation** (describe in words)
3. **Expected result** (what should happen)
4. **Actual result** (what actually happened)
5. **Screenshots or screen recording** if possible

## Success Criteria

✅ **All movements** match between physical tool and virtual model  
✅ **All orientations** match between physical tool and virtual model  
✅ **2D projections** show correct position AND orientation  
✅ **3D model** shows correct position AND orientation  
✅ **No axis swaps** (head→foot doesn't move up→down)  
✅ **No axis flips** (left→right doesn't move right→left)  
✅ **No rotation offsets** (flat tool shows flat model)

## Debug Information

If issues persist, check the browser console for matrix debug logs. The system now logs the transformation matrices to help diagnose any remaining issues.

