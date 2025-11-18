# CSV Auto-Save to SyncForge Directory

## Overview

When users click the "CSV" export button in OHIF's measurement panel, the CSV file is now automatically saved to the `syncforge` directory structure in addition to downloading to the browser.

## Implementation

### Frontend Changes

**File:** `platform/core/src/utils/downloadCSVReport.js`

- Modified `downloadCSVReport()` to call `_saveCSVToSurgicalCase()` after browser download
- New function `_saveCSVToSurgicalCase()` extracts StudyInstanceUID and SeriesInstanceUID
- Generates timestamped filename: `measurements-YYYY-MM-DDTHH-MM-SS.csv`
- Calls backend API endpoint: `POST /api/syncforge/save-csv`
- Gracefully handles errors (browser download still works if backend unavailable)

### Backend API

**Files Created:**
- `syncforge/api/saveMeasurementCSV.js` - API endpoint handler
- `syncforge/api/server.js` - Standalone Express server example

**API Endpoint:**
```
POST /api/syncforge/save-csv
Content-Type: application/json

{
  "studyInstanceUID": "1.2.840.113619.2.55.3...",
  "seriesInstanceUID": "1.2.840.113619.2.55.3...",
  "filename": "measurements-2025-11-07T22-05-01.csv",
  "csvContent": "Patient ID,Patient Name,...\n..."
}
```

**Response:**
```json
{
  "success": true,
  "filePath": "/path/to/syncforge/studies/.../measurements-2025-11-07T22-05-01.csv",
  "relativePath": "syncforge/studies/.../measurements-2025-11-07T22-05-01.csv",
  "message": "CSV file saved successfully"
}
```

## File Structure

CSV files are saved to:
```
syncforge/
└── studies/
    └── {StudyInstanceUID}/
        └── {SeriesInstanceUID}/
            ├── measurements-2025-11-07T22-05-01.csv
            ├── measurements-2025-11-07T22-10-15.csv
            └── ...
```

## Usage

### Quick Start

1. **Start the backend server:**
   ```bash
   npm install express  # If not already installed
   node syncforge/api/server.js
   ```

2. **In OHIF:**
   - Load a study with measurements
   - Click "CSV" button in measurement panel
   - CSV downloads to browser ✅
   - CSV also saved to `syncforge/studies/.../` ✅

### Integration with Existing Backend

If you already have a Node.js/Express backend:

```javascript
const { saveMeasurementCSVRoute } = require('./syncforge/api/saveMeasurementCSV');

app.use(express.json());
app.post('/api/syncforge/save-csv', saveMeasurementCSVRoute);
```

### Custom Configuration

**Change API URL:**
Edit `platform/core/src/utils/downloadCSVReport.js`:
```javascript
const response = await fetch('http://your-backend:port/api/syncforge/save-csv', {
```

**Change workspace root:**
Set environment variable:
```bash
OHIF_WORKSPACE_ROOT=/path/to/Viewers node server.js
```

## Error Handling

- ✅ Browser download always works (even if backend fails)
- ⚠️ Backend errors are logged but don't interrupt workflow
- 📝 Check browser console for save status messages

## Testing

1. Start backend server: `node syncforge/api/server.js`
2. Load study in OHIF
3. Add some measurements (fiducials, lengths, etc.)
4. Click "CSV" export button
5. Check:
   - CSV downloads to browser ✅
   - File appears in `syncforge/studies/{StudyInstanceUID}/{SeriesInstanceUID}/` ✅
   - Console shows success message ✅

## Benefits

✅ **Automatic backup** - All CSV exports are saved automatically
✅ **Organized by study** - Easy to find measurements for specific cases
✅ **Timestamped** - Multiple exports don't overwrite each other
✅ **Non-intrusive** - Browser download still works if backend unavailable
✅ **Production-ready** - Error handling and validation included

## Future Enhancements

- [ ] Save JSON exports similarly
- [ ] Add UI notification when file is saved
- [ ] Support for multiple studies in one export
- [ ] Automatic cleanup of old CSV files
- [ ] Export history tracking
