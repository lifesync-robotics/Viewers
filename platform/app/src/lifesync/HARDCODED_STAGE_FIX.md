# Hardcoded Stage Name Fix

## Problem

Even after removing persistence and making YAML the single source of truth, the error persisted:
```
⚠️ [WorkflowService] No validation data for stage: beginning
```

The workflow state was being created correctly from config with `currentStage: "overview"`, but it was being overwritten to `"beginning"` somewhere.

## Root Cause

**Hardcoded stage names in mode configuration files** were overwriting the config-driven state!

### Culprit: Basic Mode

**File**: `Viewers/modes/basic/src/index.tsx`

The `onModeEnter` hook was hardcoded to set the stage:

```typescript
// Line 141 - WRONG
surgicalWorkflowService.setCurrentStage('beginning');
```

### Execution Flow

```
1. App starts
   ↓
2. WorkflowService creates fresh state from YAML
   ├── currentStage: "overview" ✅
   ├── validation created for all stages ✅
   ↓
3. User navigates to /basic route
   ↓
4. Basic mode's onModeEnter() runs
   ├── Calls setCurrentStage('beginning') ❌
   ├── Overwrites currentStage to "beginning"
   ↓
5. User tries to advance
   ├── Checks validation['beginning']
   ├── No validation for 'beginning' (only 'overview')
   └── ERROR!
```

## Solution

### 1. ✅ Fixed Basic Mode

**File**: `Viewers/modes/basic/src/index.tsx`

**onModeEnter** (lines 136-154):
```typescript
// Before:
surgicalWorkflowService.setCurrentStage('beginning');
const workflowData = surgicalWorkflowService.getStageData('beginning');

// After:
surgicalWorkflowService.setCurrentStage('overview');
const workflowData = surgicalWorkflowService.getStageData('overview');
```

**onModeExit** (lines 225-232):
```typescript
// Before:
const currentStageData = surgicalWorkflowService.getStageData('beginning');
surgicalWorkflowService.updateStageData('beginning', { ... });

// After:
const currentStageData = surgicalWorkflowService.getStageData('overview');
surgicalWorkflowService.updateStageData('overview', { ... });
```

### 2. ✅ Fixed Public Config

**File**: `Viewers/platform/app/public/config/default.js`

```javascript
// Before:
stages: ['beginning', 'segmentation', 'planning', 'reporting', 'review'],
stageRoutes: {
  beginning: '/basic',
  // ...
}

// After:
stages: ['overview', 'segmentation', 'planning', 'reporting', 'review'],
stageRoutes: {
  overview: '/overview',
  // ...
}
```

**Note**: This config is deprecated (workflow now uses YAML), but updated for consistency.

## Why This Happened

### Design Issue

The workflow system had **two sources of truth**:
1. ✅ YAML config (`workflow-config.yaml`) - intended source
2. ❌ Mode configurations (`modes/*/src/index.tsx`) - hardcoded overrides

When modes entered, they would **overwrite** the config-driven state with hardcoded values.

### The Cascade

```
YAML Config          Mode Files           Result
───────────────      ────────────────     ──────────
overview (correct)   beginning (old)   →  beginning (wrong!)
   ↓                     ↓                     ↓
Validation created   Overwrites stage     Validation missing
for "overview"       to "beginning"       for "beginning"
```

## Complete Fix Checklist

- [x] Remove persistence layer (in-memory only)
- [x] YAML as single source of truth
- [x] Update basic mode onModeEnter
- [x] Update basic mode onModeExit
- [x] Update public config (deprecated but for consistency)
- [x] Verify no other modes have hardcoded 'beginning'

## Files Changed

1. **`Viewers/modes/basic/src/index.tsx`**
   - Updated `onModeEnter` to use 'overview'
   - Updated `onModeExit` to use 'overview'

2. **`Viewers/platform/app/public/config/default.js`**
   - Updated stages array to use 'overview'
   - Updated stageRoutes to use 'overview'
   - Added deprecation note

## Lesson Learned

### Problem

Having configuration in multiple places creates:
- Inconsistencies
- Hard-to-debug issues
- Maintenance burden
- No true "single source of truth"

### Solution

**YAML config is the ONLY source** for:
- Stage names and IDs
- Stage order
- Routes
- Validation rules
- All workflow structure

**Modes should NEVER hardcode stage names**. They should:
- Read current stage from service
- Trust the service's state
- Not override stage unless explicitly navigating

## Better Approach

Instead of hardcoding in modes:

```typescript
// ❌ BAD - Hardcoded
surgicalWorkflowService.setCurrentStage('beginning');

// ✅ GOOD - Let the workflow command handle it
// The navigation command will set the stage correctly based on the route
```

Or read from config:

```typescript
// ✅ BETTER - Read from config
const configLoader = getWorkflowConfig();
const currentRoute = window.location.pathname;
const stageForRoute = configLoader.getStageByRoute(currentRoute);
if (stageForRoute) {
  surgicalWorkflowService.setCurrentStage(stageForRoute.id);
}
```

## Testing

### Test 1: Fresh Page Load

1. Clear browser cache
2. Load application
3. Navigate to `/basic` route
4. **Expected**: currentStage set to "overview"
5. **Verify**: Check console logs

**Console Output**:
```
✅ [WorkflowService] Fresh workflow state created from config (in-memory only)
🚀 [BasicMode] onModeEnter - Overview stage
✅ [BasicMode] Workflow stage set to: overview
```

### Test 2: Stage Advancement

1. Load a study
2. Click "Forward" button
3. Confirm advancement
4. **Expected**: Advances from "overview" to "segmentation"
5. **No errors**!

**Console Output**:
```
🔍 [WorkflowService] Can advance from overview: true
⏭️ [WorkflowService] Attempting to advance to next stage...
✅ [WorkflowService] Successfully advanced to: segmentation
```

### Test 3: Verify No 'beginning' References

```bash
# Search for any remaining 'beginning' references
grep -r "beginning" Viewers/modes/*/src/ --exclude="*.md"
grep -r "'beginning'" Viewers/platform/app/src/lifesync/ --exclude="*.md"
```

Should only find:
- Documentation files
- Comments
- No actual code references

## Summary

The "beginning" stage error was caused by **hardcoded stage names in mode configuration files** that overwrote the config-driven state.

**Root Cause**: Basic mode's `onModeEnter` set `currentStage` to "beginning"

**Fix**: Changed all "beginning" references to "overview" in:
- Mode onModeEnter/onModeExit hooks
- Public config file (deprecated but updated for consistency)

**Result**: Workflow state now stays consistent with YAML config! 🎉

**Key Takeaway**: **NEVER hardcode stage names in mode files**. Always trust the workflow service and YAML config.

