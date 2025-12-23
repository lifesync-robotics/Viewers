# OHIF DICOM Server Upload Extension

An OHIF extension for uploading DICOM series to a server with multi-stage progress tracking.

## Features

- 📤 **File Upload**: Upload DICOM files using drag-and-drop or file picker
- 🌐 **Configurable Server**: Specify custom server URL endpoint
- 📊 **Multi-Stage Progress**: Visual progress tracking across three stages:
  - **Upload** (0-30%): Sending files to server
  - **Processing** (30-80%): Server-side processing
  - **Download** (80-100%): Retrieving results
- 🛑 **Cancel Upload**: Abort uploads in progress during upload stage
- 🎨 **Modern UI**: Beautiful, responsive interface with OHIF styling and white text for readability
- ⚡ **React Uploady**: Powered by [react-uploady](https://github.com/rpldy/react-uploady)

## Installation

### 1. Install the extension

```bash
cd Viewers/extensions/dicom-server-upload
npm install
```

### 2. Build the extension

```bash
npm run build
```

### 3. Register in OHIF

Add to your mode's `extensionDependencies`:

```typescript
const extensionDependencies = {
  '@ohif/extension-default': '^3.0.0',
  '@ohif/extension-cornerstone': '^3.0.0',
  '@ohif/extension-dicom-server-upload': '^3.0.0',
};
```

### 4. Add panel to layout

Include the panel in your mode's layout:

```typescript
const layout = {
  id: ohif.layout,
  props: {
    leftPanels: [ohif.leftPanel],
    rightPanels: [
      '@ohif/extension-dicom-server-upload.panelModule.dicomServerUpload',
    ],
    viewports: [/* ... */],
  },
};
```

## Usage

### Basic Usage

The extension provides a panel component that can be added to any OHIF mode. Once added, users can:

1. **Configure Server URL**: Enter the endpoint URL where files should be uploaded
2. **Select Files**: Click the upload button to choose DICOM files
3. **Monitor Progress**: Watch the multi-stage progress bar as files are processed
4. **Reset**: Reset the upload state to start a new upload

### Server Configuration

The server endpoint should accept `POST` requests with multipart/form-data containing DICOM files.

Expected server response format:

```json
{
  "success": true,
  "message": "Files uploaded successfully",
  "data": {
    "processedFiles": 5,
    "resultUrl": "http://server/results/123"
  }
}
```

### Programmatic Control

Use the command to open the panel programmatically:

```typescript
commandsManager.runCommand('openDicomUploadPanel');
```

## Integration with Segmentation Mode

This extension integrates seamlessly with OHIF's segmentation mode:

```typescript
import { id } from './id';

const extensionDependencies = {
  '@ohif/extension-default': '^3.0.0',
  '@ohif/extension-cornerstone': '^3.0.0',
  '@ohif/extension-cornerstone-dicom-seg': '^3.0.0',
  '@ohif/extension-dicom-server-upload': '^3.0.0', // Add this
};

// In your mode layout:
rightPanels: [
  cornerstone.contourSegmentationPanel,
  cornerstone.labelMapSegmentationPanel,
  '@ohif/extension-dicom-server-upload.panelModule.dicomServerUpload', // Add this
],
```

## Dependencies

- **@rpldy/uploady**: Core upload functionality
- **@rpldy/upload-button**: Upload button component
- **@rpldy/upload-drop-zone**: Drag-and-drop support
- **react**: ^18.0.0
- **react-dom**: ^18.0.0

## Development

### Building

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

## Architecture

### Components

1. **DicomServerUpload** (Main Component)
   - Manages server URL configuration
   - Wraps Uploady provider
   - Handles overall upload flow

2. **DicomServerUploadInternal** (Upload Logic)
   - Uses react-uploady hooks
   - Manages upload state and progress
   - Coordinates stage transitions

3. **MultiStageProgressBar** (Progress Display)
   - Visualizes overall progress (0-100%)
   - Shows stage stepper (Upload → Processing → Download)
   - Displays per-stage progress

### Data Flow

```
User clicks upload
    ↓
Files selected
    ↓
Upload Stage (0-30%)
    ↓
Processing Stage (30-80%)
    ↓
Download Stage (80-100%)
    ↓
Complete / Error
```

## Customization

### Adjusting Stage Percentages

Modify the stage configuration in `DicomServerUpload.tsx`:

```typescript
const [stages, setStages] = useState<Stage[]>([
  { name: 'Upload', startPercent: 0, endPercent: 25, status: 'pending' },
  { name: 'Processing', startPercent: 25, endPercent: 75, status: 'pending' },
  { name: 'Download', startPercent: 75, endPercent: 100, status: 'pending' },
]);
```

### Custom Styling

All components use inline styles for easy customization. Modify colors, spacing, and typography directly in the component files.

### Server Integration

For real server integration, replace the simulation functions:

```typescript
// Replace simulateServerProcessing with actual API call
const checkProcessingStatus = async (uploadId: string) => {
  const response = await fetch(`${serverUrl}/status/${uploadId}`);
  const data = await response.json();
  return data.progress; // 0-100
};
```

## Troubleshooting

### Extension Not Loading

1. Verify extension is built: `npm run build`
2. Check extension is registered in mode
3. Verify all dependencies are installed

### Upload Not Working

1. Check server URL is correct
2. Verify CORS settings on server
3. Check browser console for errors
4. Ensure server accepts multipart/form-data

### Progress Not Updating

1. Verify react-uploady hooks are inside `<Uploady>` component
2. Check server sends proper progress events
3. Enable verbose logging in component

## License

MIT

## Credits

- Built with [react-uploady](https://github.com/rpldy/react-uploady)
- Part of the [OHIF Viewer](https://github.com/OHIF/Viewers) project

