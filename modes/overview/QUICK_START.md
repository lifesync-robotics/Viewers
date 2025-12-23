# Overview Mode - Quick Start Guide

## 3 Steps to Install

### Step 1: Mode is Already Registered! ✅

The overview mode has been added to `Viewers/platform/app/pluginConfig.json`.

### Step 2: Build the Mode

```bash
cd Viewers/modes/overview
yarn install
yarn build
```

### Step 3: Start the Viewer

```bash
cd ../../platform/app
yarn dev
```

## Using the Mode

1. Open your browser to `http://localhost:3000`
2. Load a DICOM study
3. Click the mode selector
4. Select **"Overview 4×4 Grid"**
5. View 16 evenly-spaced frames!

## What You'll See

```
┌──────────┬─────────────────────────┬────────────┐
│          │   1    2    3    4      │            │
│ Thumb-   │   5    6    7    8      │  Tracked   │
│ nail     │   9   10   11   12      │  Measure-  │
│ List     │  13   14   15   16      │  ments     │
│          │                         │            │
└──────────┴─────────────────────────┴────────────┘
```

## Troubleshooting

### "Cannot find module '@ohif/mode-overview'"
```bash
cd Viewers/modes/overview
yarn build
```

### Grid not displaying
- Check browser console for errors
- Ensure series has images
- Try refreshing the page

### Mode not in selector
- Verify `pluginConfig.json` contains `"@ohif/mode-overview"`
- Restart dev server
- Clear browser cache

## Next Steps

- ✅ Test with different DICOM series
- ✅ Try the measurement tools
- ✅ Explore the evenly-spaced frame distribution
- ✅ Check out `README.md` for full documentation

**That's it! You're ready to use the Overview 4×4 Grid Mode!** 🎉

