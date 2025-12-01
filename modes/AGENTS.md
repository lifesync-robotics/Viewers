# OHIF Mode Management Guide for AI Agents

## Overview

OHIF modes are workflow-specific viewer configurations that define how the viewer behaves for different use cases. Each mode is a mini-application with its own route, layout, panels, viewports, and toolbars. Modes consume extensions to build their functionality.

**Key Resources:**
- Official Documentation: https://docs.ohif.org/platform/modes/
- Mode Gallery: https://ohif.org/modes/

## Understanding OHIF Modes

### Core Concepts

1. **Mode**: A workflow-specific viewer configuration (e.g., longitudinal tracking, segmentation, PET/CT fusion)
2. **Route**: The URL path where the mode is accessible (e.g., `/viewer`, `/basic`, `/segmentation`)
3. **Extension Dependencies**: Extensions required by the mode (panels, viewports, tools, etc.)
4. **Layout**: Defines panels (left/right) and viewports for the mode
5. **Lifecycle Hooks**: `onModeEnter` and `onModeExit` for initialization and cleanup

### Mode Structure

A mode consists of:
- **id**: Unique identifier (usually matches package name)
- **modeFactory**: Function that returns mode configuration
- **modeInstance**: Default configuration object
- **extensionDependencies**: Required extensions with versions
- **routes**: Array of route configurations
- **hangingProtocol**: Hanging protocol(s) to use
- **sopClassHandlers**: SOP class handlers for DICOM data
- **hotkeys**: Custom keyboard shortcuts
- **toolbarButtons**: Custom toolbar buttons
- **isValidMode**: Function to determine if mode is valid for a study

## File Structure

### Standard Mode Directory Structure

```
Viewers/modes/
├── {mode-name}/
│   ├── package.json          # Package metadata, dependencies
│   ├── babel.config.js       # Babel configuration
│   ├── README.md             # Mode documentation
│   ├── CHANGELOG.md          # Version history
│   ├── LICENSE               # License file
│   └── src/
│       ├── index.tsx         # Main mode file (or index.ts)
│       ├── id.js             # Mode ID (from package.json)
│       ├── toolbarButtons.ts # Custom toolbar buttons
│       ├── initToolGroups.ts # Tool group initialization
│       └── utils/            # Utility functions (optional)
│           └── *.ts
```

### Key Files Explained

1. **package.json**: 
   - Must include `"ohif-mode"` in keywords
   - Defines peerDependencies (extensions)
   - Sets main entry point

2. **src/index.tsx** (or **index.ts**):
   - Exports the mode object
   - Contains `modeFactory` function
   - Defines `modeInstance` configuration

3. **src/id.js**:
   - Simple file that exports mode ID from package.json
   - Example: `export { id } from '../package.json';`

## Creating a New Mode

### Step 1: Create Directory Structure

```bash
mkdir -p Viewers/modes/my-custom-mode/src
cd Viewers/modes/my-custom-mode
```

### Step 2: Create package.json

```json
{
  "name": "@ohif/mode-my-custom-mode",
  "version": "3.12.0-beta.85",
  "description": "Description of your mode",
  "author": "Your Name",
  "license": "MIT",
  "main": "dist/ohif-mode-my-custom-mode.js",
  "module": "src/index.tsx",
  "keywords": [
    "ohif-mode"
  ],
  "peerDependencies": {
    "@ohif/core": "3.12.0-beta.85",
    "@ohif/extension-default": "3.12.0-beta.85",
    "@ohif/extension-cornerstone": "3.12.0-beta.85"
  },
  "scripts": {
    "dev": "cross-env NODE_ENV=development webpack --config .webpack/webpack.dev.js --watch",
    "build": "cross-env NODE_ENV=production webpack --config .webpack/webpack.prod.js"
  }
}
```

### Step 3: Create src/id.js

```javascript
import packageJson from '../package.json';

const id = packageJson.name;

export { id };
```

### Step 4: Create src/index.tsx

```typescript
import { id } from './id';

// Define extension references
const ohif = {
  layout: '@ohif/extension-default.layoutTemplateModule.viewerLayout',
  sopClassHandler: '@ohif/extension-default.sopClassHandlerModule.stack',
  leftPanel: '@ohif/extension-default.panelModule.seriesList',
};

const cornerstone = {
  viewport: '@ohif/extension-cornerstone.viewportModule.cornerstone',
  measurements: '@ohif/extension-cornerstone.panelModule.panelMeasurement',
};

// Define extension dependencies
const extensionDependencies = {
  '@ohif/extension-default': '^3.0.0',
  '@ohif/extension-cornerstone': '^3.0.0',
};

// Mode factory function
function modeFactory({ modeConfiguration }) {
  return {
    id,
    routeName: 'my-custom-mode',
    displayName: 'My Custom Mode',
    
    // Lifecycle hooks
    onModeEnter: ({ servicesManager, extensionManager, commandsManager }: withAppTypes) => {
      const { toolbarService, toolGroupService } = servicesManager.services;
      
      // Initialize tool groups, register toolbar buttons, etc.
      // Clear measurements, set up subscriptions, etc.
    },
    
    onModeExit: ({ servicesManager }: withAppTypes) => {
      const { toolGroupService, uiDialogService, uiModalService } = servicesManager.services;
      
      // Cleanup: hide dialogs, destroy services, unsubscribe, etc.
      uiDialogService.hideAll();
      uiModalService.hide();
      toolGroupService.destroy();
    },
    
    // Validation
    validationTags: {
      study: [],
      series: [],
    },
    
    isValidMode: ({ modalities }) => {
      // Return { valid: boolean, description: string }
      return {
        valid: true,
        description: 'Mode is valid for all modalities',
      };
    },
    
    // Routes configuration
    routes: [
      {
        path: 'my-custom-mode',
        layoutTemplate: ({ location, servicesManager }) => {
          return {
            id: ohif.layout,
            props: {
              leftPanels: [ohif.leftPanel],
              leftPanelResizable: true,
              rightPanels: [cornerstone.measurements],
              rightPanelResizable: true,
              viewports: [
                {
                  namespace: cornerstone.viewport,
                  displaySetsToDisplay: [ohif.sopClassHandler],
                },
              ],
            },
          };
        },
      },
    ],
    
    // Extensions
    extensions: extensionDependencies,
    
    // Hanging protocol
    hangingProtocol: 'default',
    
    // SOP class handlers
    sopClassHandlers: [ohif.sopClassHandler],
    
    // Apply any custom configuration
    ...modeConfiguration,
  };
}

// Export mode object
const mode = {
  id,
  modeFactory,
  extensionDependencies,
};

export default mode;
```

### Step 5: Register the Mode

**IMPORTANT**: Use the CLI to register modes, do NOT manually edit `pluginConfig.json`.

```bash
# From the platform root directory
yarn run cli add-mode @ohif/mode-my-custom-mode
```

The CLI will:
- Validate the mode package
- Install npm package
- Add to `pluginConfig.json`
- Install required extension dependencies

### Step 6: Configure Mode (Optional)

In your app configuration file (e.g., `config/my-config.js`):

```javascript
window.config = {
  // ... other config
  modesConfiguration: {
    '@ohif/mode-my-custom-mode': {
      hide: { $set: false },
      displayName: { $set: 'Custom Display Name' },
      // Use immutability-helper syntax for updates
    },
  },
};
```

## Extending an Existing Mode

### Method 1: Extend from Basic Mode (Recommended)

The `basic` mode is designed to be extended. Example from `longitudinal` mode:

```typescript
import { 
  mode as basicMode,
  modeInstance as basicModeInstance,
  basicLayout,
  basicRoute,
  extensionDependencies as basicDependencies,
} from '@ohif/mode-basic';

// Add additional extension dependencies
export const extensionDependencies = {
  ...basicDependencies,
  '@ohif/extension-measurement-tracking': '^3.0.0',
};

// Extend the layout
export const myExtendedLayout = {
  ...basicLayout,
  id: ohif.layout,
  props: {
    ...basicLayout.props,
    leftPanels: [tracked.thumbnailList], // Override left panel
    rightPanels: [
      ...basicLayout.props.rightPanels,
      tracked.measurements, // Add new panel
    ],
  },
};

// Extend the route
export const myExtendedRoute = {
  ...basicRoute,
  path: 'my-extended-mode',
  layoutInstance: myExtendedLayout,
};

// Extend mode instance
export const modeInstance = {
  ...basicModeInstance,
  id,
  routeName: 'my-extended-mode',
  displayName: 'My Extended Mode',
  routes: [myExtendedRoute],
  extensions: extensionDependencies,
};

const mode = {
  ...basicMode,
  id,
  modeInstance,
  extensionDependencies,
};

export default mode;
```

### Method 2: Use modeConfiguration Parameter

Modes that support `modeConfiguration` can be customized via app config:

```javascript
// In app-config.js
modesConfiguration: {
  '@ohif/mode-basic': {
    displayName: { $set: 'Custom Basic' },
    routes: {
      0: {
        path: { $set: 'custom-path' },
      },
    },
  },
};
```

The mode factory receives this configuration:

```typescript
function modeFactory({ modeConfiguration }) {
  let modeInstance = this.modeInstance;
  if (modeConfiguration) {
    // Use immutability-helper to merge
    modeInstance = update(modeInstance, modeConfiguration);
  }
  return modeInstance;
}
```

## Maintaining a Mode

### Updating Extension Dependencies

1. Update `extensionDependencies` in `src/index.tsx`:
```typescript
const extensionDependencies = {
  '@ohif/extension-default': '^3.1.0', // Updated version
  '@ohif/extension-cornerstone': '^3.1.0',
};
```

2. Update `peerDependencies` in `package.json`:
```json
"peerDependencies": {
  "@ohif/extension-default": "3.12.0-beta.85",
  "@ohif/extension-cornerstone": "3.12.0-beta.85"
}
```

3. Rebuild and test:
```bash
yarn build
```

### Adding New Features

1. **Add new panels**: Reference extension panel modules in layout:
```typescript
rightPanels: [
  cornerstone.measurements,
  'my-extension.panelModule.myPanel', // New panel
],
```

2. **Add new viewports**: Add to viewports array:
```typescript
viewports: [
  {
    namespace: cornerstone.viewport,
    displaySetsToDisplay: [ohif.sopClassHandler],
  },
  {
    namespace: 'my-extension.viewportModule.myViewport',
    displaySetsToDisplay: ['my-extension.sopClassHandlerModule.myHandler'],
  },
],
```

3. **Add toolbar buttons**: Create `toolbarButtons.ts`:
```typescript
import { ToolbarService } from '@ohif/core';

export default [
  {
    id: 'myCustomButton',
    type: 'ohif.radioGroup',
    props: {
      // Button configuration
    },
  },
];
```

Then register in `onModeEnter`:
```typescript
toolbarService.register(toolbarButtons);
```

### Debugging Modes

1. **Check mode registration**: Verify in `pluginConfig.json` (read-only, use CLI)
2. **Check extension availability**: Ensure all extension dependencies are installed
3. **Check route path**: Verify route path matches URL
4. **Check isValidMode**: Ensure mode validation logic is correct
5. **Check lifecycle hooks**: Add console.logs in `onModeEnter`/`onModeExit`

## Merging Modes

### Combining Features from Multiple Modes

When merging features from multiple modes:

1. **Identify shared dependencies**: Combine `extensionDependencies`
2. **Merge layouts**: Combine panels and viewports
3. **Merge lifecycle hooks**: Combine initialization logic
4. **Merge routes**: May need multiple routes or combined route

Example merging segmentation and longitudinal:

```typescript
import { 
  mode as basicMode,
  basicLayout,
} from '@ohif/mode-basic';
import { 
  tracked,
  extensionDependencies as trackingDeps,
} from '@ohif/mode-longitudinal';
import {
  cornerstone as segCornerstone,
  extensionDependencies as segDeps,
} from '@ohif/mode-segmentation';

// Merge dependencies
const extensionDependencies = {
  ...basicDependencies,
  ...trackingDeps,
  ...segDeps,
};

// Merge layout
const mergedLayout = {
  ...basicLayout,
  props: {
    ...basicLayout.props,
    leftPanels: [tracked.thumbnailList],
    rightPanels: [
      tracked.measurements,
      segCornerstone.labelMapSegmentationPanel,
      segCornerstone.contourSegmentationPanel,
    ],
    viewports: [
      ...basicLayout.props.viewports,
      {
        namespace: segCornerstone.segmentation.viewport,
        displaySetsToDisplay: [segCornerstone.segmentation.sopClassHandler],
      },
    ],
  },
};
```

## Removing a Mode

### Step 1: Use CLI to Remove

```bash
yarn run cli remove-mode @ohif/mode-name
```

This will:
- Remove from `pluginConfig.json`
- Uninstall npm package
- Remove unused extension dependencies (if not used by other modes)

### Step 2: Manual Cleanup (if needed)

If the mode directory still exists locally:

```bash
rm -rf Viewers/modes/mode-name
```

### Step 3: Update App Configuration

Remove mode from `modesConfiguration` in app config files:

```javascript
// Remove from modesConfiguration
modesConfiguration: {
  // '@ohif/mode-name': { ... }, // Remove this
},
```

## Best Practices

### 1. Mode Naming
- Use descriptive names: `mode-segmentation`, `mode-longitudinal`
- Follow package naming: `@ohif/mode-{name}`

### 2. Extension References
- Use string references: `'@ohif/extension-name.moduleType.elementName'`
- Store in constants for reusability:
```typescript
const ohif = {
  layout: '@ohif/extension-default.layoutTemplateModule.viewerLayout',
};
```

### 3. Lifecycle Management
- Always clean up subscriptions in `onModeExit`
- Clear measurements on `onModeEnter`
- Destroy services properly
- Hide dialogs/modals on exit

### 4. Validation
- Implement `isValidMode` to filter appropriate studies
- Use `modeModalities` for modality-specific modes
- Use `nonModeModalities` to exclude certain modalities

### 5. Configuration
- Support `modeConfiguration` parameter for customization
- Use immutability-helper for deep updates
- Document configurable properties

### 6. Error Handling
- Validate extension availability
- Handle missing dependencies gracefully
- Provide clear error messages

### 7. Testing
- Test with different study types
- Test lifecycle hooks
- Test route navigation
- Test with missing extensions

## Common Patterns

### Pattern 1: Simple Mode (Basic Viewer)

```typescript
function modeFactory({ modeConfiguration }) {
  return {
    id,
    routeName: 'simple',
    displayName: 'Simple Viewer',
    onModeEnter: ({ servicesManager }) => {
      // Minimal setup
    },
    onModeExit: ({ servicesManager }) => {
      // Minimal cleanup
    },
    routes: [{
      path: 'simple',
      layoutTemplate: () => ({
        id: ohif.layout,
        props: {
          leftPanels: [ohif.leftPanel],
          viewports: [{
            namespace: cornerstone.viewport,
            displaySetsToDisplay: [ohif.sopClassHandler],
          }],
        },
      }),
    }],
    extensions: extensionDependencies,
    hangingProtocol: 'default',
    sopClassHandlers: [ohif.sopClassHandler],
    ...modeConfiguration,
  };
}
```

### Pattern 2: Extending Basic Mode

```typescript
import { 
  mode as basicMode,
  modeInstance as basicModeInstance,
  basicLayout,
  basicRoute,
} from '@ohif/mode-basic';

const modeInstance = {
  ...basicModeInstance,
  id,
  routeName: 'extended',
  displayName: 'Extended Mode',
  routes: [{
    ...basicRoute,
    path: 'extended',
    layoutInstance: {
      ...basicLayout,
      props: {
        ...basicLayout.props,
        // Override specific props
      },
    },
  }],
};

const mode = {
  ...basicMode,
  id,
  modeInstance,
};
```

### Pattern 3: Multi-Route Mode

```typescript
routes: [
  {
    path: 'mode-route-1',
    layoutTemplate: () => layout1,
  },
  {
    path: 'mode-route-2',
    layoutTemplate: () => layout2,
  },
],
```

## Troubleshooting

### Mode Not Appearing in Study List
- Check `hide` property (should be `false` or undefined)
- Check `isValidMode` returns `{ valid: true }`
- Verify mode is registered in `pluginConfig.json`
- Check browser console for errors

### Extension Not Found
- Verify extension is in `extensionDependencies`
- Check extension is installed
- Verify extension ID matches exactly
- Check extension module path format: `extensionId.moduleType.elementName`

### Route Not Working
- Verify route `path` matches URL
- Check route is in `routes` array
- Verify `layoutTemplate` function returns valid layout
- Check for JavaScript errors in console

### Lifecycle Issues
- Ensure subscriptions are stored and unsubscribed
- Check service destruction order
- Verify cleanup in `onModeExit`
- Check for memory leaks

## References

- [OHIF Modes Documentation](https://docs.ohif.org/platform/modes/)
- [OHIF Modes Gallery](https://ohif.org/modes/)
- [OHIF CLI Documentation](https://docs.ohif.org/development/ohif-cli/)
- [Extension Development Guide](https://docs.ohif.org/platform/extensions/)

## Example Modes to Study

1. **basic**: Base mode for extension (`Viewers/modes/basic/`)
2. **longitudinal**: Extends basic with tracking (`Viewers/modes/longitudinal/`)
3. **segmentation**: Segmentation editing mode (`Viewers/modes/segmentation/`)
4. **microscopy**: Specialized microscopy viewer (`Viewers/modes/microscopy/`)
5. **tmtv**: PET/CT fusion mode (`Viewers/modes/tmtv/`)

Study these examples to understand different patterns and approaches.

