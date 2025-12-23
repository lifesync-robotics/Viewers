# Clear Workflow State - Correct Instructions

## ⚠️ IMPORTANT: State is in sessionStorage, NOT localStorage!

The workflow state is persisted in **sessionStorage**, not localStorage.

## How to Clear State Properly

### Option 1: Browser Console (Quick)

```javascript
// Clear sessionStorage (where workflow state actually is)
sessionStorage.removeItem('ohif_surgical_workflow_state');

// Also clear the page load flag
sessionStorage.removeItem('ohif_workflow_page_load_flag');

// Reload
location.reload();
```

### Option 2: Clear All Session Storage

```javascript
// Nuclear option - clears everything
sessionStorage.clear();
location.reload();
```

### Option 3: Application Function

The app provides a utility function:

```javascript
// Import and use the built-in clear function
import { clearWorkflowState } from './lifesync/utils/workflowPersistence';

clearWorkflowState();
location.reload();
```

## Why This Matters

**sessionStorage** vs **localStorage**:
- **localStorage**: Persists across browser sessions (even after closing browser)
- **sessionStorage**: Clears when tab/browser is closed, but PERSISTS on page refresh

The workflow system uses **sessionStorage** because:
1. Workflow state should not persist across browser sessions
2. But should survive page refreshes within a session
3. Automatically clears when you close the browser

## Verify State is Cleared

After clearing, check in console:

```javascript
console.log('Session storage:', sessionStorage.getItem('ohif_surgical_workflow_state'));
// Should show: null
```

## Note About Page Refresh Detection

The system has automatic page refresh detection:
- On first page load → Sets a flag
- On page refresh → Clears workflow state automatically
- This prevents stale state after refresh

However, the flag detection might not work if you:
1. Clear localStorage but not sessionStorage
2. Use hard refresh (Ctrl+F5)
3. Open in new tab with same URL

## Current State Check

To see what's in your current state:

```javascript
const state = JSON.parse(sessionStorage.getItem('ohif_surgical_workflow_state'));
console.log('Current stage:', state?.state?.currentStage);
console.log('Full state:', state);
```

If you see `currentStage: "beginning"` - that's the problem!

## Solution Summary

```javascript
// 🔧 FIX: Clear sessionStorage (not localStorage!)
sessionStorage.removeItem('ohif_surgical_workflow_state');
sessionStorage.removeItem('ohif_workflow_page_load_flag');
location.reload();
```

Then check console - should see:
```
ℹ️ [WorkflowPersistence] No stored workflow state found
🏗️ [WorkflowService] Creating default workflow state from configuration
📋 [WorkflowService] Config loaded: 5 stages, initial stage: overview
✅ [WorkflowService] Service initialized: { currentStage: 'overview' }
```

No more "beginning" error! ✅

