# Model Dictionary - Usage Guide

## Overview

The model server now includes a **model dictionary** for quick lookup of 3D model files based on radius and length. This is optimized for the naming convention used in the screw models:

**Format:** `7300-T10{diameter}{length}.obj`

where:
- `diameter` = radius × 2 with decimal point removed
- `length` = screw length

**Examples:**
- Radius 3.25mm, Length 35mm → `7300-T106535.obj`
- Radius 6.5mm, Length 40mm → `7300-T1013040.obj`
- Radius 7.5mm, Length 45mm → `7300-T1015045.obj`

---

## Quick Reference

### New API Endpoints

1. **Query by radius & length:**
   ```
   GET /api/models/query?radius=6.5&length=35
   ```

2. **Get all available dimensions:**
   ```
   GET /api/models/dimensions
   ```

3. **Rebuild dictionary:**
   ```
   POST /api/models/rebuild-dictionary
   ```

4. **Enhanced list (now includes dimensions):**
   ```
   GET /api/models/list
   ```

---

## Usage Examples

### Example 1: Query Model by Radius and Length

**Request:**
```bash
curl "http://localhost:5001/api/models/query?radius=6.5&length=35"
```

**Response (Found):**
```json
{
  "success": true,
  "found": true,
  "model": {
    "filename": "7300-T1013035.obj",
    "radius": 6.5,
    "length": 35,
    "diameter": 13,
    "url": "/models/server/7300-T1013035.obj",
    "size": 2458924,
    "exists": true
  },
  "query": {
    "radius": 6.5,
    "length": 35
  }
}
```

**Response (Not Found):**
```json
{
  "success": true,
  "found": false,
  "expectedFilename": "7300-T1013035.obj",
  "query": {
    "radius": 6.5,
    "length": 35
  },
  "message": "Model not found in server directory"
}
```

---

### Example 2: Get All Available Dimensions

**Request:**
```bash
curl "http://localhost:5001/api/models/dimensions"
```

**Response:**
```json
{
  "success": true,
  "count": 15,
  "dimensions": [
    {
      "radius": 3.25,
      "length": 35,
      "diameter": 6.5,
      "filename": "7300-T106535.obj",
      "url": "/models/server/7300-T106535.obj"
    },
    {
      "radius": 3.25,
      "length": 40,
      "diameter": 6.5,
      "filename": "7300-T106540.obj",
      "url": "/models/server/7300-T106540.obj"
    },
    {
      "radius": 6.5,
      "length": 35,
      "diameter": 13,
      "filename": "7300-T1013035.obj",
      "url": "/models/server/7300-T1013035.obj"
    }
  ],
  "byRadius": {
    "3.25": [35, 40, 45],
    "6.5": [35, 40, 45, 50],
    "7.5": [35, 40, 45]
  },
  "availableRadii": [3.25, 6.5, 7.5]
}
```

---

### Example 3: List Models with Dimensions

**Request:**
```bash
curl "http://localhost:5001/api/models/list"
```

**Response:**
```json
{
  "success": true,
  "count": 15,
  "models": [
    {
      "id": "server_7300-T1013035.obj",
      "name": "7300-T1013035",
      "filename": "7300-T1013035.obj",
      "type": "server",
      "url": "/models/server/7300-T1013035.obj",
      "size": 2458924,
      "createdAt": "2025-11-07T10:30:00.000Z",
      "format": "obj",
      "radius": 6.5,
      "length": 35,
      "diameter": 13
    }
  ]
}
```

**Note:** Models now automatically include `radius`, `length`, and `diameter` fields if they match the naming convention!

---

### Example 4: JavaScript/Frontend Usage

```javascript
// Query specific model
async function getModelByDimensions(radius, length) {
  const response = await fetch(
    `http://localhost:5001/api/models/query?radius=${radius}&length=${length}`
  );
  const data = await response.json();

  if (data.found) {
    console.log('Model found:', data.model.filename);
    console.log('URL:', data.model.url);
    return data.model;
  } else {
    console.log('Model not found for:', radius, length);
    return null;
  }
}

// Get all available dimensions
async function getAvailableDimensions() {
  const response = await fetch('http://localhost:5001/api/models/dimensions');
  const data = await response.json();

  console.log('Available radii:', data.availableRadii);
  console.log('Dimensions by radius:', data.byRadius);

  return data;
}

// Usage
const model = await getModelByDimensions(6.5, 35);
if (model) {
  // Load the model
  modelStateService.loadModelFromServer(model.url);
}
```

---

### Example 5: Integration with Viewport Snapshots

```javascript
// Load model based on snapshot dimensions
async function loadModelFromSnapshot(snapshot) {
  const { radius, length } = snapshot;

  if (!radius || !length) {
    console.warn('Snapshot missing dimensions');
    return null;
  }

  // Query model server
  const response = await fetch(
    `http://localhost:5001/api/models/query?radius=${radius}&length=${length}`
  );
  const data = await response.json();

  if (data.found) {
    // Load the model
    const modelStateService = window.servicesManager.services.modelStateService;
    await modelStateService.loadModelFromServer(data.model.url, {
      viewportId: 'viewport-3d',
      color: [1, 0, 0],
      opacity: 0.8
    });

    console.log(`✅ Loaded model: ${data.model.filename}`);
    return data.model;
  } else {
    console.warn(`⚠️ No model found for radius ${radius}mm, length ${length}mm`);
    return null;
  }
}

// Usage with restored snapshot
viewportStateService.restoreSnapshot('L1L Screw');
const snapshot = viewportStateService.getSnapshot('L1L Screw');
await loadModelFromSnapshot(snapshot);
```

---

### Example 6: Rebuild Dictionary After Adding Models

If you add new model files to the `models/server/` directory, rebuild the dictionary:

**Request:**
```bash
curl -X POST "http://localhost:5001/api/models/rebuild-dictionary"
```

**Response:**
```json
{
  "success": true,
  "message": "Model dictionary rebuilt",
  "count": 18,
  "models": [
    {
      "filename": "7300-T1013035.obj",
      "radius": 6.5,
      "length": 35,
      "diameter": 13,
      "url": "/models/server/7300-T1013035.obj",
      "size": 2458924,
      "exists": true
    }
  ]
}
```

---

## Naming Convention Details

### How Filenames are Generated

```javascript
// radius = 3.25mm
// length = 35mm

const diameter = 3.25 * 2;              // 6.5
const diameterStr = "6.5".replace(".", ""); // "65"
const lengthStr = "35".replace(".", "");    // "35"
const filename = `7300-T10${diameterStr}${lengthStr}.obj`; // "7300-T106535.obj"
```

### Parsing Logic

```javascript
// Filename: "7300-T1013035.obj"
// Remove prefix and .obj: "13035"
// Parse as diameter + length

// Try last 2 digits as length:
//   "130" + "35" → diameter 13.0, length 35 ✅

// Validation:
//   - Diameter: 5-20mm (reasonable screw sizes)
//   - Length: 20-100mm (reasonable screw lengths)
```

---

## Advanced Usage

### Example 7: Get Models for Specific Radius

```javascript
async function getModelsForRadius(radius) {
  const response = await fetch('http://localhost:5001/api/models/dimensions');
  const data = await response.json();

  const lengths = data.byRadius[radius] || [];

  console.log(`Available lengths for radius ${radius}mm:`, lengths);

  return lengths.map(length => ({
    radius,
    length,
    filename: `7300-T10${(radius * 2).toString().replace('.', '')}${length}.obj`
  }));
}

// Usage
const models = await getModelsForRadius(6.5);
// Output: [
//   { radius: 6.5, length: 35, filename: "7300-T1013035.obj" },
//   { radius: 6.5, length: 40, filename: "7300-T1013040.obj" },
//   ...
// ]
```

---

### Example 8: Populate Dropdown with Available Options

```javascript
async function populateRadiusDropdown() {
  const response = await fetch('http://localhost:5001/api/models/dimensions');
  const data = await response.json();

  const radiusSelect = document.getElementById('radius-select');

  data.availableRadii.forEach(radius => {
    const option = document.createElement('option');
    option.value = radius;
    option.textContent = `${radius} mm (${radius * 2} mm diameter)`;
    radiusSelect.appendChild(option);
  });
}

async function populateLengthDropdown(radius) {
  const response = await fetch('http://localhost:5001/api/models/dimensions');
  const data = await response.json();

  const lengths = data.byRadius[radius] || [];
  const lengthSelect = document.getElementById('length-select');
  lengthSelect.innerHTML = ''; // Clear existing

  lengths.forEach(length => {
    const option = document.createElement('option');
    option.value = length;
    option.textContent = `${length} mm`;
    lengthSelect.appendChild(option);
  });
}
```

---

### Example 9: Validate Model Availability Before Loading

```javascript
async function validateAndLoadModel(radius, length, viewportId) {
  // First check if model exists
  const response = await fetch(
    `http://localhost:5001/api/models/query?radius=${radius}&length=${length}`
  );
  const data = await response.json();

  if (!data.found) {
    alert(`⚠️ Model not available for radius ${radius}mm and length ${length}mm`);

    // Suggest alternatives
    const dimsResponse = await fetch('http://localhost:5001/api/models/dimensions');
    const dims = await dimsResponse.json();

    if (dims.byRadius[radius]) {
      console.log(`Available lengths for radius ${radius}mm:`, dims.byRadius[radius]);
    } else {
      console.log('Available radii:', dims.availableRadii);
    }

    return null;
  }

  // Load the model
  const modelStateService = window.servicesManager.services.modelStateService;
  const loadedModel = await modelStateService.loadModelFromServer(data.model.url, {
    viewportId: viewportId,
    color: [0.8, 0.2, 0.2],
    opacity: 1.0
  });

  if (loadedModel) {
    console.log(`✅ Loaded: ${data.model.filename}`);
    console.log(`   Radius: ${data.model.radius} mm`);
    console.log(`   Length: ${data.model.length} mm`);
    console.log(`   Diameter: ${data.model.diameter} mm`);
  }

  return loadedModel;
}

// Usage
await validateAndLoadModel(6.5, 35, 'viewport-3d');
```

---

## Dictionary Performance

### Benefits

1. **O(1) Lookup** - Instant queries by radius/length
2. **Cached in Memory** - No file system scanning on each query
3. **Auto-parsing** - Automatically extracts dimensions from filenames
4. **Validation** - Ensures models match expected format

### Dictionary Structure

```javascript
{
  "3.25_35": {
    filename: "7300-T106535.obj",
    radius: 3.25,
    length: 35,
    diameter: 6.5,
    url: "/models/server/7300-T106535.obj",
    size: 2458924,
    exists: true
  },
  "6.5_40": {
    filename: "7300-T1013040.obj",
    radius: 6.5,
    length: 40,
    diameter: 13,
    url: "/models/server/7300-T1013040.obj",
    size: 3124567,
    exists: true
  }
}
```

---

## Error Handling

### Invalid Parameters
```javascript
fetch('http://localhost:5001/api/models/query?radius=abc&length=35')
// Response:
{
  "success": false,
  "error": "Invalid radius or length parameters",
  "message": "Both radius and length must be valid numbers"
}
```

### Model Not Found
```javascript
fetch('http://localhost:5001/api/models/query?radius=999&length=999')
// Response:
{
  "success": true,
  "found": false,
  "expectedFilename": "7300-T10199899.obj",
  "query": { "radius": 999, "length": 999 },
  "message": "Model not found in server directory"
}
```

---

## Testing the Dictionary

### 1. Check Server Health

```bash
curl http://localhost:5001/api/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "serverTime": "2025-11-07T14:30:00.000Z",
  "modelsDir": "C:\\Users\\hp\\tableTop\\mvisioner\\Viewers\\models",
  "serverModelsDir": "C:\\Users\\hp\\tableTop\\mvisioner\\Viewers\\models\\server",
  "userModelsDir": "C:\\Users\\hp\\tableTop\\mvisioner\\Viewers\\models\\uploads",
  "modelDictionaryCount": 15
}
```

### 2. Test Query

```bash
# Test with known model
curl "http://localhost:5001/api/models/query?radius=6.5&length=35"

# Test with unknown model
curl "http://localhost:5001/api/models/query?radius=1&length=1"
```

### 3. View Dictionary

```bash
curl http://localhost:5001/api/models/dimensions
```

---

## Troubleshooting

### Issue: Dictionary shows 0 models

**Possible causes:**
1. Models directory is empty
2. Models don't follow naming convention
3. Server didn't start properly

**Solution:**
```bash
# 1. Check models directory
ls models/server/

# 2. Rebuild dictionary
curl -X POST http://localhost:5001/api/models/rebuild-dictionary

# 3. Check server logs for parsing errors
```

### Issue: Query returns "not found" but file exists

**Possible causes:**
1. Filename doesn't match convention
2. Dictionary needs rebuilding
3. Parsing failed (invalid dimensions)

**Solution:**
```bash
# Rebuild dictionary
curl -X POST http://localhost:5001/api/models/rebuild-dictionary

# Check if file matches convention
# Should be: 7300-T10{diameter}{length}.obj
# where diameter has no decimal, length is 2-3 digits
```

---

## Additional Resources

- Main server documentation: `MODEL_SERVER_IMPLEMENTATION_SUMMARY.md`
- Radius/Length implementation: `RADIUS_LENGTH_IMPLEMENTATION_SUMMARY.md`
- Server code: `platform/app/server/modelServer.js`
- Python script: `slicer/planner/deployment/debug_planner.py`

---

**Last Updated:** November 7, 2025
**Status:** ✅ Production Ready
