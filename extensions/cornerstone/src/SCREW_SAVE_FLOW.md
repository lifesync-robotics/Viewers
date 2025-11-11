# Screw Save Flow - Load Model First, Then Save

## Updated Flow (NEW)

When the user clicks **"Save Screw Placement"**, the system now:

### Step 1: Load and Position Model
```
1. Clear any existing models from the scene
2. Query model server for model with specified radius/length
3. Load the model into the 3D viewport
4. Apply the transform matrix to position the model
```

### Step 2: Save Snapshot
```
5. Capture current viewport states (camera positions, etc.)
6. Save snapshot with:
   - Viewport states
   - Radius and length
   - Transform matrix
   - Screw name and timestamp
```

---

## Why This Change?

### Before (OLD)
- **Save:** Only saved viewport states + dimensions
- **Load:** Loaded and positioned the model when restoring

**Problem:** The model was NOT visible when saving, only when restoring.

### After (NEW)
- **Save:** Loads and positions the model FIRST, then saves
- **Load:** Loads and positions the model (same as before)

**Benefit:** You see the positioned model immediately when saving, matching what you'll see when restoring!

---

## Code Changes

### 1. ScrewManagementPanel.tsx

**Changed `saveScrew` to async and added model loading:**

```typescript
const saveScrew = async () => {
  try {
    // ... validate inputs ...

    // Construct transform matrix from viewport cameras and crosshair center
    const transformMatrix = constructScrewTransform();
    const transform = transformMatrix ? Array.from(transformMatrix) : [];

    // ═════════════════════════════════════════════════════════
    // STEP 1: Load and position the model BEFORE saving
    // ═════════════════════════════════════════════════════════
    console.log('🔧 [ScrewManagement] LOADING MODEL BEFORE SAVE');

    // Clear existing models
    const existingModels = modelStateService.getAllModels();
    for (const model of existingModels) {
      modelStateService.removeModel(model.metadata.id);
    }

    // Query and load the model (same as restore does)
    await viewportStateService.queryAndLoadModel(
      finalRadiusValue,
      finalLengthValue,
      transform
    );

    // ═════════════════════════════════════════════════════════
    // STEP 2: Save the screw snapshot
    // ═════════════════════════════════════════════════════════
    const screw = viewportStateService.saveSnapshot(
      name,
      finalRadiusValue,
      finalLengthValue,
      transform
    );

    console.log(`✅ Saved screw: "${screw.name}"`);

  } catch (error) {
    console.error('Failed to save screw:', error);
  }
};
```

### 2. ViewportStateService.ts

**Made `_queryAndLoadModel` public:**

```typescript
// Before: private async _queryAndLoadModel(...)
// After:  public async queryAndLoadModel(...)

/**
 * Query model server for a model with specific radius and length, then load it
 * This is a public method that can be called from external components
 */
public async queryAndLoadModel(
  radius: number,
  length: number,
  transform?: number[] | number[][]
): Promise<void> {
  // ... query server ...
  // ... load model ...
  // ... apply transform ...
}
```

---

## Execution Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  User Clicks "Save Screw Placement"                         │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  Validate Inputs (radius, length)                           │
│  • Use defaults (3.5mm, 40mm) if invalid                    │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  Construct Transform Matrix                                 │
│  • Get axial, coronal, sagittal camera normals              │
│  • Get crosshair center position                            │
│  • Build 4x4 transform matrix                               │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: Load Model (NEW!)                                  │
│  ───────────────────────────────────────────────────────    │
│  1. Clear existing models                                   │
│  2. Query model server:                                     │
│     GET /api/models/query?radius=3.5&length=40              │
│  3. Load model from URL:                                    │
│     - Creates OBJ reader and actor                          │
│     - Adds to 3D viewport                                   │
│  4. Apply transform to position model:                      │
│     - Uses setModelTransform()                              │
│     - Model now visible and positioned correctly            │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: Save Snapshot                                      │
│  ───────────────────────────────────────────────────────    │
│  1. Capture viewport states (cameras, zoom, pan)            │
│  2. Save to snapshot with:                                  │
│     - name                                                  │
│     - radius, length                                        │
│     - transform matrix                                      │
│     - timestamp                                             │
│  3. Store in localStorage                                   │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  ✅ Complete!                                               │
│  • Model is visible and positioned in 3D view               │
│  • Snapshot saved with all necessary data                   │
│  • Ready to restore later                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Restore Flow (UNCHANGED)

When clicking **"Load"** on a saved screw:

```
1. Restore viewport states (cameras, zoom, pan)
2. Query model server for model with saved radius/length
3. Load the model into the 3D viewport
4. Apply the saved transform matrix to position the model
```

This is exactly the same as Step 1 in the save flow!

---

## Benefits

### 1. **Immediate Visual Feedback**
- See the positioned screw model as soon as you click "Save"
- No need to restore to see if it's positioned correctly

### 2. **Consistency**
- Save and Load use the same model loading logic
- What you see when saving is what you get when restoring

### 3. **Better UX**
- User can visually verify the screw position before saving
- Can adjust and re-save if needed
- Less guesswork

### 4. **Debugging**
- Easier to debug transform issues
- Can see immediately if model fails to load
- Console logs show the entire process

---

## Error Handling

If model loading fails during save:

```typescript
try {
  await viewportStateService.queryAndLoadModel(radius, length, transform);
  console.log('✅ Model loaded and positioned successfully');
} catch (modelError) {
  console.warn('⚠️ Could not load model before saving:', modelError.message);
  console.warn('⚠️ Continuing with save anyway...');
}
```

The snapshot is still saved even if model loading fails, ensuring data isn't lost.

---

## Testing Checklist

- [ ] Save a screw with valid radius/length → Model appears immediately
- [ ] Save a screw with default values (no input) → Model appears with 3.5mm/40mm
- [ ] Save multiple screws → Each clears previous model and loads new one
- [ ] Load a saved screw → Model appears in same position as when saved
- [ ] Save with crosshairs disabled → Saves without transform, model loads but not positioned
- [ ] Save with invalid model dimensions → Error logged, snapshot still saved

---

## Technical Notes

### Model Loading Process

1. **Query Server**
   ```javascript
   GET /api/models/query?radius=3.5&length=40
   ```
   Returns: `{ success: true, model: { url, filename, radius, length } }`

2. **Load Model**
   ```javascript
   modelStateService.loadModelFromServer(url, {
     viewportId: '3d-viewport',
     color: [1.0, 0.84, 0.0],  // Gold
     opacity: 0.9
   })
   ```

3. **Apply Transform**
   ```javascript
   modelStateService.setModelTransform(modelId, transformMatrix)
   ```

### Transform Matrix Structure

4x4 matrix (row-major order):
```
[
  axialNormal[0],   coronalNormal[0],  sagittalNormal[0],  translation[0],
  axialNormal[1],   coronalNormal[1],  sagittalNormal[1],  translation[1],
  axialNormal[2],   coronalNormal[2],  sagittalNormal[2],  translation[2],
  0,                0,                  0,                  1
]
```

Where:
- **Column 0:** Axial plane normal (X-axis of screw)
- **Column 1:** Coronal plane normal (Y-axis of screw, negated)
- **Column 2:** Sagittal plane normal (Z-axis of screw)
- **Column 3:** Crosshair center (translation/position)

---

## Summary

✅ **Models are now loaded and positioned BEFORE saving**
✅ **Users see immediate visual feedback**
✅ **Consistent behavior between save and restore**
✅ **Better debugging and error handling**
