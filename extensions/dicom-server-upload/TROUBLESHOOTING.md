# Troubleshooting Guide

## Fixed Issues

### 1. ✅ React is not defined - FIXED
**Problem**: `ReferenceError: React is not defined`

**Solution**: Added `import React from 'react';` to `src/index.tsx`

The component was using JSX syntax without importing React, which caused the error at runtime.

### 2. ✅ Icon not found - FIXED
**Problem**: `icon-upload` doesn't exist in OHIF's icon set

**Solution**: Changed to `tab-patient-info` which is a valid OHIF icon

You can use any of these valid OHIF icons:
- `tab-studies`
- `tab-linear`
- `tab-segmentation`
- `tab-contours`
- `tab-patient-info` (currently used)
- `tab-4d`
- `tool-more-menu`
- `tool-crosshair`
- `tool-rectangle`

### 3. ✅ Module resolution - FIXED
**Problem**: Failed to resolve module specifier

**Solution**: 
- Added extension to `Viewers/platform/app/pluginConfig.json`
- Added dependency to `Viewers/platform/app/package.json`
- Updated peer dependencies to match OHIF versions exactly

## Installation Steps

Now that all fixes are in place, follow these steps:

### Step 1: Install Dependencies from Root

```bash
cd Viewers
yarn install
```

This will install all dependencies including the react-uploady packages for your extension.

### Step 2: Restart the Development Server

```bash
cd Viewers
yarn dev
```

Or if you're using orthanc:

```bash
yarn dev:orthanc
```

### Step 3: Verify Extension Loaded

1. Open browser console (F12)
2. Look for: `🔧 [DicomServerUpload] Extension pre-registration`
3. Check Network tab for any failed module loads

### Step 4: Access the Upload Panel

1. Open a study in segmentation mode
2. Look for the right panel tabs
3. You should see a panel icon for "DICOM Upload"
4. Click it to open the upload interface

## Common Issues

### Issue: Extension still not loading

**Check 1**: Verify pluginConfig.json has the entry
```json
{
  "packageName": "@ohif/extension-dicom-server-upload",
  "version": "3.0.0"
}
```

**Check 2**: Verify package.json has the dependency
```json
"@ohif/extension-dicom-server-upload": "3.12.0-beta.85"
```

**Check 3**: Clear cache and reinstall
```bash
cd Viewers
rm -rf node_modules
yarn install
```

### Issue: React-uploady modules not found

**Solution**: Install from root
```bash
cd Viewers
yarn install
```

The workspace will link the extension's dependencies automatically.

### Issue: TypeScript errors

**Check**: Ensure types are imported correctly
```typescript
import type { Stage, DicomServerUploadProps } from './types';
```

### Issue: Build errors

Since this is a workspace extension, building is handled by the main app's webpack configuration. You don't need to build the extension separately.

If you get build errors:
1. Check that all imports use correct paths
2. Verify peer dependencies match exactly
3. Clear webpack cache: `yarn dev:no:cache`

## Verification Checklist

- [ ] Extension loads without errors
- [ ] Panel appears in segmentation mode
- [ ] Upload button is visible
- [ ] Server URL input is editable
- [ ] Progress bar components render
- [ ] Console shows no React errors
- [ ] No missing module errors

## Quick Test

1. Open OHIF in browser: `http://localhost:3000`
2. Load any study
3. Switch to segmentation mode
4. Open "DICOM Upload" panel (right side)
5. You should see:
   - Server URL input field
   - "Select DICOM Files" button
   - Info panel at bottom

## Files Updated

### ✅ Fixed Files
- `src/index.tsx` - Added React import, changed icon
- `package.json` - Updated peer dependencies and scripts
- `Viewers/platform/app/pluginConfig.json` - Registered extension
- `Viewers/platform/app/package.json` - Added dependency

### ✅ Already Correct
- `src/DicomServerUpload.tsx` - React properly imported
- `src/MultiStageProgressBar.tsx` - React properly imported
- `src/types.ts` - All types defined correctly

## Next Steps

1. **Test Upload Flow**:
   ```bash
   cd examples
   npm install
   npm start
   ```
   This starts the sample server on port 8080.

2. **Try Upload**:
   - Enter server URL: `http://localhost:8080/upload`
   - Click upload button
   - Select a DICOM file
   - Watch progress bar animate

3. **Customize** (optional):
   - Change icon in `src/index.tsx` (line 35)
   - Adjust progress stages in `src/DicomServerUpload.tsx`
   - Modify colors in `src/MultiStageProgressBar.tsx`

## Getting Help

If issues persist:

1. **Check browser console** for specific error messages
2. **Check terminal** running OHIF for build errors
3. **Verify all files** match the updated versions
4. **Try clean install**:
   ```bash
   cd Viewers
   rm -rf node_modules yarn.lock
   yarn install
   ```

5. **Check OHIF logs** for extension registration:
   - Should see: `🔧 [DicomServerUpload] Extension pre-registration`
   - Should NOT see: Module resolution errors

## Success Indicators

✅ Extension loaded successfully when you see:
- No console errors related to the extension
- Panel icon appears in segmentation mode
- Upload interface renders correctly
- All components are interactive

---

**Status**: All major issues fixed ✅  
**Last Updated**: December 23, 2025  
**Version**: 3.12.0-beta.85

