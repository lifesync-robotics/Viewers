# Model Upload UI Enhancement - Server Model Selection

## Overview

The ModelUpload component has been enhanced with a **two-panel layout** that allows users to:
1. **Upload models** from their local files (left panel)
2. **Select and load models from the server** (right panel)

This provides a complete workflow for both uploading custom models and using pre-existing server models.

---

## New Features

### 1. Split Panel Layout

The UI is now divided into two equal panels:

```
┌─────────────────────────────────────────────────────────────┐
│                     Model Upload Modal                       │
├───────────────────────────────┬─────────────────────────────┤
│  LEFT PANEL: Upload Models    │  RIGHT PANEL: Server Models  │
│                               │                             │
│  • Drag & Drop                │  • List of available models │
│  • File Browser               │  • Radio selection          │
│  • Upload Progress            │  • Model metadata           │
│                               │  • Load button              │
└───────────────────────────────┴─────────────────────────────┘
```

### 2. Server Model Selection Panel

The right panel displays:

#### Model List
- **Scrollable list** of all available models from the server
- **Radio button selection** (only one model at a time)
- **Model filename** as the display name
- **Metadata display**:
  - Type badge (🖥️ Server or 👤 User)
  - File size in MB
  - File format (OBJ)

#### Interactive Selection
- Click anywhere on a model card to select it
- Selected model is highlighted with primary color
- Visual feedback on hover

#### Load Button
- Prominent "Load Selected Model" button at the bottom
- Shows loading state with spinner when loading
- Displays selected model filename below button
- Disabled when no model is selected

### 3. Auto-Load Server Models

- Models are automatically fetched from the server when the modal opens
- **Refresh button** to manually reload the model list
- Loading state while fetching models

---

## Usage

### For End Users

#### Loading a Server Model

1. Click the "Upload Models" button in the toolbar
2. Look at the **right panel** labeled "Server Models"
3. **Select a model** by clicking on it (radio button will be checked)
4. Click the **"Load Selected Model"** button at the bottom
5. Wait for the model to load (spinner will appear)
6. Model will be rendered in the 3D viewport

#### Uploading a Local Model

1. Click the "Upload Models" button in the toolbar
2. Look at the **left panel** labeled "Upload Models"
3. Either:
   - **Drag and drop** your .obj file(s) into the dropzone
   - Click **"Select Files"** to browse for files
   - Click **"Select Folder"** to upload a folder
4. Watch the upload progress
5. Model will be rendered in the 3D viewport

---

## Technical Implementation

### Component Structure

```typescript
interface ServerModel {
  id: string;
  name: string;
  filename: string;
  type: 'server' | 'user';
  url: string;
  size: number;
  createdAt: Date;
  format: string;
}
```

### State Management

```typescript
const [serverModels, setServerModels] = useState<ServerModel[]>([]);
const [selectedModelUrl, setSelectedModelUrl] = useState<string>('');
const [isLoadingServerModels, setIsLoadingServerModels] = useState(false);
const [isLoadingSelectedModel, setIsLoadingSelectedModel] = useState(false);
```

### Key Functions

#### Load Server Models
```typescript
const loadServerModels = async () => {
  setIsLoadingServerModels(true);
  try {
    const models = await modelStateService.fetchAvailableModels();
    setServerModels(models);
  } catch (error) {
    console.error('Error loading server models:', error);
  } finally {
    setIsLoadingServerModels(false);
  }
};
```

#### Handle Model Selection
```typescript
const handleSelectServerModel = (modelUrl: string) => {
  setSelectedModelUrl(modelUrl);
};
```

#### Load Selected Model
```typescript
const handleLoadServerModel = async () => {
  if (!selectedModelUrl) {
    alert('Please select a model first');
    return;
  }

  setIsLoadingSelectedModel(true);
  try {
    const loadedModel = await modelStateService.loadModelFromServer(
      selectedModelUrl,
      {
        viewportId,
        color: defaultColor,
        opacity: defaultOpacity,
        visible: true,
      }
    );

    if (loadedModel) {
      if (onComplete) {
        onComplete();
      }
    } else {
      alert('Failed to load model from server');
    }
  } catch (error) {
    console.error('Error loading server model:', error);
    alert('Error loading model: ' + error.message);
  } finally {
    setIsLoadingSelectedModel(false);
  }
};
```

---

## API Integration

The component uses the following `modelStateService` methods:

### 1. Fetch Available Models
```typescript
modelStateService.fetchAvailableModels(): Promise<ServerModel[]>
```
- Retrieves list of models from `/api/models/list`
- Returns both server models and user-uploaded models

### 2. Load Model from Server
```typescript
modelStateService.loadModelFromServer(
  modelUrl: string,
  options: ModelLoadOptions
): Promise<LoadedModel | null>
```
- Loads a model from the server URL
- Applies color, opacity, and other options
- Adds to the specified viewport

### 3. Load Model from File
```typescript
modelStateService.loadModelFromFileInput(
  file: File,
  options: ModelLoadOptions
): Promise<LoadedModel | null>
```
- Loads a model from a File object
- Used for local file uploads

---

## UI Components

### Left Panel: Upload Models

```tsx
<div className="flex-1 flex flex-col">
  <h3>Upload Models</h3>

  {/* Dropzone or Progress */}
  {uploadedModels.length > 0 ? (
    <ProgressComponent />
  ) : (
    <Dropzone>
      {/* Upload interface */}
    </Dropzone>
  )}
</div>
```

### Right Panel: Server Models

```tsx
<div className="flex-1 flex flex-col border-l border-secondary-light pl-4">
  <h3>Server Models</h3>

  {/* Model list with radio buttons */}
  <div className="overflow-y-auto">
    {serverModels.map(model => (
      <ModelCard
        model={model}
        selected={selectedModelUrl === model.url}
        onSelect={handleSelectServerModel}
      />
    ))}
  </div>

  {/* Load button */}
  <Button onClick={handleLoadServerModel}>
    Load Selected Model
  </Button>
</div>
```

---

## Styling

The component uses Tailwind CSS with the OHIF design system:

### Layout Classes
- `flex flex-row` - Horizontal split
- `flex-1` - Equal width panels
- `gap-4` - Spacing between panels
- `h-full` - Full height

### Panel Styles
- `border-l border-secondary-light` - Divider between panels
- `rounded-lg` - Rounded corners
- `p-3` - Consistent padding

### Selection States
- `border-primary-light bg-primary-dark/30` - Selected model
- `hover:border-primary-light` - Hover state
- `cursor-pointer` - Clickable areas

### Type Badges
- Server models: `bg-blue-900/30 text-blue-300`
- User models: `bg-green-900/30 text-green-300`

---

## Error Handling

### No Models Available
```tsx
{serverModels.length === 0 && (
  <div className="text-center text-secondary-light">
    <div>📦 No models available on server</div>
    <div>Upload models or add them to the models/server/ directory</div>
  </div>
)}
```

### Failed to Load Model
```typescript
if (!loadedModel) {
  alert('Failed to load model from server');
}
```

### Network Errors
```typescript
catch (error) {
  console.error('Error loading server model:', error);
  alert('Error loading model: ' + error.message);
}
```

---

## Keyboard & Accessibility

- **Radio buttons** are keyboard-navigable
- **Tab key** moves between elements
- **Space/Enter** selects a model
- **Screen reader** support for all interactive elements

---

## Performance Considerations

### Lazy Loading
- Models are fetched on demand when modal opens
- List is cached until refresh is clicked

### Scroll Performance
- `max-h-[500px] overflow-y-auto` for long lists
- Virtual scrolling could be added for very large lists

### Loading States
- Spinners shown during async operations
- Buttons disabled to prevent double-clicks

---

## Future Enhancements

### Potential Additions

1. **Search/Filter**
   - Search by filename
   - Filter by type (server/user)
   - Filter by format

2. **Preview Thumbnails**
   - Generate previews for models
   - Show thumbnail in list

3. **Batch Operations**
   - Delete multiple user models
   - Load multiple models at once

4. **Sorting**
   - Sort by name, size, date
   - Ascending/descending

5. **Model Information**
   - Detailed model stats
   - Vertex/face count
   - Bounding box dimensions

6. **Drag and Drop to Load**
   - Drag model card to viewport
   - Drop to load

---

## Testing Checklist

- [ ] Server models load correctly on modal open
- [ ] Radio button selection works (only one at a time)
- [ ] Selected model is highlighted
- [ ] Load button is disabled when no selection
- [ ] Loading spinner appears during load
- [ ] Model loads into correct viewport
- [ ] Upload panel still works
- [ ] Both panels are visible and properly sized
- [ ] Scroll works for long model lists
- [ ] Refresh button updates the list
- [ ] Error messages display correctly
- [ ] Keyboard navigation works

---

## File Changes

### Modified Files

**`extensions/cornerstone/src/components/ModelUpload/ModelUpload.tsx`**
- Added `ServerModel` interface
- Added state for server models and selection
- Created `loadServerModels()` function
- Created `handleSelectServerModel()` function
- Created `handleLoadServerModel()` function
- Split UI into two panels
- Created `getUploadPanel()` component
- Created `getServerModelsPanel()` component
- Updated layout to horizontal split

### API Methods Used

From `modelStateService`:
- `fetchAvailableModels()` - Get model list
- `loadModelFromServer(url, options)` - Load selected model
- `loadModelFromFileInput(file, options)` - Upload local model

---

## Summary

The enhanced ModelUpload component provides a **complete model management interface** with:

✅ **Two-panel layout** for upload and selection
✅ **Radio button selection** (one model at a time)
✅ **Model filename display** with metadata
✅ **Submit button** to load selected model
✅ **Loading states** for better UX
✅ **Error handling** with user feedback
✅ **Consistent styling** with OHIF design system
✅ **Keyboard accessible** interface

This implementation follows OHIF's patterns and provides an intuitive user experience for both uploading custom models and using server-provided models.

---

**Date:** November 7, 2024
**Version:** 2.0
**Status:** Complete ✅
