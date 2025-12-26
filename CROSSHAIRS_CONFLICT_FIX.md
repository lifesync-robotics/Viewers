# Crosshairs Viewport Camera Conflict Fix

## 🐛 The Mystery Bug

**Symptom:** When editing screws with `ScrewInteractionTool`, some screws had frozen viewports (correct behavior) while others had viewports that moved during drag (wrong behavior). Specifically:
- **Left screws**: Viewports frozen ✅
- **Right screws**: Viewports moving ❌

**Why it seemed screw-specific:** The behavior appeared to be tied to which screw was being edited, leading to suspicion of hardcoded logic.

## 🔍 Root Cause Discovery

The issue was NOT related to left vs right screws at all! The real culprit was the **Crosshairs tool**.

### What Was Happening

1. **User clicks "View" button** on a screw (e.g., right screw)
   - Centers crosshairs on that screw
   - Updates all viewport cameras to look at screw

2. **User edits the SAME screw** with `ScrewInteractionTool`
   - `ScrewInteractionTool` says: "Freeze all viewports during drag"
   - **Crosshairs tool** says: "My center point moved! Update all viewports in real-time!"
   - Result: Crosshairs **overrides** the freeze logic ❌

3. **User edits a DIFFERENT screw** (one without crosshairs centered on it)
   - `ScrewInteractionTool` says: "Freeze all viewports during drag"
   - Crosshairs tool: "Not my center point, I'll do nothing"
   - Result: Viewports actually freeze ✅

### The Conflict

```
Screw with Crosshairs Centered:
├─ User drags screw
├─ Screw position changes
├─ Crosshairs center point moves
├─ Crosshairs.onCameraModified() triggers
├─ All viewports update ❌ (fighting ScrewInteractionTool's freeze)
└─ Result: Viewports move during drag (wrong!)

Screw without Crosshairs Centered:
├─ User drags screw
├─ Screw position changes
├─ Crosshairs center point is elsewhere
├─ Crosshairs doesn't update viewports
└─ Result: Viewports stay frozen (correct!)
```

## ✅ The Solution

**Disable Crosshairs when ScrewInteractionTool is active**, then restore it when done.

### Implementation

#### 1. Added State Tracking

```typescript
// Store original crosshairs state for each tool group
private crosshairsOriginalState: Map<string, boolean> = new Map();
```

#### 2. Disable Crosshairs on Tool Activation

```typescript
onSetToolActive(): void {
  // Get all tool groups
  const allToolGroups = ToolGroupManager.getAllToolGroups();
  
  for (const toolGroup of allToolGroups) {
    const crosshairsTool = toolGroup.getToolInstance('Crosshairs');
    if (crosshairsTool) {
      // Store original state
      const wasActive = toolGroup.getToolOptions('Crosshairs')?.mode === 'Active';
      this.crosshairsOriginalState.set(toolGroup.id, wasActive);
      
      // Disable crosshairs
      toolGroup.setToolDisabled('Crosshairs');
    }
  }
}
```

#### 3. Restore Crosshairs on Tool Deactivation

```typescript
onSetToolDisabled(): void {
  const allToolGroups = ToolGroupManager.getAllToolGroups();
  
  for (const toolGroup of allToolGroups) {
    const crosshairsTool = toolGroup.getToolInstance('Crosshairs');
    if (crosshairsTool) {
      const wasActive = this.crosshairsOriginalState.get(toolGroup.id);
      
      if (wasActive) {
        toolGroup.setToolActive('Crosshairs');
      }
    }
  }
  
  this.crosshairsOriginalState.clear();
}
```

## 📊 Before vs After

### Before Fix

| Scenario | Crosshairs State | Viewport Behavior | Result |
|----------|-----------------|-------------------|--------|
| Edit screw with crosshairs on it | ✅ Active | ❌ Moving during drag | Wrong! |
| Edit screw without crosshairs | ✅ Active (elsewhere) | ✅ Frozen during drag | Correct (by luck) |

**Problem:** Inconsistent behavior depending on crosshairs position

### After Fix

| Scenario | Crosshairs State | Viewport Behavior | Result |
|----------|-----------------|-------------------|--------|
| Edit ANY screw | ⛔ **Disabled** | ✅ Frozen during drag | Correct! |
| After edit completes | ✅ **Restored** | ✅ Updates on mouse release | Correct! |

**Solution:** Consistent behavior for ALL screws

## 🎯 Key Insights

1. **Tool Conflicts Are Real**
   - Multiple Cornerstone tools can be active simultaneously
   - Each tool may have its own viewport update logic
   - Tools can unknowingly fight each other

2. **State Management Matters**
   - Store original state before making changes
   - Always restore state on cleanup
   - Use lifecycle hooks (`onSetToolActive`, `onSetToolDisabled`)

3. **Debug with Context**
   - The bug appeared screw-specific, but was actually crosshairs-position-specific
   - Understanding tool interactions is crucial
   - Always consider what OTHER active tools might be doing

## 🔍 Diagnostic Logging

Added `[VIEWPORT_DEBUG]` prefixed logs to track:

```javascript
// On tool activation
[VIEWPORT_DEBUG] 🔄 Disabling Crosshairs to prevent viewport camera conflicts...
[VIEWPORT_DEBUG]    ✅ Disabled Crosshairs in toolGroup: mpr (was: Active)
[VIEWPORT_DEBUG] ✅ Crosshairs disabled - viewport cameras will only update on mouse release

// On tool deactivation
[VIEWPORT_DEBUG] 🔄 Restoring Crosshairs to original state...
[VIEWPORT_DEBUG]    ✅ Restored Crosshairs to Active in toolGroup: mpr
[VIEWPORT_DEBUG] ✅ Crosshairs state restored
```

Filter console with: `VIEWPORT_DEBUG`

## 🧪 Testing Checklist

- [ ] Edit left screw → viewports frozen ✅
- [ ] Edit right screw → viewports frozen ✅
- [ ] Click "View" on screw A, then edit screw A → viewports frozen ✅
- [ ] Click "View" on screw A, then edit screw B → viewports frozen ✅
- [ ] After editing completes, crosshairs still work ✅
- [ ] Switch between screws multiple times → consistent behavior ✅
- [ ] Crosshairs functionality restored after tool deactivation ✅

## 📝 Summary

The "left vs right screw" bug was a **red herring**. The real issue was:

**Crosshairs tool was updating viewport cameras in real-time when its center point (the screw) moved, overriding ScrewInteractionTool's freeze logic.**

By **disabling Crosshairs during screw interactions** and **restoring it afterwards**, we ensure:

✅ Consistent frozen viewport behavior for ALL screws  
✅ No tool conflicts  
✅ Proper crosshairs functionality after interactions  
✅ Clean state management with proper restore  

This is a textbook example of how seemingly unrelated active tools can create subtle, intermittent bugs! 🎉

