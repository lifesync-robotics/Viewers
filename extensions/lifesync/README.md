# LifeSync Extension

The LifeSync extension provides surgical navigation and case management functionality for the OHIF Viewer.

## Overview

This extension contains LifeSync Robotics specific components that were previously embedded within the core OHIF extensions. By separating these into a dedicated extension, we can:

- Keep up with OHIF upstream updates without merge conflicts
- Maintain modular, testable LifeSync-specific functionality
- Easily enable/disable LifeSync features independently

## Components

### Worklist (`components/Worklist/`)
Enhanced worklist component that extends OHIF's StudyBrowser with case management features:
- Case-based study grouping
- Clinical phase management
- Case enrollment workflow

### Screw Management (`components/ScrewManagement/`)
Pedicle screw planning and management interface:
- Screw placement tools
- Screw trajectory planning
- Screw inventory management

### Navigation (`components/Navigation/`)
Surgical navigation controls and displays:
- Real-time navigation feedback
- Crosshair positioning
- Coordinate system management

### Registration (`components/Registration/`)
Image-to-patient registration workflow:
- Fiducial marker placement
- Registration computation
- Quality assessment

## Services

### Case Management Service
Extends the default CaseService with LifeSync-specific workflows:
- Surgical case lifecycle management
- Study enrollment with clinical phases
- Primary reference management

## Installation

This extension is included in the LifeSync Viewer build configuration. To add it to a custom OHIF installation:

```javascript
// In your app configuration
extensions: [
  // ... other extensions
  '@ohif/extension-lifesync',
],
```

## Development

When making changes to LifeSync functionality:

1. Modify components in this extension rather than core OHIF extensions
2. Update imports throughout the codebase to reference this extension
3. Test functionality independently before integration testing

## Migration Notes

This extension was created during the OHIF refactoring to separate LifeSync functionality from core OHIF extensions. Components were moved from:

- `extensions/cornerstone/src/` (Old location - moved to lifesync)
- `extensions/default/src/Panels/` (Old location - moved to lifesync)

Current location: `extensions/lifesync/src/components/ScrewManagement/ScrewManagementPanel.tsx`

All imports have been updated to reference the new extension location.
