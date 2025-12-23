# Installation Guide: DICOM Server Upload Extension

This guide walks you through installing and integrating the DICOM Server Upload extension into your OHIF Viewer instance.

## Prerequisites

- Node.js 18+ and npm/yarn installed
- OHIF Viewer project (v3.x)
- Basic understanding of OHIF extensions and modes

## Step-by-Step Installation

### 1. Navigate to the Extension Directory

```bash
cd Viewers/extensions/dicom-server-upload
```

### 2. Install Dependencies

Install all required npm packages including react-uploady:

```bash
npm install
```

Or with yarn:

```bash
yarn install
```

This will install:
- `@rpldy/uploady` - Core upload functionality
- `@rpldy/upload-button` - Upload button component
- `@rpldy/upload-drop-zone` - Drag-and-drop support

### 3. Build the Extension

Build the extension for production:

```bash
npm run build
```

Or for development with watch mode:

```bash
npm run dev
```

### 4. Register the Extension

The extension needs to be registered with OHIF. This is typically done in your mode's `index.tsx` file.

#### Example: Integrating with Segmentation Mode

Open `Viewers/modes/segmentation/src/index.tsx` and update it:

```typescript
// Add the upload panel reference
const dicomUpload = {
  panel: '@ohif/extension-dicom-server-upload.panelModule.dicomServerUpload',
};

// Add to extension dependencies
const extensionDependencies = {
  '@ohif/extension-default': '^3.0.0',
  '@ohif/extension-cornerstone': '^3.0.0',
  '@ohif/extension-cornerstone-dicom-seg': '^3.0.0',
  '@ohif/extension-cornerstone-dicom-rt': '^3.0.0',
  '@ohif/extension-dicom-server-upload': '^3.0.0', // Add this line
};

// Add to the layout's rightPanels
routes: [
  {
    path: 'template',
    layoutTemplate: ({ location, servicesManager }) => {
      return {
        id: ohif.layout,
        props: {
          leftPanels: [ohif.leftPanel],
          rightPanels: [
            cornerstone.contourSegmentationPanel,
            cornerstone.labelMapSegmentationPanel,
            dicomUpload.panel, // Add this line
          ],
          // ... rest of layout
        },
      };
    },
  },
],
```

### 5. Update Your App Configuration

If you use a custom OHIF app configuration (e.g., `platform/app/public/config/default.js`), ensure the extension is registered:

```javascript
window.config = {
  extensions: [
    '@ohif/extension-default',
    '@ohif/extension-cornerstone',
    '@ohif/extension-cornerstone-dicom-seg',
    '@ohif/extension-cornerstone-dicom-rt',
    '@ohif/extension-dicom-server-upload', // Add this
  ],
  // ... rest of config
};
```

### 6. Install Extension Package in Your App

From the OHIF platform root directory:

```bash
# If using workspace/monorepo setup
yarn workspaces run build

# Or install the extension package directly
cd platform/app
yarn add @ohif/extension-dicom-server-upload
```

### 7. Rebuild Your Application

```bash
cd platform/app
yarn run build
```

Or for development mode:

```bash
yarn run dev
```

## Verification

### Check Extension is Loaded

1. Start your OHIF application
2. Open browser DevTools (F12)
3. Check console for extension registration message:
   ```
   🔧 [DicomServerUpload] Extension pre-registration
   ```

### Access the Upload Panel

1. Open a study in the segmentation mode
2. Look for the right panel tabs
3. Click on the "DICOM Upload" or upload icon tab
4. You should see the upload interface with:
   - Server URL input field
   - Upload button
   - Progress tracking area

## Configuration

### Server URL

By default, the extension uses `http://localhost:8080/upload` as the server endpoint. Users can change this in the UI.

To set a default server URL, modify `DicomServerUpload.tsx`:

```typescript
const [serverUrl, setServerUrl] = useState('https://your-server.com/upload');
```

### Accepted File Types

The extension accepts DICOM files by default. To customize:

```typescript
<Uploady
  destination={{ url: serverUrl, method: 'POST' }}
  multiple={true}
  accept="application/dicom,.dcm,.dicom" // Customize here
  autoUpload={false}
>
```

### Progress Stage Percentages

Adjust stage percentages in `DicomServerUpload.tsx`:

```typescript
const [stages, setStages] = useState<Stage[]>([
  { name: 'Upload', startPercent: 0, endPercent: 30, status: 'pending' },
  { name: 'Processing', startPercent: 30, endPercent: 80, status: 'pending' },
  { name: 'Download', startPercent: 80, endPercent: 100, status: 'pending' },
]);
```

## Server Backend Setup

### Expected API Endpoint

The server should provide a `POST` endpoint that accepts multipart/form-data:

```
POST /upload
Content-Type: multipart/form-data
```

### Example Express.js Server

```javascript
const express = require('express');
const multer = require('multer');
const cors = require('cors');

const app = express();
app.use(cors());

const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.array('files'), (req, res) => {
  console.log('Received files:', req.files);
  
  // Process DICOM files here
  
  res.json({
    success: true,
    message: 'Files uploaded successfully',
    data: {
      processedFiles: req.files.length,
      uploadId: 'unique-id-123',
    },
  });
});

app.listen(8080, () => {
  console.log('Server running on http://localhost:8080');
});
```

### CORS Configuration

Ensure your server allows CORS requests from the OHIF viewer:

```javascript
app.use(cors({
  origin: 'http://localhost:3000', // Your OHIF URL
  methods: ['GET', 'POST'],
  credentials: true,
}));
```

## Troubleshooting

### Extension Not Appearing

**Issue**: Upload panel doesn't appear in the mode

**Solutions**:
1. Verify extension is built: `npm run build` in extension directory
2. Check extension is in `extensionDependencies`
3. Verify panel is added to `rightPanels` array
4. Check browser console for errors
5. Clear browser cache and restart

### Upload Button Not Working

**Issue**: Clicking upload button does nothing

**Solutions**:
1. Check server URL is accessible
2. Verify CORS is properly configured on server
3. Check browser console for network errors
4. Ensure react-uploady dependencies are installed
5. Verify Uploady component wraps the upload button

### Progress Bar Not Updating

**Issue**: Progress bar stays at 0% or doesn't move

**Solutions**:
1. Check server returns proper response
2. Verify hooks are inside `<Uploady>` component
3. Check `useItemProgressListener` is being called
4. Enable verbose logging in components
5. Check stage percentages are configured correctly

### Server Connection Failed

**Issue**: Cannot connect to server / Network error

**Solutions**:
1. Verify server is running on specified port
2. Check firewall settings
3. Ensure CORS headers are set correctly
4. Try with `http://` instead of `https://` for local testing
5. Check server logs for incoming requests

### Build Errors

**Issue**: Extension fails to build

**Solutions**:
1. Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
2. Clear npm cache: `npm cache clean --force`
3. Check Node.js version compatibility (18+)
4. Verify all peer dependencies are installed
5. Check for conflicting dependency versions

## Development Tips

### Hot Reload in Development

Use development mode for faster iteration:

```bash
cd Viewers/extensions/dicom-server-upload
npm run dev
```

And in your OHIF app:

```bash
cd platform/app
yarn run dev
```

### Debugging

Add console logs to track upload flow:

```typescript
useItemProgressListener((item) => {
  console.log('[Upload Progress]', {
    completed: item.completed,
    loaded: item.loaded,
    total: item.total,
  });
});
```

### Testing Without Server

The component includes simulation functions for testing. These automatically run after upload for demonstration purposes. For production, replace with real API calls.

## Additional Resources

- [React Uploady Documentation](https://react-uploady.org)
- [OHIF Extension Development Guide](https://docs.ohif.org/platform/extensions/)
- [OHIF Modes Documentation](https://docs.ohif.org/platform/modes/)

## Getting Help

If you encounter issues:

1. Check the [OHIF Community Forum](https://community.ohif.org)
2. Review [OHIF GitHub Issues](https://github.com/OHIF/Viewers/issues)
3. Check [React Uploady Examples](https://react-uploady.org/examples)

## Next Steps

After successful installation:

1. Customize the UI to match your branding
2. Integrate with your backend API
3. Add authentication if required
4. Implement real processing status checks
5. Add download result handling
6. Test with various DICOM file types

Congratulations! Your DICOM Server Upload extension is now installed and ready to use. 🎉

