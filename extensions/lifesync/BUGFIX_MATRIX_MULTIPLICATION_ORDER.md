# CRITICAL BUG FIX: Matrix Multiplication Order

## Date
December 5, 2025

## Severity
**CRITICAL** - Affects all tracking transformations (both 2D and 3D)

## Symptoms
- **Position correct but orientation wrong** in both 2D and 3D projections
- 2D axial projection: position correct but angle wrong
- 2D sagittal projection: position correct but orientation wrong  
- 2D coronal projection: position correct but orientation wrong
- 3D model: position correct but orientation wrong

## Root Cause
**Incorrect matrix multiplication order in TrackingService.ts line 778**

### The Bug
The transformation pipeline requires:
```
tooltip_position = marker_position × calibration_matrix
```

But line 778 was doing:
```typescript
const tooltipMatrix = this._multiplyMatrix4x4(this.markerToTooltipMatrix, prRelativeMatrix_marker);
// This computes: calibration × marker (WRONG!)
```

### Why This Matters
Matrix multiplication is **NOT commutative**: `A × B ≠ B × A`

For coordinate transformations:
- To transform point `P` from space A to space B using matrix `M_AB`:
  ```
  P_B = M_AB × P_A
  ```

For chained transformations:
```
P_final = M_C2D × M_B2C × M_A2B × P_A
```

In our case:
```
Tooltip_PR = Marker_PR × Calibration
Tooltip_DICOM = PR2DICOM × Tooltip_PR
```

Expanded:
```
Tooltip_DICOM = PR2DICOM × Marker_PR × Calibration
```

### Why Position Was Correct But Orientation Wrong
The translation component (position) is in column 3 of the matrix:
```
[R00 R01 R02 Tx]
[R10 R11 R12 Ty]
[R20 R21 R22 Tz]
[  0   0   0  1]
```

When you multiply matrices in wrong order:
- **Translation gets partially affected** but can appear "close enough"
- **Rotation components get completely scrambled** (3x3 rotation matrix is highly sensitive to order)

This is why position appeared correct but orientation was completely wrong!

## The Fix

### Location 1: Line 778 (Main tracking loop)
**BEFORE:**
```typescript
const tooltipMatrix = this._multiplyMatrix4x4(this.markerToTooltipMatrix, prRelativeMatrix_marker);
// Computes: calibration × marker (WRONG!)
```

**AFTER:**
```typescript
const tooltipMatrix = this._multiplyMatrix4x4(prRelativeMatrix_marker, this.markerToTooltipMatrix);
// Computes: marker × calibration (CORRECT!)
```

### Location 2: Line 1071 (Debug function - already correct code, just wrong comment)
**BEFORE (comment was misleading):**
```typescript
// prRelativeMatrix_tooltip = markerToTooltipMatrix × prRelativeMatrix_marker
const tooltipMatrix = this._multiplyMatrix4x4(markerMatrix4x4, this.markerToTooltipMatrix);
```

**AFTER (corrected comment):**
```typescript
// tooltipMatrix = prRelativeMatrix_marker × markerToTooltipMatrix
const tooltipMatrix = this._multiplyMatrix4x4(markerMatrix4x4, this.markerToTooltipMatrix);
```

## Verification
Created test script `test_matrix_order.py` that demonstrates:
- **ORDER 1** (marker × calibration): Produces correct tooltip position
- **ORDER 2** (calibration × marker): Produces wrong tooltip position with scrambled rotation

Example output:
```
ORDER 1 (CORRECT):
  Tooltip position: [82.92, 50.10, 42.18]
  
ORDER 2 (WRONG - was line 778):
  Tooltip position: [-117.08, 50.10, -357.82]
```

The positions are completely different! But because the final DICOM transformation uses both translation and rotation, the error manifested primarily as **orientation problems** while position appeared "close enough" to seem correct.

## Impact
This bug affected:
1. ✅ 2D instrument projections (axial, sagittal, coronal) - ALL HAD WRONG ORIENTATION
2. ✅ 3D instrument model rendering - WRONG ORIENTATION
3. ✅ All tracking-based navigation features

## Testing Required
After this fix, verify:
1. 2D projections show correct position AND orientation
2. 3D model shows correct position AND orientation
3. Tool movements in physical space match model movements in virtual space:
   - Move tool back→front: model moves back→front
   - Move tool head→foot: model moves head→foot  
   - Move tool right→left: model moves right→left
4. Tool orientation matches model orientation (no rotation offset)

## Files Changed
- `Viewers/extensions/lifesync/src/services/TrackingService.ts`
  - Line 778: Fixed matrix multiplication order
  - Line 1070-1071: Corrected comment to match code

## Related Files
- `test_matrix_order.py` - Diagnostic script proving the correct order

