# Auto Screw Placement Feature - Implementation Summary

## Overview

Implemented auto screw placement feature that integrates OHIF Viewer with AnatomyGuru gRPC service to retrieve AI-generated pedicle screw placement data for vertebrae.

**Implementation Date:** December 21, 2025

## Architecture

```
┌─────────────────────────┐
│   OHIF Viewer (React)   │
│  ScrewManagementPanel   │
└───────────┬─────────────┘
            │ HTTP POST
            ↓
┌─────────────────────────┐
│  SyncForge API (Node.js)│
│   /api/anatomy/*        │
└───────────┬─────────────┘
            │ gRPC
            ↓
┌─────────────────────────┐
│  AnatomyGuru (Python)   │
│     Port 50058          │
└─────────────────────────┘
```

## Files Created

### Backend (SyncForge API)

1. **`00_SyncForgeAPI/api/anatomy/anatomyBridge.js`**
   - gRPC client for AnatomyGuru service
   - Connects to `localhost:50058`
   - Handles protocol buffer communication

2. **`00_SyncForgeAPI/api/anatomy/anatomyController.js`**
   - Request handling and validation
   - Comprehensive JSDoc Swagger documentation
   - Error handling and logging

3. **`00_SyncForgeAPI/api/anatomy/anatomyRoutes.js`**
   - Express router configuration
   - Endpoint definitions

4. **`00_SyncForgeAPI/api/anatomy/README.md`**
   - Complete API documentation
   - Usage examples
   - Troubleshooting guide

### Frontend (OHIF Viewer)

5. **`Viewers/extensions/lifesync/src/services/anatomyService.ts`**
   - TypeScript service for anatomy API calls
   - Auto-detects API URL (development/production)
   - Type-safe interfaces

6. **`Viewers/extensions/lifesync/src/utils/seriesDetection.ts`**
   - Auto-detection of series ID from active viewport
   - Utility functions for DICOM metadata extraction

### Modified Files

7. **`00_SyncForgeAPI/api/server.js`**
   - Registered anatomy routes
   - Added to Swagger documentation paths

8. **`00_SyncForgeAPI/swaggerDef.js`**
   - Added Anatomy tag
   - Added schema definitions (Vector3D, ScrewPlacementInfo, IntersectionAnalysis, ScrewPlacementResponse)

9. **`Viewers/extensions/lifesync/src/services/index.ts`**
   - Exported anatomyService
   - Exported TypeScript interfaces

10. **`Viewers/extensions/lifesync/src/components/ScrewManagement/CrosshairBookmarks.tsx`**
    - Added "Get Auto Screw Placement" button
    - Added `onGetAutoScrewPlacement` prop

11. **`Viewers/extensions/lifesync/src/components/ScrewManagement/ScrewManagementPanel.tsx`**
    - Implemented `handleGetAutoScrewPlacement` function
    - Integrated anatomyService and seriesDetection
    - Comprehensive console logging

## API Endpoints

### POST /api/anatomy/screw-placement

**Request:**
```json
{
  "seriesId": "1.2.826.0.1.3680043.8.498.10435545712098001683182764838391748554",
  "vertebraLabel": "L5"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Screw placement data retrieved successfully",
  "seriesId": "1.2.826.0.1.3680043.8.498.10435545712098001683182764838391748554",
  "vertebraLabel": "L5",
  "hasLeftScrew": true,
  "hasRightScrew": true,
  "leftScrew": {
    "entryPoint": { "x": -7.61, "y": 210.83, "z": -195.73 },
    "targetPoint": { "x": -0.26, "y": 171.90, "z": -201.24 },
    "trajectoryVector": { "x": -0.18, "y": 0.97, "z": 0.14 },
    "lengthMm": 40.0,
    "sagittalAngleDeg": 90.0,
    "transverseAngleDeg": 52.56
  },
  "rightScrew": {
    "entryPoint": { "x": 21.84, "y": 216.49, "z": -196.49 },
    "targetPoint": { "x": 29.19, "y": 177.56, "z": -202.00 },
    "trajectoryVector": { "x": -0.18, "y": 0.97, "z": 0.14 },
    "lengthMm": 40.0,
    "sagittalAngleDeg": 90.0,
    "transverseAngleDeg": 52.56
  },
  "intersectionAnalysis": {
    "hasIntersection": true,
    "iou": 0.5125,
    "intersectionCenter": { "x": 6.94, "y": 226.74, "z": -196.11 },
    "intersectionVolume": 222695.20,
    "vertebraVolume": 355127.26
  }
}
```

### GET /api/anatomy/available-vertebrae/:seriesId

Returns list of available vertebrae for a series.

### GET /api/anatomy/datasets

Returns list of all available series IDs.

### GET /api/anatomy/health

Health check for AnatomyGuru service.

## User Workflow

1. **Load DICOM Series** in OHIF Viewer
2. **Navigate to Screw Management Panel**
3. **Add Vertebral Label** (e.g., "L5")
   - Position crosshairs at vertebra center
   - Click "Add" button
   - Select vertebra from dropdown
4. **Click "🤖 Get Auto Screw Placement"** button
5. **View Results** in browser console

## Console Output Format

```
================================================================================
🦴 AUTO SCREW PLACEMENT - L5
================================================================================
Series ID: 1.2.826.0.1.3680043.8.498.10435545712098001683182764838391748554
Vertebra: L5

🔩 LEFT SCREW:
   Entry Point:  [-7.61, 210.83, -195.73] mm
   Target Point: [-0.26, 171.90, -201.24] mm
   Trajectory:   [-0.180, 0.970, 0.140] (normalized)
   Length:       40.0 mm
   Sagittal:     90.0°
   Transverse:   52.6°

🔩 RIGHT SCREW:
   Entry Point:  [21.84, 216.49, -196.49] mm
   Target Point: [29.19, 177.56, -202.00] mm
   Trajectory:   [-0.180, 0.970, 0.140] (normalized)
   Length:       40.0 mm
   Sagittal:     90.0°
   Transverse:   52.6°

🔬 INTERSECTION ANALYSIS:
   Has Intersection: ⚠️ YES
   IoU:              0.5125
   Risk Level:       🔴 HIGH
   Center:           [6.94, 226.74, -196.11] mm
   Volume:           222695.20 mm³
   Vertebra Volume:  355127.26 mm³

   ⚠️ WARNING: Spinal cord intersection detected!
   This trajectory may pose a risk to the spinal cord.
================================================================================
```

## Testing Instructions

### Prerequisites

1. **AnatomyGuru Service Running:**
   ```bash
   cd AsclepiusPrototype/10_segmentation/AnatomyGuru
   uv run python start_guru.py
   ```

2. **SyncForge API Running:**
   ```bash
   cd AsclepiusPrototype/00_SyncForgeAPI
   yarn start
   ```

3. **OHIF Viewer Running:**
   ```bash
   cd Viewers
   yarn run dev
   ```

### Test Steps

1. **Health Check:**
   ```bash
   curl http://localhost:3001/api/anatomy/health
   ```
   Expected: `{"healthy": true, "grpcConnected": true}`

2. **Available Datasets:**
   ```bash
   curl http://localhost:3001/api/anatomy/datasets
   ```

3. **Screw Placement API:**
   ```bash
   curl -X POST http://localhost:3001/api/anatomy/screw-placement \
     -H "Content-Type: application/json" \
     -d '{
       "seriesId": "1.2.826.0.1.3680043.8.498.10435545712098001683182764838391748554",
       "vertebraLabel": "L5"
     }'
   ```

4. **Frontend Integration:**
   - Open http://localhost:3000
   - Load a DICOM series with vertebrae segmentation
   - Navigate to Screw Management Panel
   - Add vertebral label (e.g., "L5")
   - Click "🤖 Get Auto Screw Placement"
   - Check browser console for detailed output

### Validation

Compare console output against JSON file:
```
AsclepiusPrototype/10_segmentation/output_vertebrae/output_vertebrae_<seriesId>/screw_placement_analysis.json
```

## Coordinate System

**DICOM LPS (Left-Posterior-Superior):**
- **X-axis**: Right (-) to Left (+)
- **Y-axis**: Anterior (-) to Posterior (+)
- **Z-axis**: Inferior (-) to Superior (+)

## Risk Levels

**Intersection over Union (IoU):**
- **< 0.1**: 🟢 Low risk
- **0.1 - 0.3**: 🟡 Moderate risk
- **≥ 0.3**: 🔴 High risk (WARNING)

## Medical Disclaimer

⚠️ **IMPORTANT:** This system is for research and educational purposes. All screw placement suggestions must be validated by qualified medical professionals before any clinical use. The intersection analysis is computational and does not replace clinical judgment.

## Troubleshooting

### Service Not Available

**Error:** `SERVICE_UNAVAILABLE`

**Solution:**
1. Check if AnatomyGuru is running:
   ```bash
   ps aux | grep start_guru.py
   netstat -an | grep 50058
   ```

2. Start AnatomyGuru:
   ```bash
   cd AsclepiusPrototype/10_segmentation/AnatomyGuru
   uv run python start_guru.py
   ```

### Series Not Found

**Error:** `NOT_FOUND`

**Solution:**
1. Check available datasets:
   ```bash
   curl http://localhost:3001/api/anatomy/datasets
   ```

2. Verify series has been processed:
   ```bash
   ls -la AsclepiusPrototype/10_segmentation/output_vertebrae/output_vertebrae_*
   ```

3. Check if `screw_placement_analysis.json` exists

### Invalid Vertebra Label

**Error:** `INVALID_VERTEBRA_LABEL`

**Solution:** Use valid labels: C1-C7, T1-T12, L1-L5, S1

## Swagger Documentation

View interactive API documentation:
```
http://localhost:3001/api-docs
```

Navigate to **Anatomy** section for complete endpoint documentation.

## Future Enhancements

Potential additions:
1. **Visual overlay** of screw trajectories in 3D viewport
2. **Automatic screw placement** using retrieved coordinates
3. **Batch processing** for multiple vertebrae
4. **Alternative trajectory suggestions** if intersection detected
5. **Historical trajectory database** for learning
6. **Real-time trajectory updates** during surgery

## Version History

- **v1.0.0** (2025-12-21): Initial implementation
  - Backend API module (routes, controller, bridge)
  - Frontend service and UI integration
  - Auto series detection
  - Comprehensive console logging
  - Swagger documentation

