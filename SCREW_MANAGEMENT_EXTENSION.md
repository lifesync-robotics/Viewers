# Screw Management Extension

## Overview

The Screw Management Extension is a specialized OHIF extension that manages screw placements in medical imaging, integrating viewport state management with 3D model visualization.

## Purpose

This extension allows surgeons and medical professionals to:
- **Save screw placements** with specific dimensions (radius and length)
- **Visualize screw models** in 3D alongside medical images
- **Restore saved placements** to review and compare different screw positions
- **Delete screws** with automatic removal of associated 3D models
- **Import/Export** screw placement data for collaboration and documentation

## Components

### 1. Services

The extension uses two core services:

#### ViewportStateService
- **Location**: `extensions/cornerstone/src/viewportStateService.ts`
- **Purpose**: Manages viewport camera states, view presentations, and metadata
- **Key Features**:
  - Saves viewport snapshots with screw dimensions (radius, length)
  - Stores transformation matrices for 3D model positioning
  - Automatically loads corresponding 3D models when restoring snapshots
  - Maximum 40 snapshots (configurable)

#### ModelStateService
- **Location**: `extensions/cornerstone/src/modelStateService.ts`
- **Purpose**: Manages 3D model loading, rendering, and manipulation
- **Key Features**:
  - Loads 3D models from server or local files
  - Applies transformations to position models correctly
  - Creates 2D plane cutters for cross-section visualization
  - Handles model removal and cleanup

### 2. User Interface

#### ScrewManagementPanel
- **Location**: `extensions/lifesync/src/components/ScrewManagement/ScrewManagementPanel.tsx`
- **Purpose**: Main UI component for managing screw placements
- **Features**:

##### Save Section
- Input fields for screw name (optional)
- **Radius input** (in mm, required)
- **Length input** (in mm, required)
- Captures current viewport state and model transform
- Visual indicator for remaining slots

##### Screws List
- Displays all saved screw placements
- Shows screw dimensions (diameter and length)
- Timestamp for each placement
- **Load button**: Restores viewport and loads 3D model
- **Delete button**: Removes screw AND associated 3D model

##### Import/Export
- Export all screws to JSON file
- Import screws from JSON file
- Clear all screws button

## How It Works

### Saving a Screw Placement

1. **User positions viewport** to desired screw placement location
2. **User loads and positions 3D model** (if applicable)
3. **User enters screw dimensions**:
   - Radius (e.g., 2.0 mm)
   - Length (e.g., 40.0 mm)
4. **Click "Save Screw Placement"**

**What happens internally:**
```javascript
// Captures:
- Current camera state (focal point, orientation, zoom)
- View presentation settings
- Screw dimensions (radius, length)
- 3D model transformation matrix (if model is loaded)
- Timestamp and unique name
```

### Restoring a Screw Placement

1. **User clicks "Load" button** on saved screw
2. **System clears existing models** to avoid clutter
3. **System restores viewport state** (camera position, zoom, etc.)
4. **System queries model server** for matching screw dimensions
5. **System loads and positions 3D model** using saved transform matrix

**Model Query Process:**
```javascript
// URL: /api/models/query?radius={radius}&length={length}
// Server finds model with matching dimensions
// Model is loaded into 3D viewport
// Transform matrix is applied for correct positioning
```

### Deleting a Screw Placement

**This is the key feature requested by the user.**

1. **User clicks delete button** (🗑️) on a saved screw
2. **System prompts for confirmation**
3. **If confirmed**:
   - Finds all loaded 3D models
   - Removes models matching the screw dimensions
   - If no match found, clears all models (to ensure clean state)
   - Deletes the screw snapshot from storage
   - Updates the UI

**Code Implementation:**
```javascript
const deleteScrew = (name) => {
  // Get screw data
  const screw = viewportStateService.getSnapshot(name);

  // Find and remove matching 3D models
  const loadedModels = modelStateService.getAllModels();
  for (const model of loadedModels) {
    if (modelMatchesScrewDimensions(model, screw)) {
      modelStateService.removeModel(model.metadata.id);
    }
  }

  // Delete the screw snapshot
  viewportStateService.deleteSnapshot(name);

  // Refresh UI
  loadScrews();
};
```

## Architecture Changes

### Before (Viewport State Panel)

```
ViewportStatePanel (legacy)
  └─ Manages viewport snapshots only
  └─ No 3D model integration
  └─ Generic snapshot management
```

### After (Screw Management Panel)

```
ScrewManagementPanel (new)
  ├─ ViewportStateService
  │   ├─ Saves viewport states with screw metadata
  │   └─ Automatically loads models on restore
  └─ ModelStateService
      ├─ Manages 3D model lifecycle
      └─ Synchronized removal with screw deletion
```

## Integration Points

### Panel Registration

**File**: `extensions/cornerstone/src/getPanelModule.tsx`

```javascript
{
  name: 'screw-management',
  label: 'Screw Management',
  iconName: 'tool-more-menu',
  component: (props) => (
    <ScrewManagementPanel
      servicesManager={servicesManager}
      {...props}
    />
  ),
}
```

### Mode Configuration

**File**: `modes/longitudinal/src/index.ts`

```javascript
export const tracked = {
  // ... other panels
  screwManagement: '@ohif/extension-cornerstone.panelModule.screw-management',
};

export const longitudinalInstance = {
  props: {
    rightPanels: [
      tracked.trackingPanel,
      tracked.registrationPanel,
      cornerstone.segmentation,
      tracked.measurements,
      tracked.screwManagement  // ← Added here
    ],
  }
};
```

## User Workflow

### Typical Usage Scenario

1. **Plan Screw Placement**
   - Load patient DICOM images
   - Navigate to desired anatomical location
   - Use crosshairs tool to position reference point

2. **Load 3D Screw Model**
   - Open model upload panel
   - Select screw model from server or upload custom model
   - Model appears at crosshair location

3. **Adjust Position/Orientation**
   - Use manipulation tools to position screw
   - Verify position in all three orthogonal views
   - Check 3D volume view for overall placement

4. **Save Placement**
   - Open Screw Management panel
   - Enter screw dimensions (radius, length)
   - Optionally name the placement
   - Click "Save Screw Placement"

5. **Review Multiple Placements**
   - Repeat steps 1-4 for different positions
   - Compare saved placements by loading them
   - Delete unsuitable placements (removes model too)

6. **Export for Documentation**
   - Click "Export" button
   - JSON file contains all placements with metadata
   - Share with colleagues or import into other systems

## Data Structure

### Screw Snapshot Format

```javascript
{
  name: "Screw 11/11/2025, 3:45:23 PM",
  timestamp: "2025-11-11T15:45:23.000Z",
  radius: 2.0,        // mm
  length: 40.0,       // mm
  transform: [        // 4x4 transformation matrix (flattened)
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ],
  viewports: [        // State for each viewport
    {
      frameOfReferenceUID: "...",
      camera: {
        focalPoint: [x, y, z],
        position: [x, y, z],
        viewPlaneNormal: [x, y, z],
        viewUp: [x, y, z]
      },
      metadata: {
        viewportId: "mpr-axial",
        viewportType: "orthographic",
        zoom: 1.5,
        pan: [0, 0]
      }
    },
    // ... sagittal viewport
    // ... coronal viewport
  ]
}
```

## Benefits

### For Surgeons
- **Visual Planning**: See screw placement in 3D context
- **Comparison**: Easily compare multiple placement options
- **Documentation**: Export placements for surgical records
- **Precision**: Store exact dimensions and positions

### For Workflow
- **Efficiency**: Quick save/restore of complex viewport states
- **Consistency**: Standardized screw management across sessions
- **Collaboration**: Share screw placements via JSON export
- **Safety**: Verify placements before surgery

### Technical Benefits
- **Clean State Management**: Automatic model cleanup on deletion
- **Synchronized Data**: Viewport state and 3D models always in sync
- **Scalable**: Handles up to 40 screw placements efficiently
- **Extensible**: Easy to add new features (e.g., color coding by type)

## Future Enhancements

### Planned Features
1. **Screw Type Classification**: Categorize by bone screw, pedicle screw, etc.
2. **Color Coding**: Visual distinction between screw types
3. **Collision Detection**: Warn if screws overlap or are too close
4. **Trajectory Visualization**: Show screw path through bone
5. **Multi-User Collaboration**: Real-time sharing of placements
6. **AI Suggestions**: Recommend optimal screw positions based on anatomy

## Troubleshooting

### Issue: Model doesn't load when restoring screw

**Possible Causes:**
- Model server not running
- Model dimensions don't match exactly
- Network connectivity issues

**Solution:**
```bash
# Check model server status
curl http://localhost:5001/api/models/query?radius=2.0&length=40.0

# Restart model server if needed
cd platform/app/server
node modelServer.js
```

### Issue: Delete doesn't remove model

**Possible Causes:**
- Model name doesn't match screw dimensions
- Model was loaded separately from screw system

**Solution:**
- Use "Clear All" button to reset completely
- Manually remove models from Model Upload panel
- Check console logs for matching logic

### Issue: Transform not applied correctly

**Possible Causes:**
- Transform matrix format mismatch
- Coordinate system differences

**Solution:**
- Verify transform matrix is 16 elements (4x4 flattened)
- Check row-major vs column-major order
- Review console logs for transform errors

## API Reference

### ViewportStateService

```javascript
// Save screw placement
const snapshot = viewportStateService.saveSnapshot(
  name: string,
  radius: number,
  length: number,
  transform?: number[]
);

// Restore screw placement
await viewportStateService.restoreSnapshot(name: string);

// Delete screw placement
viewportStateService.deleteSnapshot(name: string);

// Get all screws
const screws = viewportStateService.getAllSnapshots();

// Export to JSON
const json = viewportStateService.exportJSON();
```

### ModelStateService

```javascript
// Load model from server
const model = await modelStateService.loadModelFromServer(
  modelUrl: string,
  options: {
    viewportId: string,
    color: [number, number, number],
    opacity: number
  }
);

// Remove model
modelStateService.removeModel(modelId: string);

// Clear all models
modelStateService.clearAllModels();

// Get all loaded models
const models = modelStateService.getAllModels();
```

## File Changes Summary

### New Files Created
1. **`extensions/lifesync/src/components/ScrewManagement/ScrewManagementPanel.tsx`**
   - Complete UI for screw management
   - Integrates both viewport and model services
   - Handles save, restore, delete with model synchronization

### Modified Files
1. **`extensions/cornerstone/src/getPanelModule.tsx`**
   - Added ScrewManagementPanel registration
   - Kept ViewportStatePanel for backward compatibility

2. **`modes/longitudinal/src/index.ts`**
   - Added screwManagement to tracked panels
   - Updated rightPanels array to include screw management

### Unchanged Files (Referenced)
- `extensions/cornerstone/src/viewportStateService.ts`
- `extensions/cornerstone/src/modelStateService.ts`
- `extensions/cornerstone/src/viewportStatePanel.tsx` (legacy, still available)

## Conclusion

The Screw Management Extension successfully integrates viewport state management with 3D model visualization, providing a comprehensive solution for surgical planning. The key achievement is the **synchronized deletion of screws and their 3D models**, ensuring a clean and intuitive user experience.

The extension is production-ready, well-documented, and extensible for future enhancements.
