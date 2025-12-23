# Quick Start Guide

Get the DICOM Server Upload extension up and running in 5 minutes!

## ⚡ Quick Install

```bash
# 1. Install dependencies
cd Viewers/extensions/dicom-server-upload
npm install

# 2. Build extension
npm run build

# 3. Return to root and rebuild app
cd ../../../
yarn build
```

## 🚀 Quick Test

### Option 1: Test with Mock Server (Included)

The extension includes simulation mode for testing without a real server.

1. Start OHIF viewer:
```bash
cd platform/app
yarn dev
```

2. Open browser to `http://localhost:3000`
3. Open a study in segmentation mode
4. Click the "DICOM Upload" panel on the right
5. Click "Select DICOM Files" button
6. Watch the progress bar animate through all stages!

### Option 2: Test with Real Server

Create a simple test server:

```javascript
// server.js
const express = require('express');
const multer = require('multer');
const cors = require('cors');

const app = express();
app.use(cors());

const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.array('files'), (req, res) => {
  console.log(`Received ${req.files.length} files`);
  res.json({ success: true, message: 'Upload successful' });
});

app.listen(8080, () => console.log('Server ready on :8080'));
```

Run it:

```bash
node server.js
```

## 📋 Basic Usage

### In the UI:

1. **Set Server URL**: Enter your upload endpoint (e.g., `http://localhost:8080/upload`)
2. **Select Files**: Click the upload button and choose DICOM files
3. **Monitor Progress**: Watch the multi-stage progress bar
   - 🔵 Upload (0-30%)
   - 🟡 Processing (30-80%)
   - 🟢 Download (80-100%)
4. **Cancel Upload** (optional): Click the red "✕ Cancel" button during upload stage to abort
5. **Reset**: Click "Reset Upload" to start over

### Programmatically:

```typescript
// Open the upload panel
commandsManager.runCommand('openDicomUploadPanel');
```

## 🎨 Customization Quick Tips

### Change Default Server URL

**File**: `src/DicomServerUpload.tsx`

```typescript
const [serverUrl, setServerUrl] = useState('https://your-server.com/upload');
```

### Adjust Progress Stages

**File**: `src/DicomServerUpload.tsx`

```typescript
const [stages, setStages] = useState<Stage[]>([
  { name: 'Upload', startPercent: 0, endPercent: 25, status: 'pending' },
  { name: 'Process', startPercent: 25, endPercent: 75, status: 'pending' },
  { name: 'Results', startPercent: 75, endPercent: 100, status: 'pending' },
]);
```

### Change Colors

**File**: `src/MultiStageProgressBar.tsx`

```typescript
// Find the color definitions and change them
circleColor = '#YOUR_COLOR';
```

## 🔧 Integration Checklist

- [ ] Extension built successfully
- [ ] Added to `extensionDependencies` in your mode
- [ ] Panel added to `rightPanels` in layout
- [ ] Server URL configured
- [ ] CORS enabled on server
- [ ] Upload endpoint returns JSON response
- [ ] Tested file upload flow
- [ ] Progress bar displays correctly

## 📚 File Structure

```
dicom-server-upload/
├── src/
│   ├── index.tsx                   # Extension entry point
│   ├── DicomServerUpload.tsx       # Main component
│   ├── MultiStageProgressBar.tsx   # Progress visualization
│   └── id.ts                       # Extension ID
├── package.json                    # Dependencies
├── README.md                       # Full documentation
├── INSTALLATION.md                 # Detailed installation
└── QUICKSTART.md                   # This file
```

## 🐛 Quick Fixes

### Panel Not Showing?
```typescript
// Check mode's rightPanels array includes:
'@ohif/extension-dicom-server-upload.panelModule.dicomServerUpload'
```

### Upload Not Working?
```bash
# Check CORS on your server
curl -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -X OPTIONS http://localhost:8080/upload
```

### Build Errors?
```bash
# Clean and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 🎯 Next Steps

1. ✅ **Test**: Verify basic upload works
2. 🔗 **Integrate**: Connect to your real backend API
3. 🎨 **Customize**: Adjust UI to match your branding
4. 🔐 **Secure**: Add authentication/authorization
5. 📊 **Monitor**: Add analytics and error tracking

## 💡 Pro Tips

- Use browser DevTools Network tab to debug uploads
- Check console for helpful log messages (look for `[Upload Progress]`)
- Test with small DICOM files first
- Enable CORS properly before testing
- Use the simulation mode to test UI without a server

## 📖 Full Documentation

For detailed information, see:
- [README.md](./README.md) - Complete feature documentation
- [INSTALLATION.md](./INSTALLATION.md) - Step-by-step installation guide

## 🆘 Help

Need help? Check:
- Browser console for errors
- Server logs for incoming requests
- [React Uploady Docs](https://react-uploady.org)
- [OHIF Documentation](https://docs.ohif.org)

---

**Happy Uploading! 🚀**

