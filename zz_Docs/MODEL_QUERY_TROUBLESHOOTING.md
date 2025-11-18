# Model Query Troubleshooting Guide

## Issue
Getting `404 (Not Found)` error when querying for model with radius=3.25 and length=35:
```
GET http://localhost:3000/api/models/query?radius=3.25&length=35 404 (Not Found)
```

## Prerequisites
The model server must be running on port **5001** for the proxy to work.

## Step-by-Step Debugging

### Step 1: Verify Model Server is Running

1. **Start the model server** (if not already running):
   ```bash
   cd platform/app
   node server/startModelServer.js
   ```

   Or use yarn:
   ```bash
   yarn dev:model-server
   ```

2. **Check the startup logs** for:
   ```
   =================================================
   3D Model Server Started
   =================================================
   Server running on: http://localhost:5001
   Server models directory: C:\Users\hp\tableTop\mvisioner\Viewers\models\server
   User uploads directory: C:\Users\hp\tableTop\mvisioner\Viewers\models\uploads
   Model dictionary: X models indexed
   ```

### Step 2: Test Model Server Directly (Port 5001)

Open your browser or use curl to test the model server directly:

1. **Health check:**
   ```
   http://localhost:5001/api/health
   ```

   Should return:
   ```json
   {
     "status": "ok",
     "modelDictionaryCount": X
   }
   ```

2. **View model dictionary (NEW DEBUG ENDPOINT):**
   ```
   http://localhost:5001/api/models/debug/dictionary
   ```

   This will show you:
   - All dictionary keys (e.g., "3.25_35", "6.5_40", "cap")
   - Complete dictionary contents with filenames
   - Total count of indexed models

3. **Test the specific query directly:**
   ```
   http://localhost:5001/api/models/query?radius=3.25&length=35
   ```

   **Expected response if model exists:**
   ```json
   {
     "success": true,
     "found": true,
     "model": {
       "filename": "7300-T106535.obj",
       "radius": 3.25,
       "length": 35,
       "diameter": 6.5,
       "url": "/models/server/7300-T106535.obj",
       ...
     },
     "query": { "radius": 3.25, "length": 35 }
   }
   ```

### Step 3: Check Model File Naming

The expected filename for radius=3.25, length=35 is:
```
7300-T106535.obj
```

**Calculation:**
- Radius: 3.25 mm
- Diameter: 3.25 × 2 = 6.5 mm
- Diameter string: "6.5".replace(".", "") = "65"
- Length string: "35"
- Filename: `7300-T10` + `65` + `35` + `.obj` = `7300-T106535.obj`

**Verify the file exists:**
```bash
cd C:\Users\hp\tableTop\mvisioner\Viewers\models\server
dir | findstr 7300-T106535
```

Or check all .obj files:
```bash
dir *.obj
```

### Step 4: Check Server Logs

With the enhanced logging, when you query the model, you should see:

```
───────────────────────────────────────────────────────
🔍 [Model Server] QUERY REQUEST RECEIVED
   Query params: { radius: '3.25', length: '35' }
   Type: Regular model query
   Radius: 3.25
   Length: 35
   Expected filename: 7300-T106535.obj
   Dictionary key: 3.25_35
   Dictionary keys available: [ '3.25_35', '6.5_40', ... ]
   ✅ Model found in dictionary (or)
   ⚠️ Model not in dictionary, checking filesystem...
   File path: C:\Users\hp\tableTop\mvisioner\Viewers\models\server\7300-T106535.obj
   File exists: true/false
   ✅ Model found in filesystem (or)
   ❌ Model not found
   Directory contents: [ ... list of .obj files ... ]
```

### Step 5: Test Through Proxy (Port 3000)

Once the model server is confirmed working on port 5001, test through the OHIF proxy:

```
http://localhost:3000/api/models/query?radius=3.25&length=35
```

**Proxy Configuration:**
The webpack dev server is configured to proxy `/api/models` to `http://localhost:5001`.

Location: `platform/app/.webpack/webpack.pwa.js` (lines 176-180)

### Step 6: Rebuild Model Dictionary

If the model file exists but isn't in the dictionary:

1. **Trigger a rebuild:**
   ```
   POST http://localhost:5001/api/models/rebuild-dictionary
   ```

   Or use curl:
   ```bash
   curl -X POST http://localhost:5001/api/models/rebuild-dictionary
   ```

2. **Check the rebuild response:**
   ```json
   {
     "success": true,
     "message": "Model dictionary rebuilt",
     "count": X,
     "models": [ ... ]
   }
   ```

3. **Restart the model server:**
   ```bash
   # Stop current server (Ctrl+C)
   # Start again
   node server/startModelServer.js
   ```

## Common Issues

### 1. Model Server Not Running
**Symptom:** 404 on all `/api/models/*` requests
**Solution:** Start the model server on port 5001

### 2. Wrong Filename Format
**Symptom:** Model exists but not found
**Solution:** Ensure filename follows `7300-T10{diameter}{length}.obj` format
- Example: `7300-T106535.obj` (NOT `7300-T10-6.5-35.obj` or `7300-T10_6.5_35.obj`)

### 3. File in Wrong Directory
**Symptom:** File exists but not detected
**Solution:** Ensure file is in `models/server/` directory, not `models/uploads/`

### 4. Dictionary Not Built
**Symptom:** Server running but queries return "not found"
**Solution:** Rebuild dictionary or restart server

### 5. Parsing Issue
**Symptom:** File exists with correct name but still not found
**Solution:** Check server logs for parsing errors, verify diameter/length are in reasonable ranges (diameter 5-20mm, length 20-100mm)

## Quick Check Commands

```bash
# 1. Check if model server process is running
netstat -ano | findstr :5001

# 2. List all models in server directory
dir C:\Users\hp\tableTop\mvisioner\Viewers\models\server\*.obj

# 3. Test health endpoint
curl http://localhost:5001/api/health

# 4. View dictionary
curl http://localhost:5001/api/models/debug/dictionary

# 5. Test specific query
curl "http://localhost:5001/api/models/query?radius=3.25&length=35"
```

## Next Steps

1. Start the model server
2. Open `http://localhost:5001/api/models/debug/dictionary` in browser
3. Look for the key `"3.25_35"` in the dictionary
4. If not found, check if file `7300-T106535.obj` exists in `models/server/`
5. If file exists but not in dictionary, rebuild dictionary
6. Test query again

## Console Logs Location

With the enhanced logging, check:
1. **Model Server Console** (port 5001) - Shows all query details
2. **OHIF Viewer Console** (browser) - Shows client-side query logs from `viewportStateService.ts`
3. **Network Tab** (browser DevTools) - Shows HTTP request/response details
