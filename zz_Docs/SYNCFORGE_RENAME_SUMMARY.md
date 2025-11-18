# SyncForge Rename Summary

## Overview

The `surgical_case` folder and API have been renamed to `syncforge` for better branding and clarity.

---

## Changes Made

### 1. Directory Rename
- **Old:** `surgical_case/`
- **New:** `syncforge/`

### 2. API Endpoints Updated

**Old Endpoints:**
- `POST /api/surgical-cases/save-csv`
- `GET /api/surgical-cases/list-csv`
- `GET /api/surgical-cases/get-csv`
- `POST /api/surgical-cases/save-json`
- `GET /api/surgical-cases/list-json`
- `GET /api/surgical-cases/get-json`

**New Endpoints:**
- `POST /api/syncforge/save-csv`
- `GET /api/syncforge/list-csv`
- `GET /api/syncforge/get-csv`
- `POST /api/syncforge/save-json`
- `GET /api/syncforge/list-json`
- `GET /api/syncforge/get-json`

### 3. Files Modified

**Server Files:**
- `syncforge/api/server.js` - Main server file
- `syncforge/api/saveMeasurementCSV.js` - CSV/JSON save handlers
- `syncforge/README.md` - Documentation

**Platform Core:**
- `platform/core/src/utils/downloadCSVReport.js`
- `platform/core/src/utils/loadSavedMeasurements.js`
- `platform/core/src/utils/saveMeasurementsJSON.js`

**Documentation:**
- `CSV_AUTO_SAVE_IMPLEMENTATION.md`

### 4. Variable Names Updated

- `SURGICAL_CASE_DIR` → `SYNCFORGE_DIR`
- `surgicalCaseDir` → `syncforgeDir`
- `surgical_case` → `syncforge` (directory paths)
- `surgical-cases` → `syncforge` (API paths)

---

## Server Status

✅ **Server Running:** `http://localhost:3001`

**New Server Output:**
```
═══════════════════════════════════════════════════════
🚀 OHIF SyncForge Storage Server
═══════════════════════════════════════════════════════
📡 Server running on: http://localhost:3001
📁 Workspace root: /home/asclepius/github/Viewers
💾 SyncForge dir: /home/asclepius/github/Viewers/syncforge
📋 CSV endpoint: POST http://localhost:3001/api/syncforge/save-csv
📋 JSON endpoint: POST http://localhost:3001/api/syncforge/save-json
═══════════════════════════════════════════════════════
```

---

## Directory Structure

```
syncforge/
├── api/
│   ├── server.js               # Express server
│   └── saveMeasurementCSV.js   # CSV/JSON handlers
├── README.md                   # Documentation
└── studies/
    └── {StudyInstanceUID}/
        └── {SeriesInstanceUID}/
            ├── measurements-*.csv
            └── measurements-*.json
```

---

## Testing

To test the renamed API:

1. **Server is already running on port 3001**
2. **Test health endpoint:**
   ```bash
   curl http://localhost:3001/api/health
   ```

3. **Expected response:**
   ```json
   {
     "status": "ok",
     "workspaceRoot": "/home/asclepius/github/Viewers",
     "syncforgeDir": "/home/asclepius/github/Viewers/syncforge"
   }
   ```

4. **Test in OHIF:**
   - Load a study
   - Create measurements
   - Click CSV export button
   - Files should save to `syncforge/studies/{StudyInstanceUID}/{SeriesInstanceUID}/`

---

## Migration Notes

### For Developers

If you have code that references the old API:

**Before:**
```javascript
fetch('/api/surgical-cases/save-csv', { ... })
```

**After:**
```javascript
fetch('/api/syncforge/save-csv', { ... })
```

### For Data

Existing data in `surgical_case/studies/` will need to be manually moved to `syncforge/studies/` if needed.

---

## Updated Commands

**Start SyncForge Server:**
```bash
node syncforge/api/server.js
```

**Or with custom settings:**
```bash
OHIF_WORKSPACE_ROOT=/path/to/Viewers PORT=3001 node syncforge/api/server.js
```

---

**Status:** ✅ Complete and tested
**Date:** 2025-11-07
