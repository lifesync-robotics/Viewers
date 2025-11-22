# Screw Management API Specification

## Overview
Complete API specification for the Screw Planning system showing the data flow between:
- **Frontend UI** (`ScrewManagementPanel.tsx`, `PlanSelectionDialog.tsx`)
- **SyncForge API** (Node.js REST API on port 3001)
- **Planning Bridge** (gRPC adapter)
- **Planning Server** (Python gRPC server on port 6000)
- **Model Service** (Asset Library integration)

---

## Architecture Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                                │
│  ScrewManagementPanel.tsx + PlanSelectionDialog.tsx                    │
│  Port: 3000 (OHIF Viewer)                                              │
└──────────────────────────┬─────────────────────────────────────────────┘
                           │ HTTP/REST
                           ↓
┌────────────────────────────────────────────────────────────────────────┐
│                      SYNCFORGE API (Node.js)                            │
│  Routes: planningRoutes.js                                              │
│  Controller: planningController.js                                      │
│  Bridge: planningBridge.js (gRPC client)                                │
│  Port: 3001                                                             │
└──────────────────────────┬─────────────────────────────────────────────┘
                           │ gRPC
                           ↓
┌────────────────────────────────────────────────────────────────────────┐
│                     PLANNING SERVER (Python)                            │
│  Server: planning_server.py                                             │
│  Services:                                                              │
│    - model_service.py (3D model management)                             │
│    - screw_catalog.py (screw catalog)                                   │
│    - session_manager.py (session state)                                 │
│    - plan_storage.py (database persistence)                             │
│  Protocol: proto/planning.proto                                         │
│  Port: 6000                                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Complete API Endpoints

### 1. **Session Management**

#### 1.1 Start Planning Session
**Endpoint:** `POST /api/planning/session/start`

**Frontend Call (ScrewManagementPanel.tsx:63):**
```typescript
const response = await fetch('http://localhost:3001/api/planning/session/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    studyInstanceUID: string,
    seriesInstanceUID: string,
    surgeon: string,
    caseId?: string  // Optional - can be null
  })
});
```

**Request Body:**
```typescript
{
  studyInstanceUID: string;     // DICOM Study Instance UID
  seriesInstanceUID: string;    // DICOM Series Instance UID
  surgeon: string;              // Surgeon name
  caseId?: string | null;       // Optional case ID (Snowflake ID or null)
}
```

**Response:**
```typescript
{
  success: boolean;
  session_id: string;           // UUID session identifier
  expires_at?: string;          // ISO timestamp
  error?: string;               // Error message if success=false
}
```

**gRPC Call (planningBridge.js:330):**
```javascript
this.call('StartPlanningSession', {
  case_id: caseId || '',
  study_instance_uid: studyInstanceUID,
  series_instance_uid: seriesInstanceUID,
  surgeon: surgeon,
  auto_save: false,
  auto_save_interval: 300
});
```

**Protocol Buffer (planning.proto:156-170):**
```protobuf
message SessionRequest {
  string case_id = 1;
  string study_instance_uid = 2;
  string series_instance_uid = 3;
  string surgeon = 4;
  bool auto_save = 5;
  int32 auto_save_interval = 6;
}

message SessionResponse {
  bool success = 1;
  string session_id = 2;
  string expires_at = 3;
  int32 auto_save_interval = 4;
}
```

---

### 2. **Screw Management**

#### 2.1 Add Screw with Transform
**Endpoint:** `POST /api/planning/screws/add-with-transform`

**Frontend Call (ScrewManagementPanel.tsx:470):**
```typescript
const response = await fetch('http://localhost:3001/api/planning/screws/add-with-transform', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: string,
    screw: {
      caseId: string,
      radius: number,
      length: number,
      name: string,
      screwVariantId: string,
      vertebralLevel: string,
      side: string,
      entryPoint: { x: number, y: number, z: number },
      trajectory: {
        direction: [number, number, number],
        insertionDepth: number,
        convergenceAngle: number,
        cephaladAngle: number
      },
      notes: string,
      transformMatrix: number[],      // 16-element array (4x4 row-major)
      viewportStatesJson: string,     // JSON string
      placedAt: string                // ISO timestamp
    }
  })
});
```

**Request Body Structure:**
```typescript
{
  sessionId: string;
  screw: {
    // Identity
    caseId: string;
    name: string;
    screwVariantId: string;        // e.g., "generated-3.5-40"

    // Dimensions
    radius: number;                // Radius in mm
    length: number;                // Length in mm

    // Anatomical Position
    vertebralLevel: string;        // e.g., "L3", "unknown"
    side: string;                  // "left", "right", "unknown"

    // 3D Position (extracted from transform)
    entryPoint: {
      x: number;                   // X coordinate in mm
      y: number;                   // Y coordinate in mm
      z: number;                   // Z coordinate in mm
    };

    // Trajectory (extracted from transform)
    trajectory: {
      direction: [number, number, number];  // Unit vector
      insertionDepth: number;               // Depth in mm
      convergenceAngle: number;             // Degrees
      cephaladAngle: number;                // Degrees
    };

    // Transform Matrix (4x4 row-major)
    transformMatrix: number[];     // 16 elements
    // Layout:
    // [
    //   axialN.x, coronalN.x, sagittalN.x, translation.x,
    //   axialN.y, coronalN.y, sagittalN.y, translation.y,
    //   axialN.z, coronalN.z, sagittalN.z, translation.z,
    //   0,        0,          0,            1
    // ]

    // UI State
    viewportStatesJson: string;    // JSON stringified viewport states

    // Metadata
    notes: string;
    placedAt: string;              // ISO timestamp
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  screw_id: string;               // UUID screw identifier
  error?: string;
}
```

**Protocol Buffer (planning.proto:270-294):**
```protobuf
message ScrewRequest {
  string case_id = 1;
  string session_id = 2;
  string screw_variant_id = 3;
  string vertebral_level = 4;
  string side = 5;
  Point3D entry_point = 6;
  Trajectory trajectory = 7;
  string notes = 8;
  bool auto_label = 9;
  repeated float transform_matrix = 10;     // 16 elements
  string viewport_states_json = 11;
  string placed_at = 12;
}

message ScrewResponse {
  bool success = 1;
  string screw_id = 2;
  Screw screw = 3;
  ValidationResponse validation = 4;
  string auto_labeled_vertebra = 5;
  string auto_labeled_side = 6;
  string screw_label = 7;
}
```

#### 2.2 List Screws
**Endpoint:** `GET /api/planning/screws/{sessionId}/list`

**Frontend Call (ScrewManagementPanel.tsx:120):**
```typescript
const response = await fetch(
  `http://localhost:3001/api/planning/screws/${sessionId}/list`
);
```

**Response:**
```typescript
{
  success: boolean;
  screws: Array<{
    screw_id: string;
    name: string;
    radius: number;
    length: number;
    screw_variant_id: string;
    vertebral_level: string;
    side: string;
    entry_point: { x: number, y: number, z: number };
    trajectory: {
      direction: [number, number, number];
      insertion_depth: number;
      convergence_angle: number;
      cephalad_angle: number;
    };
    transform_matrix: number[];       // Already parsed as array (16 elements)
    viewport_states_json: object;     // Already parsed as object
    placed_at: string;
    created_at: string;
    notes: string;
  }>;
  error?: string;
}
```

**Important:** The API returns `transform_matrix` as an array and `viewport_states_json` as an object (already parsed from database JSON columns).

#### 2.3 Delete Screw
**Endpoint:** `DELETE /api/planning/screws/{screwId}`

**Frontend Call (ScrewManagementPanel.tsx:649):**
```typescript
const response = await fetch(
  `http://localhost:3001/api/planning/screws/${screwId}`,
  {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId })
  }
);
```

**Request Body:**
```typescript
{
  sessionId: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  message?: string;
  error?: string;
}
```

---

### 3. **3D Model Management**

#### 3.1 Query Model by Dimensions
**Endpoint:** `GET /api/planning/models/query?radius={radius}&length={length}`

**Frontend Call (ScrewManagementPanel.tsx:157):**
```typescript
const queryResponse = await fetch(
  `http://localhost:3001/api/planning/models/query?radius=${radius}&length=${length}`
);
```

**Request Parameters:**
```typescript
{
  radius: number;   // Radius in mm (e.g., 3.5)
  length: number;   // Length in mm (e.g., 40)
}
```

**Response:**
```typescript
{
  success: boolean;
  model: {
    model_id: string;              // e.g., "lsr-rgs01-7.0-40" or "generated-70-40"
    filename: string;              // e.g., "7300-T104040.obj"
    path: string;                  // Full file path (server-side)
    radius: number;                // Radius in mm
    length: number;                // Length in mm
    diameter: number;              // Diameter in mm (radius * 2)
    source: string;                // "asset_library", "procedural", "local"
    requires_generation: boolean;  // true if model doesn't exist
  };
  error?: string;
}
```

**gRPC Call (planningBridge.js:330-335):**
```javascript
this.call('QueryModel', {
  radius: radius,
  length: length
});
```

**Python Implementation (planning_server.py:856-886):**
```python
def QueryModel(self, request, context):
    """Query model by dimensions"""
    print(f"🔍 Querying model: radius={request.radius}, length={request.length}")

    try:
        model_info = self.model_service.query_model(
            radius=request.radius,
            length=request.length
        )

        if model_info:
            response = planning_pb2.ModelInfo(
                model_id=model_info.model_id,
                filename=model_info.filename,
                path=model_info.obj_path or '',
                radius=model_info.radius,
                length=model_info.length,
                diameter=model_info.diameter,
                source=model_info.source,
                requires_generation=model_info.requires_generation
            )
            print(f"✅ Found model: {model_info.model_id} ({model_info.source})")
            return response
        else:
            print("❌ No model found")
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details('Model not found')
            return planning_pb2.ModelInfo()

    except Exception as e:
        print(f"❌ Error querying model: {e}")
        context.set_code(grpc.StatusCode.INTERNAL)
        context.set_details(str(e))
        return planning_pb2.ModelInfo()
```

**Model Service Logic (model_service.py:346-370):**
```python
def query_model(self, radius: float, length: float) -> Optional[ModelInfo]:
    """
    Query model by dimensions using Asset Library catalog

    Args:
        radius: Screw radius in mm
        length: Screw length in mm

    Returns:
        ModelInfo object with complete metadata or None if not found
    """
    diameter = radius * 2

    # First, try to find exact match in catalog
    variants = self.get_variants_by_specs(diameter, length)

    if variants:
        # Use the first matching variant
        variant = variants[0]
        return self._create_model_info_from_variant(variant, radius)
    else:
        # Not found - return None for procedural generation
        print(f"⚠️  Model not found for {diameter}mm x {length}mm, will use procedural generation")
        return None
```

**Protocol Buffer (planning.proto:534-548):**
```protobuf
message QueryModelRequest {
  double radius = 1;
  double length = 2;
}

message ModelInfo {
  string model_id = 1;
  string filename = 2;
  string path = 3;
  double radius = 4;
  double length = 5;
  double diameter = 6;
  string source = 7;              // "local", "asset_library", "procedural"
  bool requires_generation = 8;
}
```

#### 3.2 Get Model OBJ File
**Endpoint:** `GET /api/planning/models/{modelId}/obj`

**Frontend Call (ScrewManagementPanel.tsx:185):**
```typescript
const modelUrl = `http://localhost:3001/api/planning/models/${modelInfo.model_id}/obj`;
await modelStateService.loadModelFromServer(modelUrl, {
  viewportId: getCurrentViewportId(),
  color: [1.0, 0.84, 0.0],  // Gold color
  opacity: 0.9
});
```

**Response:** OBJ file content (text/plain or application/octet-stream)

**Fallback for Generated Models:**
If model file doesn't exist, the controller generates a procedural cylinder:
```javascript
// Parse dimensions from model ID (e.g., "generated-65-35")
const parts = modelId.split('-');
if (parts[0] === 'generated' && parts.length === 3) {
  const diameter = parseInt(parts[1]) / 10;  // 65 → 6.5
  const length = parseInt(parts[2]);         // 35 → 35
  const radius = diameter / 2;               // 6.5 / 2 = 3.25

  // Generate procedural cylinder OBJ
  // (implementation in controller)
}
```

---

### 4. **Plan Management**

#### 4.1 Save Plan
**Endpoint:** `POST /api/planning/plan/save`

**Frontend Call (ScrewManagementPanel.tsx:875):**
```typescript
const response = await fetch('http://localhost:3001/api/planning/plan/save', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: string,
    caseId: string,
    studyInstanceUID: string,
    seriesInstanceUID: string,
    planData: {
      name: string,
      description: string,
      surgeon: string
    }
  })
});
```

**Request Body:**
```typescript
{
  sessionId: string;              // Active session UUID
  caseId: string;                 // Case ID (Snowflake or created)
  studyInstanceUID: string;       // DICOM Study UID
  seriesInstanceUID: string;      // DICOM Series UID
  planData: {
    name: string;                 // Plan name
    description: string;          // Plan description
    surgeon: string;              // Surgeon name
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  plan_id: string;                // UUID plan identifier
  file_path?: string;             // Database record or file path
  saved_at?: string;              // ISO timestamp
  error?: string;
}
```

#### 4.2 Load Plan
**Endpoint:** `GET /api/planning/plan/{planId}`

**Frontend Call (ScrewManagementPanel.tsx:915):**
```typescript
const response = await fetch(
  `http://localhost:3001/api/planning/plan/${planId}`
);
```

**Response:**
```typescript
{
  success: boolean;
  plan: {
    plan_id: string;
    case_id: string;
    study_instance_uid: string;
    series_instance_uid: string;
    name: string;
    description: string;
    surgeon: string;
    status: string;               // "draft", "saved", "final"
    screw_count: number;          // Denormalized count
    rod_count: number;            // Denormalized count
    screws: Array<Screw>;         // Full screw objects
    rods: Array<Rod>;             // Full rod objects
    created_at: string;
    updated_at: string;
  };
  error?: string;
}
```

#### 4.3 List Plans by Series
**Endpoint:** `GET /api/planning/plan/by-series/{seriesInstanceUID}`

**Frontend Call (PlanSelectionDialog.tsx:57):**
```typescript
const response = await fetch(
  `http://localhost:3001/api/planning/plan/by-series/${seriesInstanceUID}`
);
```

**Response:**
```typescript
{
  success: boolean;
  plans: Array<{
    plan_id: string;
    name: string;
    case_id: string;
    series_instance_uid: string;
    surgeon: string;
    status: string;
    screw_count: number;
    rod_count: number;
    created_at: string;
  }>;
  error?: string;
}
```

#### 4.4 List Plans by Case
**Endpoint:** `GET /api/planning/plan/{caseId}/list`

**Frontend Call (PlanSelectionDialog.tsx:55):**
```typescript
const response = await fetch(
  `http://localhost:3001/api/planning/plan/${caseId}/list`
);
```

**Response:** Same as 4.3 (list of plan summaries)

---

## Data Type Mappings

### Transform Matrix (4x4 Row-Major)

**Frontend → API → Database:**
```typescript
// Frontend construction (ScrewManagementPanel.tsx:355-367)
const transform = new Float32Array([
  // Row 0: X-components of basis vectors + translation X
  axialNormal[0], coronalNormal[0], sagittalNormal[0], translation[0],

  // Row 1: Y-components of basis vectors + translation Y
  axialNormal[1], coronalNormal[1], sagittalNormal[1], translation[1],

  // Row 2: Z-components of basis vectors + translation Z
  axialNormal[2], coronalNormal[2], sagittalNormal[2], translation[2],

  // Row 3: Homogeneous coordinates
  0, 0, 0, 1
]);

// Conversion for API (ScrewManagementPanel.tsx:415)
const transformArray = Array.from(transform);

// Storage in protobuf (planning.proto:310)
repeated float transform_matrix = 20;  // 16 elements

// Database storage (SQL)
transform_matrix TEXT  -- JSON stringified array
```

**API → Frontend (on load):**
```typescript
// API returns transform_matrix already parsed as array
transformArray = screwData.transform_matrix;  // Already an array

// Convert to Float32Array for VTK (ScrewManagementPanel.tsx:598)
transformArray = new Float32Array(transformArray);
```

### Viewport States

**Frontend → API:**
```typescript
// Capture (ScrewManagementPanel.tsx:449)
const viewportStates = viewportStateService.getCurrentViewportStates();

// Stringify for API (ScrewManagementPanel.tsx:492)
viewportStatesJson: JSON.stringify(viewportStates)

// Storage
viewport_states_json TEXT  -- JSON column in database
```

**API → Frontend:**
```typescript
// API returns viewport_states_json already parsed as object
let viewportStates = screwData.viewport_states_json;

// May need to parse if still string (ScrewManagementPanel.tsx:613-616)
if (typeof viewportStates === 'string') {
  viewportStates = JSON.parse(viewportStates);
}
```

---

## Common Errors and Solutions

### Error 1: 500 Internal Server Error on `/api/planning/models/query`

**Symptoms:**
```
GET http://localhost:3001/api/planning/models/query?radius=3.5&length=40 500 (Internal Server Error)
❌ Failed to load screw model: Error: Model query failed
```

**Root Causes:**
1. **Planning Server (Python) not running** on port 6000
2. **gRPC connection failure** between SyncForge API and Planning Server
3. **Model Service error** (Asset Library not found, catalog malformed)
4. **Protocol buffer mismatch** between Python and Node.js

**Diagnostic Steps:**

```bash
# 1. Check if Planning Server is running
lsof -i :6000  # Or: netstat -an | grep 6000

# 2. Check if SyncForge API is running
lsof -i :3001

# 3. Check Planning Server logs
cd AsclepiusPrototype/03_Planning/pedicle_screw
./start_planning_server.sh

# Expected output:
# 🔩 Initializing Pedicle Screw Planning Service...
# 📊 Setting up data source...
# ✅ Model service initialized
# 🚀 Planning Service started on port 6000

# 4. Test gRPC connection manually
# (requires grpcurl or similar tool)
```

**Solutions:**

**A. Start Planning Server:**
```bash
cd AsclepiusPrototype/03_Planning/pedicle_screw
python planning_server.py
```

**B. Check Asset Library path in model_service.py:**
```python
# model_service.py:150
self.asset_library_dir = self.workspace_root / '09_AssetManagement' / 'AssetLibrary'
```

**C. Verify protocol buffer compilation:**
```bash
cd AsclepiusPrototype/03_Planning/pedicle_screw
./compile_proto.sh

# Should generate:
# - proto/planning_pb2.py
# - proto/planning_pb2_grpc.py
```

**D. Check SyncForge API gRPC client:**
```javascript
// planningBridge.js
constructor() {
  this.grpcClient = new PlanningServiceClient(
    'localhost:6000',  // Must match Planning Server port
    grpc.credentials.createInsecure()
  );
}
```

### Error 2: Transform Matrix Dimension Mismatch

**Symptoms:**
```
⚠️ No valid transform to apply (length: 0)
```

**Root Cause:** Transform matrix not properly stored or retrieved

**Solution:** Verify transform_matrix is:
- Stored as 16-element array
- Retrieved as array (not string)
- Converted to Float32Array before use in VTK

### Error 3: Viewport States Not Restoring

**Symptoms:**
- Screw loads but viewport doesn't move
- Console shows "Could not restore viewport states"

**Root Cause:** viewport_states_json format mismatch

**Solution:**
```typescript
// Ensure proper parsing (ScrewManagementPanel.tsx:610-616)
let viewportStates = screwData.viewport_states_json || screwData.viewportStates;

if (typeof viewportStates === 'string') {
  console.log('🔄 Parsing viewport_states_json from string');
  viewportStates = JSON.parse(viewportStates);
}
```

---

## Testing Checklist

### 1. **Backend Services**
```bash
# Start Planning Server
cd AsclepiusPrototype/03_Planning/pedicle_screw
python planning_server.py
# Expected: 🚀 Planning Service started on port 6000

# Start SyncForge API
cd AsclepiusPrototype/00_SyncForgeAPI
npm start
# Expected: ✓ SyncForge API listening on port 3001

# Start OHIF Viewer
cd Viewers
yarn dev
# Expected: OHIF running on port 3000
```

### 2. **API Connectivity**
```bash
# Test model query
curl "http://localhost:3001/api/planning/models/query?radius=3.5&length=40"

# Expected response:
{
  "success": true,
  "model": {
    "model_id": "lsr-rgs01-7.0-40",
    "filename": "7300-T104040.obj",
    "source": "asset_library",
    ...
  }
}

# Test session start
curl -X POST http://localhost:3001/api/planning/session/start \
  -H "Content-Type: application/json" \
  -d '{
    "studyInstanceUID": "1.2.3.4.5",
    "seriesInstanceUID": "1.2.3.4.5.6",
    "surgeon": "Test User"
  }'

# Expected response:
{
  "success": true,
  "session_id": "uuid-here"
}
```

### 3. **Frontend Integration**
1. Open OHIF Viewer (http://localhost:3000)
2. Open Screw Management Panel
3. Check console for:
   - ✅ Planning session ready
   - 📥 Loaded X screws from API
4. Save a screw placement
5. Check console for:
   - 🔧 [ScrewManagement] CONSTRUCTING SCREW TRANSFORM
   - ✅ Screw saved to planning API
   - 🔧 [ScrewManagement] LOADING 3D MODEL

---

## Summary

### Critical Success Factors:
1. **All three services must be running:** OHIF (3000), SyncForge API (3001), Planning Server (6000)
2. **Protocol buffers must be compiled** in Python backend
3. **Asset Library must exist** at correct path for model service
4. **Transform matrix** must be 16-element Float32Array
5. **Viewport states** must be properly JSON serialized/deserialized

### Data Flow Verification:
```
UI Click → REST Call → gRPC Bridge → Python Service → Model Service → Response
   ↓           ↓            ↓              ↓               ↓              ↓
Debug    Check 500     Check gRPC    Check logs    Check catalog   Verify data
Console   error        connection     for errors    loading        in response
```

### Key Files:
- **Frontend:** `ScrewManagementPanel.tsx` (line 157 - failing model query)
- **REST Routes:** `planningRoutes.js` (line 122 - query route)
- **REST Controller:** `planningController.js` (line 620 - queryModel)
- **gRPC Bridge:** `planningBridge.js` (line 330 - QueryModel call)
- **Python Server:** `planning_server.py` (line 856 - QueryModel impl)
- **Model Service:** `model_service.py` (line 346 - query_model)
- **Protocol:** `planning.proto` (line 60, 534-548 - QueryModel RPC)
