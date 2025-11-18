# 3D Four Mesh - Quick Start Guide

## What is 3D Four Mesh?

The "3D Four Mesh" is a new viewport layout that extends the "3D Four Up" layout. It provides a 2x2 grid with one 3D viewport and three orthogonal slice views (axial, coronal, sagittal).

## Quick Access

### Via UI
1. Click the **Layout** button in the toolbar
2. Select **Advanced** presets
3. Click **3D four mesh**

### Via Code
```javascript
// Using commands manager
commandsManager.run({
  commandName: 'setHangingProtocol',
  commandOptions: {
    protocolId: 'fourUpMesh',
  },
});
```

## Layout Structure

```
┌─────────────────┬─────────────────┐
│                 │                 │
│   Axial View    │   3D Volume     │
│   (MPR 2D)      │   (Volume 3D)   │
│                 │                 │
├─────────────────┼─────────────────┤
│                 │                 │
│  Coronal View   │ Sagittal View   │
│   (MPR 2D)      │   (MPR 2D)      │
│                 │                 │
└─────────────────┴─────────────────┘
```

## Files Created/Modified

### New Files
- `extensions/cornerstone/src/hps/fourUpMesh.ts`
- `3D_FOUR_MESH_IMPLEMENTATION.md` (this guide's companion)

### Modified Files
- `extensions/cornerstone/src/getHangingProtocolModule.ts`
- `extensions/default/src/Toolbar/ToolbarLayoutSelector.tsx`
- `platform/i18n/src/locales/en-US/Hps.json`
- `platform/i18n/src/locales/zh/Hps.json`
- `platform/i18n/src/locales/test-LNG/Hps.json`

## Key Properties

| Property | Value |
|----------|-------|
| Protocol ID | `fourUpMesh` |
| Stage ID | `fourUpMeshStage` |
| Layout Type | Grid (2x2) |
| Icon | `layout-advanced-3d-four-up` |
| Translation Key | `Hps:3D four mesh` |

## Tool Groups

- **MPR Tool Group** (`mpr`): Used for 2D slice viewports
- **Volume 3D Tool Group** (`volume3d`): Used for 3D rendering

## Sync Groups

- **VOI Sync**: Window/level synchronization across MPR views
- **Hydrate Seg Sync**: Segmentation synchronization across all views

## Next Steps for Customization

To extend this viewport for mesh-specific functionality:

1. **Modify Viewport Options** in `fourUpMesh.ts`:
   ```typescript
   viewportOptions: {
     toolGroupId: 'volume3d',
     viewportType: 'volume3d',
     orientation: 'coronal',
     customViewportProps: {
       hideOverlays: true,
       // Add mesh-specific properties here
       enableMeshRendering: true,
       meshDisplayOptions: {...}
     },
   }
   ```

2. **Create Custom Tool Group** for mesh tools:
   - Add mesh manipulation tools
   - Configure mesh-specific rendering options
   - Set up mesh interaction handlers

3. **Add Mesh Loading** capabilities:
   - Create mesh loader service
   - Add mesh format support (STL, OBJ, etc.)
   - Integrate with viewport rendering

4. **Create Custom Icon** (optional):
   - Add new SVG icon in `platform/ui-next/src/components/Icons/Sources/Layout.tsx`
   - Register icon in `platform/ui-next/src/components/Icons/Icons.tsx`
   - Update `fourUpMesh.ts` icon property

## Troubleshooting

### Layout not appearing in UI
- Check if extension is loaded in mode configuration
- Verify hanging protocol is registered in `getHangingProtocolModule.ts`
- Check browser console for errors

### Translation not showing
- Ensure i18n files are properly formatted JSON
- Restart development server after changing i18n files
- Check that translation key matches exactly: `Hps:3D four mesh`

### Icon not displaying
- Verify icon name matches registered icon: `layout-advanced-3d-four-up`
- Check that Icons.tsx has the icon mapping
- Clear browser cache and rebuild

## Development Commands

```bash
# Install dependencies (if needed)
yarn install

# Start development server
yarn dev

# Build for production
yarn build

# Run linter
yarn lint

# Run tests
yarn test
```

## Support

For more detailed information, see:
- `3D_FOUR_MESH_IMPLEMENTATION.md` - Complete implementation details
- [OHIF Documentation](https://docs.ohif.org) - Framework documentation
- `extensions/cornerstone/src/hps/` - Other hanging protocol examples
