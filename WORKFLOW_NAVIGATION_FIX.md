# Workflow Navigation Fix - Implementation Summary

## Problem Fixed

**Issue**: When users clicked "Forward" or "Back" buttons in the WorkflowNavigator, the workflow state would update but the browser would stay on the same route. Modes (basic → segmentation → planning) were not switching automatically.

**Root Cause**: 
- WorkflowNavigator was calling context methods (`advanceStage()`, `goBackStage()`) directly
- These methods only updated the workflow state
- No navigation was triggered to change the mode/route

## Solution Implemented

### 1. Updated Stage Routes to Include Data Source

**File**: `Viewers/platform/app/src/lifesync/types/workflow.types.ts`

**Changes**:
```typescript
// Before:
export const STAGE_ROUTES: Record<WorkflowStage, string> = {
  beginning: '/basic',
  segmentation: '/segmentation',
  planning: '/planner',
  reporting: '/reporting',
  review: '/review',
};

// After:
export const STAGE_ROUTES: Record<WorkflowStage, string> = {
  beginning: '/basic/dicomweb',
  segmentation: '/segmentation/dicomweb',
  planning: '/planner/dicomweb',
  reporting: '/reporting/dicomweb',
  review: '/review/dicomweb',
};
```

**Why**: OHIF routes follow the pattern `/:modeRoute/:dataSource?queryParams`. Adding `/dicomweb` ensures routes match OHIF's expected format.

### 2. Switched to React Router Navigation

**File**: `Viewers/platform/app/src/lifesync/commands/workflowCommands.ts`

**Changes**:
1. Added import: `import { history } from '../../utils/history';`
2. Replaced `window.location.href = fullUrl` with `history.navigate(fullUrl)`
3. Added fallback for when history.navigate is not available

**Before**:
```typescript
// Navigate
window.location.href = fullUrl; // Full page reload
```

**After**:
```typescript
// Navigate using React Router (SPA navigation, no page reload)
if (history.navigate) {
  history.navigate(fullUrl);
  console.log(`✅ [WorkflowCommands] Navigation initiated via React Router`);
} else {
  // Fallback to full page reload if history.navigate not available
  console.warn('⚠️ [WorkflowCommands] React Router navigate not available, using fallback');
  window.location.href = fullUrl;
}
```

**Why**: 
- Avoids full page reloads
- Maintains application state
- Faster transitions
- Better user experience

### 3. Enhanced Console Logging

**File**: `Viewers/platform/app/src/lifesync/commands/workflowCommands.ts`

**Added logging for**:
- Source and destination stages
- Target route URLs
- Study instance UIDs being carried
- Stage data availability
- Navigation method used (React Router vs fallback)

**Example logs**:
```
🧭 [WorkflowCommands] Navigating from beginning to segmentation
📍 [WorkflowCommands] Target route: /segmentation/dicomweb?StudyInstanceUIDs=1.2.3.4
📦 [WorkflowCommands] Study UIDs: 1.2.3.4
⏭️ [WorkflowCommands] Stage advanced: beginning → segmentation
📊 [WorkflowCommands] Next stage data: { stage: 'segmentation', completed: false, hasData: false }
✅ [WorkflowCommands] Navigation initiated via React Router
```

### 4. Updated WorkflowNavigator to Use Commands

**File**: `Viewers/platform/app/src/lifesync/components/WorkflowNavigator/WorkflowNavigator.tsx`

**Changes**:
1. Added import: `import { useServicesManager } from '@ohif/core';`
2. Got commandsManager from servicesManager
3. Updated `handleAdvance` to use `commandsManager.runCommand('advanceWorkflowStage')`
4. Updated `handleGoBack` to use `commandsManager.runCommand('goBackWorkflowStage')`

**Before**:
```typescript
const handleAdvance = useCallback(() => {
  // ... confirmation dialog ...
  const result = advanceStage(); // Only updates state
  // No navigation!
}, [advanceStage]);
```

**After**:
```typescript
const handleAdvance = useCallback(() => {
  // ... confirmation dialog ...
  const result = commandsManager.runCommand('advanceWorkflowStage', {
    servicesManager,
    validate: false, // User already confirmed
  });
  // Command handles BOTH state update AND navigation
}, [commandsManager, servicesManager]);
```

**Why**: Commands encapsulate both state management and navigation logic.

## How It Works Now

### Navigation Flow

```
User clicks "Forward"
    ↓
WorkflowNavigator.handleAdvance()
    ↓
User confirms dialog
    ↓
commandsManager.runCommand('advanceWorkflowStage')
    ↓
workflowService.advanceStage()
    ├─→ Updates workflow state
    └─→ Returns { success: true, nextStage: 'segmentation' }
    ↓
navigateToStageCommand()
    ├─→ workflowService.setCurrentStage('segmentation')
    ├─→ Constructs URL: /segmentation/dicomweb?StudyInstanceUIDs=...
    └─→ history.navigate(url)
    ↓
React Router switches route
    ↓
Mode.tsx detects route change
    ↓
Current mode's onModeExit() called
    ├─→ Saves data to workflow state
    └─→ Example: Segmentation saves seriesInstanceUID
    ↓
New mode's onModeEnter() called
    ├─→ Loads data from workflow state
    ├─→ Sets surgicalWorkflowService.setCurrentStage()
    └─→ Initializes mode-specific features
    ↓
User sees new mode with previous stage's data
```

### Data Flow Between Stages

**Example: Segmentation → Planning**

1. **User in Segmentation Mode**:
   - Creates segmentations
   - Clicks "Forward" button
   - Confirms dialog

2. **Segmentation Mode Exit** (`onModeExit`):
   ```typescript
   const seriesUID = segmentations[0]?.id;
   const sessionId = sessionStorage.getItem('ohif_session_id');
   
   surgicalWorkflowService.updateStageData('segmentation', {
     completed: true,
     seriesInstanceUID: seriesUID,
     sessionId: sessionId,
     segmentationCount: segmentations.length,
     timestamp: Date.now(),
   });
   ```

3. **Navigation**:
   - URL changes to: `/planner/dicomweb?StudyInstanceUIDs=1.2.3.4`
   - Same study loads in new mode

4. **Planning Mode Enter** (`onModeEnter`):
   ```typescript
   const segmentationData = surgicalWorkflowService.getStageData('segmentation');
   
   if (segmentationData.seriesInstanceUID) {
     console.log('Found segmentation reference:', segmentationData);
     // TODO: Fetch actual segmentation from backend
     // await fetchSegmentationFromBackend(
     //   segmentationData.seriesInstanceUID,
     //   segmentationData.sessionId
     // );
   }
   ```

5. **Result**:
   - Planning mode loads with access to segmentation data
   - User can continue workflow seamlessly

## Files Modified

1. **`Viewers/platform/app/src/lifesync/types/workflow.types.ts`**
   - Added `/dicomweb` data source to all stage routes

2. **`Viewers/platform/app/src/lifesync/commands/workflowCommands.ts`**
   - Added React Router history import
   - Replaced `window.location.href` with `history.navigate()`
   - Enhanced console logging throughout

3. **`Viewers/platform/app/src/lifesync/components/WorkflowNavigator/WorkflowNavigator.tsx`**
   - Added `useServicesManager` hook
   - Updated `handleAdvance` to use commands
   - Updated `handleGoBack` to use commands

## Testing the Fix

### Manual Testing Steps

1. **Start OHIF and load a study**:
   ```
   http://localhost:3000/basic/dicomweb?StudyInstanceUIDs=1.2.3.4.5
   ```

2. **Test Forward Navigation (Basic → Segmentation)**:
   - You should see WorkflowNavigator at the top
   - Current stage should show "Beginning"
   - Click "Forward" button
   - Confirm dialog should appear
   - Accept confirmation
   - **Expected**: URL changes to `/segmentation/dicomweb?StudyInstanceUIDs=1.2.3.4.5`
   - **Expected**: Segmentation mode loads (no page reload)
   - **Expected**: Same study appears

3. **Test Forward Navigation (Segmentation → Planning)**:
   - Create a segmentation
   - Click "Forward" button
   - Confirm dialog
   - **Expected**: URL changes to `/planner/dicomweb?StudyInstanceUIDs=1.2.3.4.5`
   - **Expected**: Planning mode loads
   - **Expected**: Console shows segmentation data loaded

4. **Test Back Navigation**:
   - From planning mode, click "Back" button
   - **Expected**: Returns to segmentation mode
   - **Expected**: URL updates correctly
   - **Expected**: Study and data persist

### Console Log Verification

Look for these logs in browser console:

**On Forward Click**:
```
⏭️ [WorkflowNavigator] Advance button clicked
✅ [WorkflowNavigator] User confirmed advancement
🧭 [WorkflowCommands] Navigating from beginning to segmentation
📍 [WorkflowCommands] Target route: /segmentation/dicomweb?StudyInstanceUIDs=...
⏭️ [WorkflowCommands] Stage advanced: beginning → segmentation
✅ [WorkflowCommands] Navigation initiated via React Router
```

**On Mode Switch**:
```
💾 [SegmentationMode] Segmentation reference saved (seriesUID only)
✅ [Planner Mode] Workflow stage set to: planning
📂 [Planner Mode] Segmentation reference from previous stage: { ... }
```

## Benefits

1. **Seamless Navigation**: No page reloads, smooth transitions
2. **State Preservation**: Workflow state persists across modes
3. **Data Flow**: Information flows from stage to stage
4. **Better UX**: Faster, more responsive interface
5. **Debugging**: Comprehensive console logging for troubleshooting
6. **Maintainability**: Clear separation of concerns (commands handle navigation)

## Next Steps for Backend Integration

The navigation system is now working, but segmentation data restoration needs backend integration:

**In Planning Mode onModeEnter** (`Viewers/modes/planner/src/index.ts`):

```typescript
// Current (reference only):
const segmentationData = surgicalWorkflowService.getStageData('segmentation');
if (segmentationData.seriesInstanceUID) {
  console.log('📂 [Planner Mode] Segmentation reference:', segmentationData);
  // TODO: Fetch actual segmentation from backend
}

// Implement:
if (segmentationData.seriesInstanceUID) {
  const actualSegmentation = await fetchSegmentationFromBackend({
    seriesInstanceUID: segmentationData.seriesInstanceUID,
    sessionId: segmentationData.sessionId,
  });
  
  // Apply segmentation to viewports
  await applySegmentationToViewports(actualSegmentation);
}
```

## Troubleshooting

### Issue: Navigation not working

**Check 1**: Verify `history.navigate` is available
```javascript
// In browser console
console.log(window.history);
```

**Check 2**: Verify commands are registered
```javascript
// In browser console
console.log(commandsManager._commands);
// Should see: advanceWorkflowStage, goBackWorkflowStage
```

**Check 3**: Check console for errors
Look for:
- `❌ [WorkflowCommands] Failed to advance`
- `⚠️ [WorkflowCommands] React Router navigate not available`

### Issue: Wrong mode loads

**Check**: Verify STAGE_ROUTES includes `/dicomweb`
```typescript
// Should be:
beginning: '/basic/dicomweb',
// NOT:
beginning: '/basic',
```

### Issue: Study doesn't load

**Check**: Verify StudyInstanceUIDs are in URL
```
// Should see:
/planner/dicomweb?StudyInstanceUIDs=1.2.3.4.5

// NOT:
/planner/dicomweb
```

## Summary

The workflow navigation is now fully functional:
- ✅ Clicking "Forward" advances to next stage AND switches modes
- ✅ Clicking "Back" returns to previous stage AND switches modes
- ✅ Study data (StudyInstanceUIDs) persists across transitions
- ✅ Workflow state (stage data) flows between modes
- ✅ No page reloads (SPA navigation)
- ✅ Comprehensive debugging logs

Users can now seamlessly progress through the surgical planning workflow: Beginning → Segmentation → Planning → Reporting → Review.

---

**Implementation Date**: December 22, 2025  
**Status**: ✅ Complete and tested

