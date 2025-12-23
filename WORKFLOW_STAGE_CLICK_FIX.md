# Workflow Stage Click Navigation Fix

## Problem

When clicking on a stage indicator in the WorkflowNavigator, the stage state was updated but **navigation didn't happen** - no dialogue appeared, no mode switched, nothing happened visibly to the user.

**Console showed:**
```
🎯 [WorkflowWidget] Stage clicked: segmentation
```
But nothing else happened.

## Root Cause

The `handleStageClick` function in `WorkflowNavigator.tsx` was only calling:
```typescript
workflowService.setCurrentStage(stage as any);
```

This **only updates the workflow state** in memory, but doesn't:
- Navigate to the route (e.g., `/segmentation`)
- Switch to the corresponding mode
- Show the mode's UI/dialogue

## Solution

Changed `handleStageClick` to use `commandsManager.runCommand('navigateToStage', {...})` instead, which properly handles **both state update AND navigation**.

### Before (❌ Broken)

```typescript
const handleStageClick = useCallback((stage: string) => {
  console.log(`🎯 [WorkflowNavigator] Stage clicked: ${stage}`);
  
  // Only allow navigation to completed stages or current stage
  const stageIndex = STAGE_ORDER.indexOf(stage as any);
  const currentIndex = STAGE_ORDER.indexOf(currentStage);
  
  if (stageIndex > currentIndex) {
    console.warn('⚠️ [WorkflowNavigator] Cannot navigate to future stage');
    alert('Please complete current stage before advancing');
    return;
  }

  if (stage !== currentStage) {
    workflowService.setCurrentStage(stage as any);  // ❌ Only updates state
  }
}, [currentStage, workflowService]);
```

### After (✅ Fixed)

```typescript
const handleStageClick = useCallback((stage: string) => {
  console.log(`🎯 [WorkflowNavigator] Stage clicked: ${stage}`);
  
  // Only allow navigation to completed stages or current stage
  const stageIndex = STAGE_ORDER.indexOf(stage as any);
  const currentIndex = STAGE_ORDER.indexOf(currentStage);
  
  if (stageIndex > currentIndex) {
    console.warn('⚠️ [WorkflowNavigator] Cannot navigate to future stage');
    alert('Please complete current stage before advancing');
    return;
  }

  if (!servicesManager || !commandsManager) {
    console.error('❌ [WorkflowNavigator] servicesManager or commandsManager not available');
    alert('System not ready. Please try again.');
    return;
  }

  if (stage !== currentStage) {
    // ✅ Use command manager to navigate (handles both state update AND route navigation)
    try {
      const result = commandsManager.runCommand('navigateToStage', {
        stage,
        servicesManager,
        preserveQueryParams: true,
      });

      if (!result || !result.success) {
        console.error('❌ [WorkflowNavigator] Failed to navigate to stage:', result?.error);
        alert(`Failed to navigate: ${result?.error || 'Unknown error'}`);
        return;
      }

      console.log(`✅ [WorkflowNavigator] Successfully navigated to: ${stage}`);
    } catch (error) {
      console.error('❌ [WorkflowNavigator] Error during navigation:', error);
      alert(`Failed to navigate: ${error.message}`);
    }
  }
}, [currentStage, servicesManager, commandsManager]);
```

## What `navigateToStage` Command Does

From `workflowCommands.ts`:

```typescript
export function navigateToStageCommand({
  stage,
  studyInstanceUIDs,
  servicesManager,
  preserveQueryParams = true,
}) {
  console.log(`🧭 [WorkflowCommands] navigateToStage: ${stage}`);

  const workflowService = servicesManager.services.surgicalWorkflowService;
  
  // 1. Get route for stage
  const route = STAGE_ROUTES[stage];  // e.g., '/segmentation'
  
  // 2. Build URL with query parameters
  const params = new URLSearchParams();
  if (preserveQueryParams) {
    // Preserve caseId, StudyInstanceUIDs, etc.
  }
  
  // 3. Update workflow state
  workflowService.setCurrentStage(stage);
  
  // 4. Navigate to the route
  window.location.href = `${route}?${params.toString()}`;
  
  return { success: true, stage };
}
```

## Consistency with Other Navigation

Now all three navigation methods use `commandsManager.runCommand()`:

1. **Advance Button** → `commandsManager.runCommand('advanceWorkflowStage', {...})`
2. **Back Button** → `commandsManager.runCommand('goBackWorkflowStage', {...})`
3. **Stage Click** → `commandsManager.runCommand('navigateToStage', {...})`  ✅ Fixed

## Expected Behavior After Fix

When clicking on a stage indicator (e.g., "Segmentation"):

1. ✅ Console shows: `🎯 [WorkflowNavigator] Stage clicked: segmentation`
2. ✅ Console shows: `🧭 [WorkflowCommands] navigateToStage: segmentation`
3. ✅ Workflow state updates
4. ✅ Browser navigates to `/segmentation?caseId=...`
5. ✅ Segmentation mode loads
6. ✅ Mode UI/dialogue appears
7. ✅ Console shows: `✅ [WorkflowNavigator] Successfully navigated to: segmentation`

## Testing

Test clicking on different stages:
- [x] Click on completed stage → Should navigate successfully
- [x] Click on current stage → Should do nothing (already there)
- [x] Click on future stage → Should show alert "Please complete current stage before advancing"

---

**Date:** December 22, 2025
**Status:** ✅ Fixed
**File:** `Viewers/platform/app/src/lifesync/components/WorkflowNavigator/WorkflowNavigator.tsx`

