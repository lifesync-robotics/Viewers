# 3D Model Upload Toolbar Button Guide

## Overview

A toolbar button has been added to make it easy to upload 3D models from anywhere in the OHIF viewer. This button opens a modal with the full-featured model upload interface.

## What Was Added

### 1. **ModelUploadButton Component**
Location: `extensions/cornerstone/src/components/ModelUpload/ModelUploadButton.tsx`

A simple button component that triggers the upload modal when clicked.

### 2. **showModelUploadModal Command**
Location: `extensions/cornerstone/src/commandsModule.ts`

A new command that opens a modal containing the `ModelUpload` component.

```typescript
showModelUploadModal: () => {
  const { uiModalService } = servicesManager.services;

  if (uiModalService) {
    uiModalService.show({
      content: ModelUpload,
      title: 'Upload 3D Models',
      contentProps: {
        servicesManager,
        commandsManager,
      },
      containerClassName: 'max-w-4xl p-4',
    });
  }
}
```

### 3. **Toolbar Module Registration**
Location: `extensions/cornerstone/src/getToolbarModule.tsx`

The button is registered as `ohif.modelUploadButton` in the toolbar module.

---

## How to Add the Button to Your Toolbar

You need to add the button to your mode's toolbar configuration. Here's how:

### Step 1: Locate Your Mode Configuration

Find your mode's configuration file. For example:
- `modes/longitudinal/src/index.tsx`
- `modes/tmtv/src/index.tsx`
- Or your custom mode file

### Step 2: Add the Button Definition

In your mode's toolbar buttons array, add:

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

**Or for a simpler button:**

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

### Step 3: Add to a Toolbar Section

In your mode's `onModeEnter` function, add the button to a toolbar section:

```typescript
onModeEnter: ({ servicesManager, commandsManager }) => {
  const { toolbarService } = servicesManager.services;

  // Add the button to the primary toolbar section
  toolbarService.createButtonSection('primary', [
    'MeasurementTools',
    'Zoom',
    'WindowLevel',
    'Pan',
    'ModelUpload',  // ← Add this
  ]);

  // ... rest of your mode setup
}
```

---

## Complete Example

Here's a complete example from a mode configuration:

```typescript
// modes/your-mode/src/index.tsx

export default function modeFactory() {
  return {
    id: 'your-mode',
    displayName: 'Your Mode',

    // ... other config ...

    // Define the toolbar button
    toolbarButtons: [
      // ... other buttons ...
      {
        id: 'ModelUpload',
        uiType: 'ohif.button',
        props: {
          icon: 'icon-3d-model',
          label: 'Upload 3D Models',
          commands: 'showModelUploadModal',
          tooltip: 'Upload OBJ, STL, or PLY models',
        },
      },
    ],

    onModeEnter: ({ servicesManager, commandsManager }) => {
      const { toolbarService } = servicesManager.services;

      // Add to primary toolbar
      toolbarService.createButtonSection('primary', [
        'Zoom',
        'WindowLevel',
        'Pan',
        'Capture',
        'Layout',
        'ModelUpload',  // ← Your button appears here
        'MoreTools',
      ]);
    },

    // ... rest of your mode ...
  };
}
```

---

## Alternative: Use the Component Directly

If you want more control, you can use the `ModelUploadButton` component directly in your custom toolbar:

```typescript
import { ModelUploadButton } from '@ohif/extension-cornerstone';

// In your toolbar configuration
{
  name: 'ohif.modelUploadButton',
  defaultComponent: ModelUploadButton,
}
```

---

## Features

The button provides access to:

✅ **Drag & Drop Upload** - Drop files or folders onto the interface
✅ **File Browser** - Click to select files from your computer
✅ **Multiple Format Support** - OBJ, STL, PLY with MTL material support
✅ **Batch Upload** - Upload multiple models at once
✅ **Progress Tracking** - Visual feedback during upload
✅ **Error Handling** - Clear error messages if something goes wrong

---

## Calling the Modal Programmatically

You can also open the modal from your own code:

### From a React Component

```typescript
import { useSystem } from '@ohif/extension-default';

function MyComponent() {
  const { commandsManager } = useSystem();

  const openUploadModal = () => {
    commandsManager.runCommand('showModelUploadModal');
  };

  return <button onClick={openUploadModal}>Upload Models</button>;
}
```

### From the Browser Console

```javascript
window.commandsManager.runCommand('showModelUploadModal');
```

### From Another Extension/Command

```typescript
commandsManager.runCommand('showModelUploadModal');
```

---

## Icon Options

If you want to use a different icon, here are some alternatives:

- `icon-3d-model` - 3D cube icon (recommended)
- `icon-upload` - Upload arrow icon
- `icon-add` - Plus icon
- `icon-cloud-upload` - Cloud upload icon

Change the `icon` property in the button definition:

```typescript
props: {
  icon: 'icon-upload', // ← Change this
  label: 'Upload Models',
  commands: 'showModelUploadModal',
}
```

---

## Troubleshooting

### Button Doesn't Appear

1. **Check the mode is active**: Ensure your mode is the one currently loaded
2. **Check toolbar section**: Verify you added the button ID to `createButtonSection`
3. **Check button definition**: Ensure the button is defined in `toolbarButtons`
4. **Check console**: Look for any errors in the browser console

### Modal Doesn't Open

1. **Check uiModalService**: Ensure the modal service is available
2. **Check command registration**: Verify the command is registered in commandsModule
3. **Check imports**: Ensure `ModelUpload` is imported in commandsModule

### Button Shows but is Disabled

The button should always be enabled. If it appears disabled:
1. Check for CSS conflicts
2. Verify the `commands` property is correctly set
3. Check if there are custom evaluate functions interfering

---

## Next Steps

1. **Add the button** to your mode's toolbar configuration
2. **Test it** by clicking the button and uploading a model
3. **Customize** the button's appearance and position as needed
4. **Share** with your team!

---

## Related Documentation

- [Model Loader API Reference](./extensions/cornerstone/src/MODEL_LOADER_README.md)
- [Complete File Upload Solution](./COMPLETE_FILE_UPLOAD_SOLUTION.md)
- [Quick Reference Guide](./QUICK_REFERENCE.md)
- [Panel Layout Schematic](./PANEL_LAYOUT_SCHEMATIC.md)

---

## Summary

You now have a **convenient toolbar button** that provides easy access to 3D model uploads from anywhere in the OHIF viewer. No need to hunt for a panel - just click the button and start uploading! 🚀
