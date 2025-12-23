# Overview Mode - Installation Guide

This guide explains how to register and use the Overview 4x4 Grid mode in your OHIF Viewer.

---

## Prerequisites

- OHIF Viewer v3.12.0 or later
- Node.js v14 or later
- Yarn v1.16.0 or later

---

## Installation Steps

### Quick Install (Recommended for Your Setup)

#### Step 1: Register in pluginConfig.json

Edit `Viewers/platform/app/pluginConfig.json` and add the overview mode to the `modes` array:

```json
{
  "extensions": [
    // ... existing extensions
  ],
  "modes": [
    // ... existing modes like @ohif/mode-longitudinal, etc.
    {
      "packageName": "@ohif/mode-overview"
    }
  ]
}
```

**Full example** (add after your existing modes):

```json
{
  "modes": [
    {
      "packageName": "@ohif/mode-longitudinal"
    },
    {
      "packageName": "@ohif/mode-navigation"
    },
    // ... other modes ...
    {
      "packageName": "@ohif/mode-overview"
    }
  ]
}
```

#### Step 2: Build the Mode

```bash
cd Viewers/modes/overview
yarn install
yarn build
```

This will create `dist/ohif-mode-overview.js`.

#### Step 3: Restart the Development Server

```bash
cd ../../platform/app
yarn dev
```

The mode will be automatically loaded from your local `modes/overview` directory.

#### Step 4: Optional - Configure the Mode

Edit your app configuration file (e.g., `platform/app/public/config/default.js`):

```javascript
window.config = {
  // ... other config
  modesConfiguration: {
    '@ohif/mode-overview': {
      // Optional: customize the mode
      displayName: 'Overview Grid',
      hide: false, // Set to true to hide from mode selector
    },
  },
};
```

---

## Verification

### 1. Check Mode Registration

Open `Viewers/platform/app/pluginConfig.json` and verify you see:

```json
{
  "modes": [
    // ... other modes ...
    {
      "packageName": "@ohif/mode-overview"
    }
  ]
}
```

### 2. Start the Development Server

```bash
cd Viewers/platform/app
yarn dev
```

### 3. Test the Mode

1. Open your browser to `http://localhost:3000`
2. Load a study
3. Click the mode selector
4. Select **"Overview 4x4 Grid"**
5. Verify the 4×4 grid displays

---

## Configuration Options

### Customizing Display Name

```javascript
modesConfiguration: {
  '@ohif/mode-overview': {
    displayName: { $set: 'Quick Overview' },
  },
}
```

### Hiding the Mode

```javascript
modesConfiguration: {
  '@ohif/mode-overview': {
    hide: { $set: true },
  },
}
```

### Setting as Default Mode

```javascript
window.config = {
  defaultMode: '@ohif/mode-overview',
  // ... other config
};
```

---

## Troubleshooting

### Error: "Mode not found"

**Cause**: Mode not registered in `pluginConfig.json`

**Solution**: Edit `Viewers/platform/app/pluginConfig.json` and add:
```json
{
  "modes": [
    {
      "packageName": "@ohif/mode-overview"
    }
  ]
}
```

Then restart the dev server.

### Error: "Extension not found"

**Cause**: Missing extension dependencies

**Solution**:
```bash
cd Viewers/platform/app
yarn install
```

### Error: "Cannot find module '@ohif/mode-overview'"

**Cause**: Mode not built

**Solution**:
```bash
cd Viewers/modes/overview
yarn build
cd ../../platform/app
yarn dev
```

The monorepo setup will automatically find the mode in `modes/overview`.

### Grid Not Displaying Correctly

**Cause**: Hanging protocol not loaded

**Solution**:
1. Check browser console for errors
2. Verify `hangingProtocols` is correctly defined in `src/index.ts`
3. Clear browser cache and reload

### Images Not Evenly Distributed

**Cause**: Series has fewer than 16 frames

**Solution**: The hanging protocol will still work, but some viewports may show duplicate frames or be empty. This is expected behavior for series with < 16 frames.

---

## Development

### Running in Development Mode

```bash
cd Viewers/modes/overview
yarn dev
```

This will watch for changes and rebuild automatically.

### Running Tests

```bash
cd Viewers/modes/overview
yarn test:unit
```

### Building for Production

```bash
cd Viewers/modes/overview
yarn build
```

Output will be in `dist/ohif-mode-overview.js`

---

## Integration with Monorepo

### Workspace Configuration

If using Yarn workspaces, add to root `package.json`:

```json
{
  "workspaces": [
    "platform/app",
    "platform/core",
    "platform/i18n",
    "platform/ui",
    "extensions/*",
    "modes/*"
  ]
}
```

### Installing Dependencies

```bash
# From repo root
yarn install
```

### Building All Modes

```bash
# From repo root
yarn run build:modes
```

---

## Deployment

### Production Build

```bash
cd Viewers/modes/overview
yarn build:package
```

### Publishing to npm (Optional)

```bash
cd Viewers/modes/overview
npm publish
```

### Docker Deployment

If deploying with Docker, ensure the mode is built before creating the image:

```dockerfile
# In your Dockerfile
WORKDIR /app/modes/overview
RUN yarn install && yarn build

WORKDIR /app/platform/app
RUN yarn install
```

---

## Updating the Mode

### Updating Dependencies

```bash
cd Viewers/modes/overview
yarn upgrade @ohif/core @ohif/extension-default @ohif/extension-cornerstone
```

### Syncing with Upstream OHIF

```bash
# Pull latest changes
git pull origin master

# Rebuild
yarn build
```

---

## Uninstalling

### Method 1: Using CLI

```bash
cd Viewers/platform/app
yarn run cli remove-mode @ohif/mode-overview
```

### Method 2: Manual

1. Remove from `pluginConfig.json`
2. Unlink the package:
   ```bash
   cd Viewers/platform/app
   yarn unlink @ohif/mode-overview
   ```
3. Remove mode directory:
   ```bash
   rm -rf Viewers/modes/overview
   ```

---

## Support

For issues or questions:

1. Check the [OHIF Documentation](https://docs.ohif.org)
2. Review [GitHub Issues](https://github.com/OHIF/Viewers/issues)
3. Ask on [OHIF Community Forum](https://community.ohif.org)

---

## Advanced Configuration

### Custom Hanging Protocol

To modify the frame distribution, edit `src/hangingProtocol.ts`:

```typescript
// Change to 3×3 grid
viewportStructure: {
  layoutType: 'grid',
  properties: {
    rows: 3,
    columns: 3,
  },
},
```

### Adding Custom Panels

To add additional panels, edit `src/index.ts`:

```typescript
export const overviewLayout = {
  id: ohif.layout,
  props: {
    leftPanels: [tracked.thumbnailList],
    rightPanels: [
      tracked.measurements,
      'your-extension.panelModule.customPanel', // Add custom panel
    ],
    // ...
  },
};
```

### Customizing Tools

To add or remove tools, modify the `toolGroupId` in the hanging protocol or create a custom `initToolGroups` function.

---

## Next Steps

1. ✅ Install and verify the mode works
2. ✅ Test with various DICOM series
3. ✅ Customize the layout if needed
4. ✅ Integrate with your workflow
5. ✅ Deploy to production

---

**Congratulations!** You've successfully installed the Overview 4x4 Grid mode. 🎉

