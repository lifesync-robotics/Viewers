# ModelUpload Button Fix for Segmentation Mode

## Issue

After inheriting toolbar buttons from the basic mode, the segmentation mode was missing the "Upload 3D Model" button in its toolbar.

## Root Cause

The segmentation mode has **two separate configurations** that work together:

1. **Toolbar Buttons** (`toolbarButtons.ts`) - Defines available buttons
2. **Toolbar Sections** (`index.tsx` -> `onModeEnter`) - Configures which buttons appear in which sections

### What Was Happening:

✅ **Toolbar Buttons**: Successfully inherited from basic mode (including `ModelUpload` button definition)  
❌ **Toolbar Sections**: `ModelUpload` was NOT included in the `primary` section configuration

### Why Planner Mode Worked:

The planner mode works differently:

```typescript
// Planner mode extends the ENTIRE basic mode
const mode = {
  ...basicMode,  // <-- Inherits ALL configuration including toolbar sections
  id,
  modeInstance,
  extensionDependencies,
};
```

The segmentation mode only imports toolbar buttons and manually defines its sections:

```typescript
// Segmentation mode only imports buttons
import toolbarButtons from './toolbarButtons';

// Then manually defines which buttons appear in which sections
toolbarService.updateSection(toolbarService.sections.primary, [
  'WindowLevel',
  'Pan',
  // ... manual list
]);
```

## Solution

Added `ModelUpload` to the primary toolbar section in `src/index.tsx`:

```typescript
toolbarService.updateSection(toolbarService.sections.primary, [
  'WindowLevel',
  'Pan',
  'Zoom',
  'TrackballRotate',
  'Capture',
  'ModelUpload',  // <-- ADDED THIS
  'Layout',
  'Crosshairs',
  'MoreTools',
]);
```

## Files Modified

- `Viewers/modes/segmentation/src/index.tsx` (Line 118)

## Verification

To verify the fix works:

1. Navigate to segmentation mode
2. Check the primary toolbar (top toolbar)
3. Verify "Upload 3D Model" button is present (Upload icon)
4. Click the button to ensure it opens the model upload modal

## Understanding OHIF Toolbar Architecture

### Two-Step Toolbar Configuration:

#### Step 1: Register Buttons (What buttons exist)
```typescript
// Define buttons with their behavior
const toolbarButtons: Button[] = [
  {
    id: 'ModelUpload',
    uiType: 'ohif.toolButton',
    props: {
      icon: 'Upload',
      label: 'Upload 3D Models',
      commands: 'showModelUploadModal',
    },
  },
  // ... more buttons
];

// Register them with the toolbar service
toolbarService.register(toolbarButtons);
```

#### Step 2: Configure Sections (Where buttons appear)
```typescript
// Tell the toolbar which buttons to show in which section
toolbarService.updateSection(toolbarService.sections.primary, [
  'ModelUpload',  // Reference the button ID
  'Zoom',
  'Pan',
  // ... other button IDs
]);
```

### Common Pitfall:

Having a button definition doesn't mean it will appear in the UI. You must:
1. ✅ Define/import the button
2. ✅ Register the button with `toolbarService.register()`
3. ✅ Include the button ID in a section via `toolbarService.updateSection()`

## Related Documentation

- Toolbar inheritance explanation: `TOOLBAR_INHERITANCE_SUMMARY.md`
- Basic mode toolbar buttons: `Viewers/modes/basic/src/toolbarButtons.ts`
- Basic mode toolbar sections: `Viewers/modes/basic/src/index.tsx` (lines 255-327)

## Future Improvements

Consider creating a helper function or configuration object to easily inherit toolbar sections from basic mode:

```typescript
import { toolbarSections as basicToolbarSections } from '@ohif/mode-basic';

// Extend basic sections with segmentation-specific additions
const segmentationToolbarSections = {
  ...basicToolbarSections,
  [TOOLBAR_SECTIONS.primary]: [
    ...basicToolbarSections[TOOLBAR_SECTIONS.primary],
    // Add segmentation-specific buttons if needed
  ],
  // Add segmentation-specific sections
  [TOOLBAR_SECTIONS.labelMapSegmentationToolbox]: ['LabelMapTools'],
  [TOOLBAR_SECTIONS.contourSegmentationToolbox]: ['ContourTools'],
};
```

This would ensure any future additions to basic mode's toolbar automatically appear in segmentation mode.

