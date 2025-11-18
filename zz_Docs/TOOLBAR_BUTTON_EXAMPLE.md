# Example: Adding Model Upload Button to Toolbar

## Quick Copy-Paste Example

### For Basic Viewer Mode

Add this to your mode configuration (e.g., `modes/basic-viewer/src/index.tsx`):

```typescript
import { hotkeys } from '@ohif/core';

function modeFactory({ modeConfiguration }) {
  return {
    id: 'basic-viewer',
    routeName: 'basic-viewer',
    displayName: 'Basic Viewer',

    // ... other configuration ...

    // 1. ADD THE BUTTON DEFINITION
    toolbarButtons: [
      // ... existing buttons ...
      {
        id: 'ModelUpload',
        uiType: 'ohif.button',
        props: {
          icon: 'icon-3d-model',
          label: 'Upload 3D Models',
          commands: 'showModelUploadModal',
        },
      },
    ],

    // 2. ADD TO TOOLBAR SECTION
    onModeEnter: ({ servicesManager, commandsManager, extensionManager }) => {
      const { toolbarService, toolGroupService } = servicesManager.services;

      // Register toolbar buttons
      toolbarService.init(extensionManager);
      toolbarService.addButtons([...toolbarButtons]);

      // Create primary toolbar section with your button
      toolbarService.createButtonSection('primary', [
        'MeasurementTools',
        'Zoom',
        'WindowLevel',
        'Pan',
        'Capture',
        'Layout',
        'ModelUpload',  // ← Add your button here
        'MoreTools',
      ]);

      // ... rest of onModeEnter
    },

    // ... rest of mode configuration ...
  };
}

export default modeFactory;
```

---

## For Different Toolbar Positions

### In Primary Section (Main Toolbar)
```typescript
toolbarService.createButtonSection('primary', [
  'Zoom',
  'WindowLevel',
  'ModelUpload',  // ← At the end of primary tools
]);
```

### In Secondary Section (Right Side)
```typescript
toolbarService.createButtonSection('secondary', [
  'ModelUpload',  // ← In secondary section
  'Settings',
]);
```

### In Custom Section
```typescript
toolbarService.createButtonSection('customSection', [
  'ModelUpload',
  'CustomTool1',
  'CustomTool2',
]);
```

---

## Button Variations

### Variation 1: Icon Only (Compact)
```typescript
{
  id: 'ModelUpload',
  uiType: 'ohif.button',
  props: {
    icon: 'icon-3d-model',
    commands: 'showModelUploadModal',
    tooltip: 'Upload 3D Models',  // Shows on hover
  },
}
```

### Variation 2: With Label (Full)
```typescript
{
  id: 'ModelUpload',
  uiType: 'ohif.button',
  props: {
    icon: 'icon-3d-model',
    label: 'Upload Models',
    commands: 'showModelUploadModal',
  },
}
```

### Variation 3: As Radio Group Button
```typescript
{
  id: 'ModelUpload',
  type: 'ohif.radioGroup',
  props: {
    type: 'tool',
    icon: 'icon-3d-model',
    label: 'Upload 3D Models',
    commands: 'showModelUploadModal',
  },
}
```

### Variation 4: With Custom Styling
```typescript
{
  id: 'ModelUpload',
  uiType: 'ohif.button',
  props: {
    icon: 'icon-3d-model',
    label: 'Models',
    commands: 'showModelUploadModal',
    className: 'bg-blue-500 hover:bg-blue-600',  // Custom colors
  },
}
```

---

## Complete Working Example for Longitudinal Mode

```typescript
// modes/longitudinal/src/toolbarButtons.ts

export default [
  // ... existing buttons ...

  // Zoom tools
  {
    id: 'Zoom',
    type: 'ohif.radioGroup',
    props: {
      type: 'tool',
      icon: 'tool-zoom',
      label: 'Zoom',
      commands: 'setToolActive',
      commandOptions: { toolName: 'Zoom' },
    },
  },

  // Window/Level
  {
    id: 'WindowLevel',
    type: 'ohif.radioGroup',
    props: {
      type: 'tool',
      icon: 'tool-window-level',
      label: 'Window Level',
      commands: 'setToolActive',
      commandOptions: { toolName: 'WindowLevel' },
    },
  },

  // 3D Model Upload - NEW!
  {
    id: 'ModelUpload',
    uiType: 'ohif.button',
    props: {
      icon: 'icon-3d-model',
      label: 'Upload Models',
      commands: 'showModelUploadModal',
      tooltip: 'Upload 3D models (OBJ, STL, PLY)',
    },
  },

  // More tools
  {
    id: 'MoreTools',
    type: 'ohif.splitButton',
    props: {
      groupId: 'MoreTools',
      primary: {
        // ... config ...
      },
    },
  },
];
```

Then in the mode's `index.tsx`:

```typescript
import toolbarButtons from './toolbarButtons';

function modeFactory() {
  return {
    // ... config ...

    onModeEnter: ({ servicesManager }) => {
      const { toolbarService } = servicesManager.services;

      // Register all buttons
      toolbarService.addButtons(toolbarButtons);

      // Add to primary section
      toolbarService.createButtonSection('primary', [
        'MeasurementTools',
        'Zoom',
        'WindowLevel',
        'Pan',
        'Capture',
        'Layout',
        'ModelUpload',  // ← Your new button
        'MoreTools',
      ]);
    },
  };
}
```

---

## Testing Your Button

### 1. Start the Viewer
```bash
yarn run dev
```

### 2. Open the Mode
Navigate to your mode in the browser (e.g., `http://localhost:3000/viewer/...`)

### 3. Look for the Button
You should see a button with:
- A 3D cube icon (or your chosen icon)
- The label "Upload Models" (if you included it)
- In the position you specified in the toolbar section

### 4. Click the Button
- A modal should appear with the title "Upload 3D Models"
- The modal should contain the full upload interface
- You should be able to drag & drop or select files

### 5. Test Upload
- Try uploading a `.obj`, `.stl`, or `.ply` file
- Check the browser console for any errors
- Verify the model loads in the viewport

---

## Keyboard Shortcut (Optional)

You can add a keyboard shortcut to open the modal:

```typescript
// In your mode's hotkeys configuration
hotkeys: [
  {
    commandName: 'showModelUploadModal',
    label: 'Upload 3D Models',
    keys: ['Ctrl+Shift+U'],  // Or any keys you prefer
  },
  // ... other hotkeys ...
],
```

---

## Custom Button Component (Advanced)

If you want even more control, create your own button component:

```typescript
// MyCustomModelButton.tsx
import React from 'react';
import { Button, Icon } from '@ohif/ui-next';
import { useSystem } from '@ohif/extension-default';

function MyCustomModelButton() {
  const { commandsManager } = useSystem();

  return (
    <Button
      variant="primary"
      size="lg"
      onClick={() => commandsManager.runCommand('showModelUploadModal')}
    >
      <Icon name="icon-3d-model" />
      <span>My Custom Upload Button</span>
    </Button>
  );
}

export default MyCustomModelButton;
```

Then register it in your toolbar module and use it in your mode.

---

## Summary

✅ **Added button definition** to mode configuration
✅ **Added button ID** to toolbar section
✅ **Tested** the button appears and works
✅ **Customized** icon, label, and position as needed

Your 3D model upload button is now ready to use! 🎉
