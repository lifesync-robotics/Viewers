# WorkflowNavigator UI Integration Guide

## Overview
This document explains where the WorkflowNavigator UI is displayed and how to access it.

## Location

### Where is it displayed?
The **WorkflowNavigator** is now integrated into `Viewers/platform/app/src/routes/Mode/Mode.tsx` and will appear **at the top of every mode** (Basic, Segmentation, Planning, etc.) when the surgical workflow service is enabled.

### Visual Location
```
┌─────────────────────────────────────────────────────────────┐
│                    WorkflowNavigator                        │
│  [← Back: Beginning]  [Segmentation]  [Forward: Planning →] │
│                                                             │
│  ◉ Beginning  →  ● Segmentation  →  ○ Planning  →  ○ ...   │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    Main Viewer Area                         │
│              (OHIF Viewer / Viewports)                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Details

### File Modified
**`Viewers/platform/app/src/routes/Mode/Mode.tsx`**

### Changes Made

1. **Import Added (Line ~13):**
   ```tsx
   import { WorkflowNavigator } from '../../lifesync/components';
   ```

2. **Service Access Added (Line ~66):**
   ```tsx
   const {
     displaySetService,
     panelService,
     hangingProtocolService,
     userAuthenticationService,
     customizationService,
     surgicalWorkflowService,  // ← Added
   } = servicesManager.services;
   ```

3. **Console Logging Added (Line ~336):**
   ```tsx
   // Log workflow service availability
   if (surgicalWorkflowService) {
     console.log('✅ [ModeRoute] WorkflowNavigator will be displayed');
   } else {
     console.log('ℹ️ [ModeRoute] WorkflowNavigator hidden');
   }
   ```

4. **Render Added (Line ~364):**
   ```tsx
   return (
     <ImageViewerProvider StudyInstanceUIDs={studyInstanceUIDs}>
       {/* Workflow Navigator - Shows surgical workflow progress */}
       {surgicalWorkflowService && (
         <div className="workflow-navigator-container">
           <WorkflowNavigator />
         </div>
       )}
       
       {/* Rest of the viewer layout */}
       {CombinedExtensionsContextProvider ? (
         <CombinedExtensionsContextProvider>
           <DragAndDropProvider>{LayoutComponent}</DragAndDropProvider>
         </CombinedExtensionsContextProvider>
       ) : (
         <DragAndDropProvider>{LayoutComponent}</DragAndDropProvider>
       )}
     </ImageViewerProvider>
   );
   ```

## How to Access

### When You Open OHIF:

1. **Open any study in OHIF Viewer**
2. **The WorkflowNavigator will automatically appear at the top** of the screen
3. You'll see:
   - Current workflow stage highlighted
   - Back/Forward navigation buttons
   - Stage indicators showing progress
   - Info message when ready to advance

### In Different Modes:

- **Basic Mode (`/basic`)**: Shows "Beginning" stage
- **Segmentation Mode (`/segmentation`)**: Shows "Segmentation" stage
- **Planning Mode (`/planner`)**: Shows "Planning" stage

### Navigation:
- Click **"← Back"** to return to previous stage
- Click **"Forward →"** to advance (with confirmation dialog)
- Click on completed stage indicators to jump back to that stage

## Console Logs to Watch

When you load any mode, check the browser console for:

```
✅ [ModeRoute] WorkflowNavigator will be displayed (surgicalWorkflowService available)
🧭 [WorkflowNavigator] Rendering workflow navigator
✅ [WorkflowNavigator] Current stage: segmentation
```

If the WorkflowNavigator is not visible:
```
ℹ️ [ModeRoute] WorkflowNavigator hidden (surgicalWorkflowService not available)
⚠️ [App] WorkflowService not available - workflow features disabled
```

## Styling

The WorkflowNavigator has built-in Tailwind CSS classes:
- Dark theme (bg-gray-900)
- Responsive design
- Hover effects on buttons
- Stage progress indicators with colors:
  - 🟢 Green = Completed
  - 🔵 Blue = Active
  - ⚪ Gray = Pending

## Troubleshooting

### Issue: WorkflowNavigator not visible

**Check 1: Is WorkflowService registered?**
```javascript
// In browser console
console.log(servicesManager.services.surgicalWorkflowService);
// Should show an object, not undefined
```

**Check 2: Look for console logs**
```
Search console for: "[ModeRoute] WorkflowNavigator"
```

**Check 3: Is WorkflowProvider in App.tsx?**
```tsx
// App.tsx should have:
[WorkflowProvider, { service: surgicalWorkflowService }]
```

**Check 4: Is WorkflowService registered in appInit.js?**
```javascript
// appInit.js should have:
import { WorkflowService } from './lifesync/services';
servicesManager.registerServices([
  // ...
  WorkflowService.REGISTRATION,
]);
```

### Issue: Navigation buttons not working

**Check:** Look for error messages in console when clicking buttons:
```
❌ [WorkflowNavigator] Failed to advance: [error message]
```

**Solution:** Ensure WorkflowService methods are working:
```javascript
// In browser console
const ws = servicesManager.services.surgicalWorkflowService;
console.log(ws.getWorkflowState());
```

## Customization

### Hide in Specific Modes

If you want to hide the WorkflowNavigator in certain modes, you can add mode checks:

```tsx
// In Mode.tsx
const shouldShowWorkflow = surgicalWorkflowService && 
  mode.id !== 'viewer' && // Hide in basic viewer
  mode.id !== 'debug';    // Hide in debug mode

return (
  <ImageViewerProvider StudyInstanceUIDs={studyInstanceUIDs}>
    {shouldShowWorkflow && (
      <div className="workflow-navigator-container">
        <WorkflowNavigator />
      </div>
    )}
    {/* ... rest of layout */}
  </ImageViewerProvider>
);
```

### Compact Mode

For a smaller navigation bar, use the compact prop:

```tsx
<WorkflowNavigator compact={true} />
```

### Hide Stage List

To show only navigation buttons:

```tsx
<WorkflowNavigator showStageList={false} />
```

### Hide Navigation Buttons

To show only the stage progress:

```tsx
<WorkflowNavigator showNavButtons={false} />
```

## Next Steps

1. **Test the UI**: Open OHIF and verify the WorkflowNavigator appears at the top
2. **Test Navigation**: Click Forward/Back buttons and confirm dialog appears
3. **Test Stage Transitions**: Navigate between Basic → Segmentation → Planning
4. **Check Console Logs**: Verify all expected logs are appearing
5. **Style Adjustments**: Customize the appearance if needed

## Related Files

- Main Integration: `Viewers/platform/app/src/routes/Mode/Mode.tsx`
- Component: `Viewers/platform/app/src/lifesync/components/WorkflowNavigator/WorkflowNavigator.tsx`
- Context: `Viewers/platform/app/src/lifesync/contexts/WorkflowContext.tsx`
- Service: `Viewers/platform/app/src/lifesync/services/WorkflowService/WorkflowService.ts`

---

**Status:** ✅ Implemented  
**Date:** December 22, 2025  
**Location:** Top of all mode views

