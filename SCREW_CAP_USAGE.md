# Screw Cap Model - Usage Guide

## Overview

The model server now includes special handling for the **screw cap model** (`7300-T10_Top.obj`), which doesn't follow the standard naming convention since it has no dimensions.

---

## Special File

**Filename:** `7300-T10_Top.obj`

**Location:** `models/server/7300-T10_Top.obj`

**Purpose:** Represents the screw cap/top component (no radius or length dimensions)

---

## How It Works

### Dictionary Entry

The screw cap is stored in the dictionary with a special key:
```javascript
modelDictionary['cap'] = {
  filename: "7300-T10_Top.obj",
  radius: null,
  length: null,
  diameter: null,
  isCap: true,
  type: 'cap',
  url: "/models/server/7300-T10_Top.obj",
  size: 125834,
  exists: true
}
```

### Model List

When listing all models, the cap is included with special fields:
```json
{
  "id": "server_7300-T10_Top.obj",
  "name": "7300-T10_Top",
  "filename": "7300-T10_Top.obj",
  "type": "server",
  "url": "/models/server/7300-T10_Top.obj",
  "isCap": true,
  "modelType": "cap",
  "description": "Screw cap/top"
}
```

---

## API Usage

### Query the Screw Cap

**Endpoint:**
```
GET /api/models/query?type=cap
```

**Example:**
```bash
curl "http://localhost:5001/api/models/query?type=cap"
```

**Response:**
```json
{
  "success": true,
  "found": true,
  "model": {
    "filename": "7300-T10_Top.obj",
    "radius": null,
    "length": null,
    "diameter": null,
    "isCap": true,
    "type": "cap",
    "url": "/models/server/7300-T10_Top.obj",
    "size": 125834,
    "exists": true,
    "description": "Screw cap/top"
  },
  "query": {
    "type": "cap"
  }
}
```

**Response (Not Found):**
```json
{
  "success": true,
  "found": false,
  "expectedFilename": "7300-T10_Top.obj",
  "query": {
    "type": "cap"
  },
  "message": "Screw cap model not found"
}
```

---

## JavaScript/Frontend Usage

### Example 1: Load Screw Cap

```javascript
async function loadScrewCap(viewportId) {
  const response = await fetch(
    'http://localhost:5001/api/models/query?type=cap'
  );
  const data = await response.json();

  if (data.found) {
    const modelStateService = window.servicesManager.services.modelStateService;

    await modelStateService.loadModelFromServer(data.model.url, {
      viewportId: viewportId,
      color: [0.8, 0.8, 0.2], // Yellow/gold for cap
      opacity: 1.0
    });

    console.log('✅ Screw cap loaded');
    return data.model;
  } else {
    console.warn('⚠️ Screw cap model not found');
    return null;
  }
}

// Usage
await loadScrewCap('viewport-3d');
```

---

### Example 2: Filter Cap from Model List

```javascript
async function getScrewModelsOnly() {
  const response = await fetch('http://localhost:5001/api/models/list');
  const data = await response.json();

  // Filter out the cap to get only screws
  const screwModels = data.models.filter(m => !m.isCap);

  console.log(`Found ${screwModels.length} screw models`);
  return screwModels;
}

// Or get just the cap
async function getScrewCap() {
  const response = await fetch('http://localhost:5001/api/models/list');
  const data = await response.json();

  const cap = data.models.find(m => m.isCap);

  if (cap) {
    console.log('Screw cap:', cap.filename);
  }

  return cap;
}
```

---

### Example 3: Load Screw with Cap

```javascript
async function loadScrewWithCap(radius, length, viewportId) {
  const modelStateService = window.servicesManager.services.modelStateService;

  // 1. Load the screw body
  const screwResponse = await fetch(
    `http://localhost:5001/api/models/query?radius=${radius}&length=${length}`
  );
  const screwData = await screwResponse.json();

  if (screwData.found) {
    await modelStateService.loadModelFromServer(screwData.model.url, {
      viewportId: viewportId,
      color: [0.7, 0.7, 0.7], // Gray for body
      opacity: 1.0
    });
    console.log('✅ Screw body loaded');
  } else {
    console.warn('⚠️ Screw body not found');
    return null;
  }

  // 2. Load the screw cap
  const capResponse = await fetch(
    'http://localhost:5001/api/models/query?type=cap'
  );
  const capData = await capResponse.json();

  if (capData.found) {
    await modelStateService.loadModelFromServer(capData.model.url, {
      viewportId: viewportId,
      color: [0.8, 0.8, 0.2], // Yellow for cap
      opacity: 1.0,
      // Position the cap at the top of the screw
      // You may need to adjust position based on your coordinate system
    });
    console.log('✅ Screw cap loaded');
  } else {
    console.warn('⚠️ Screw cap not found');
  }

  return {
    screw: screwData.found ? screwData.model : null,
    cap: capData.found ? capData.model : null
  };
}

// Usage
await loadScrewWithCap(6.5, 35, 'viewport-3d');
```

---

### Example 4: Check If Cap Exists

```javascript
async function checkScrewCapAvailable() {
  try {
    const response = await fetch(
      'http://localhost:5001/api/models/query?type=cap'
    );
    const data = await response.json();

    if (data.found) {
      console.log('✅ Screw cap is available');
      console.log('   Filename:', data.model.filename);
      console.log('   Size:', (data.model.size / 1024).toFixed(2), 'KB');
      console.log('   URL:', data.model.url);
      return true;
    } else {
      console.log('❌ Screw cap not available');
      return false;
    }
  } catch (error) {
    console.error('Error checking cap:', error);
    return false;
  }
}

// Usage
const hasCapModel = await checkScrewCapAvailable();
```

---

## Comparison with Regular Screws

### Regular Screw Model
```json
{
  "filename": "7300-T1013035.obj",
  "radius": 6.5,
  "length": 35,
  "diameter": 13,
  "isCap": false,
  "type": "screw",
  "modelType": "screw",
  "url": "/models/server/7300-T1013035.obj"
}
```

### Screw Cap Model
```json
{
  "filename": "7300-T10_Top.obj",
  "radius": null,
  "length": null,
  "diameter": null,
  "isCap": true,
  "type": "cap",
  "modelType": "cap",
  "description": "Screw cap/top",
  "url": "/models/server/7300-T10_Top.obj"
}
```

**Key Differences:**
- Cap has `isCap: true`
- Cap has `type: 'cap'`
- Cap has `radius`, `length`, `diameter` all set to `null`
- Cap has special `description` field

---

## Dictionary Behavior

### On Server Startup

```
=================================================
3D Model Server Started
=================================================
Server running on: http://localhost:5001
...
Model dictionary: 16 models indexed
  - Screw cap model: 7300-T10_Top.obj
...
```

The cap is automatically detected and indexed when the server starts.

### Dictionary Structure

```javascript
{
  // Regular screw models
  "3.25_35": { filename: "7300-T106535.obj", ... },
  "6.5_35": { filename: "7300-T1013035.obj", ... },
  "6.5_40": { filename: "7300-T1013040.obj", ... },

  // Special cap model (key: "cap")
  "cap": {
    filename: "7300-T10_Top.obj",
    isCap: true,
    type: "cap",
    ...
  }
}
```

---

## Integration with Viewport Snapshots

The screw cap doesn't have dimensions, so it's not directly tied to viewport snapshots. However, you can load it alongside screws:

```javascript
// 1. Restore snapshot with dimensions
viewportStateService.restoreSnapshot('L1L Screw');
const snapshot = viewportStateService.getSnapshot('L1L Screw');

// 2. Load matching screw body
const screwResponse = await fetch(
  `http://localhost:5001/api/models/query?radius=${snapshot.radius}&length=${snapshot.length}`
);
const screwData = await screwResponse.json();

if (screwData.found) {
  await modelStateService.loadModelFromServer(screwData.model.url);
}

// 3. Optionally load the cap too
const capResponse = await fetch(
  'http://localhost:5001/api/models/query?type=cap'
);
const capData = await capResponse.json();

if (capData.found) {
  await modelStateService.loadModelFromServer(capData.model.url, {
    color: [0.8, 0.8, 0.2] // Different color to distinguish
  });
}
```

---

## Error Handling

### Cap Not Found

```javascript
const response = await fetch(
  'http://localhost:5001/api/models/query?type=cap'
);
const data = await response.json();

if (!data.found) {
  console.warn('Screw cap model not available');
  console.log('Expected filename:', data.expectedFilename);

  // Handle gracefully - maybe show a message or use a default
  alert('Screw cap model (7300-T10_Top.obj) not found in models/server/ directory');
}
```

---

## Testing

### 1. Check if cap file exists

```bash
# Windows
dir models\server\7300-T10_Top.obj

# Linux/Mac
ls -la models/server/7300-T10_Top.obj
```

### 2. Query the cap via API

```bash
curl "http://localhost:5001/api/models/query?type=cap"
```

### 3. Check in model list

```bash
curl "http://localhost:5001/api/models/list" | grep -i "cap"
```

### 4. Rebuild dictionary

```bash
curl -X POST "http://localhost:5001/api/models/rebuild-dictionary"
```

---

## Python Script Integration

If you want to save screw cap information in Python snapshots:

```python
# In debug_planner.py

# For screw cap, you can use special values or None
viewport_snapshot = {
    "name": "L1L_Cap",
    "timestamp": timestamp,
    "radius": None,  # or 0
    "length": None,  # or 0
    "viewports": [...],
    "modelType": "cap"  # Optional flag
}
```

Then in JavaScript, detect and load the cap:

```javascript
const snapshot = viewportStateService.getSnapshot('L1L_Cap');

if (snapshot.modelType === 'cap' ||
    (snapshot.radius === null && snapshot.length === null)) {
  // Load screw cap
  const response = await fetch(
    'http://localhost:5001/api/models/query?type=cap'
  );
  const data = await response.json();

  if (data.found) {
    await modelStateService.loadModelFromServer(data.model.url);
  }
}
```

---

## Summary

The screw cap model is now fully integrated into the model server with:

✅ Special dictionary entry with key `'cap'`
✅ Query endpoint: `/api/models/query?type=cap`
✅ Automatic detection on server startup
✅ Included in model list with `isCap: true` flag
✅ Can be loaded independently or with screw bodies
✅ No dimensions (radius/length/diameter are `null`)

---

**Last Updated:** November 7, 2025
**Status:** ✅ Production Ready
