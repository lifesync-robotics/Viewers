# Quick Start - Tracking Display Updates

## ⚠️ IMPORTANT: Complete These Steps in Order

### Step 1: Regenerate Protobuf Files (REQUIRED)
The protobuf schema was updated with new fields. You must regenerate the Python protobuf files:

```bash
cd AsclepiusPrototype/04_Tracking
bash compile_protobuf.sh
```

**What this does:**
- Compiles `proto/tracking_data.proto` 
- Generates `proto/tracking_data_pb2.py` with new quaternion, delta, and rom_file fields
- Takes about 10-15 seconds

**Expected output:**
```
==========================================
Compiling Protocol Buffer Definitions
==========================================

      ✓ Virtual environment found
   ✓ tracking_data_pb2.py generated
   ✓ tracking_data_pb2_grpc.py generated

✅ Protocol Buffers compiled successfully
   Generated files:
   - tracking_data_pb2.py
   - tracking_data_pb2_grpc.py
```

### Step 2: Restart Backend Services
The tracking server needs to be restarted to use the new protobuf files:

```bash
cd AsclepiusPrototype
./start_all_services_fixed.sh
```

Or if services are already running, just restart the tracking server:

```bash
# Find and kill the tracking server process
pkill -f "tracking_server.py"

# Restart just the tracking server
cd AsclepiusPrototype/04_Tracking
python start_tracking_coord_disruptor.py
```

### Step 3: Rebuild Frontend (if using production build)
If running in production mode, rebuild the frontend:

```bash
cd Viewers
yarn build
```

For development mode (hot-reload), no rebuild needed - changes are live.

### Step 4: Test the Changes

1. **Open OHIF Viewer**: http://localhost:3000
2. **Open Tracking Panel** (left sidebar)
3. **Load a tracking configuration**
4. **Start Navigation**

### Expected Display Format

You should now see tracking data matching the Python backend format:

```
📡 TRACKING FRAME 2675 - 3 handles detected
🟢 Live

✅ DR-VR04-A32              ● Visible
  Pos (mm):    [  161.7,   -78.5, -1429.2]
  Quat:        [-0.381, -0.544, +0.574, +0.479]
  Q:           0.183
  Δ:           0.02mm, 0.06°

🎯 DR-VR06-A33              ● Visible
  Pos (mm):    [   59.4,   -93.8, -1683.7]
  Quat:        [+0.474, +0.222, +0.850, -0.060]
  Q:           0.199
  Δ:           0.17mm, 0.08°

❌ DR-VR06-A32              ● Hidden
  ❌ NOT FOUND (ROM: DR-VR06-A32.rom)
```

## Troubleshooting

### Issue: "AttributeError: 'ToolTransform' object has no attribute 'quaternion_w'"
**Solution:** You forgot Step 1. Run `bash compile_protobuf.sh` to regenerate the protobuf files.

### Issue: UI doesn't show quaternion/delta
**Possible causes:**
1. Backend not restarted (do Step 2)
2. Protobuf files not regenerated (do Step 1)
3. Browser cache (hard refresh: Ctrl+Shift+R)

### Issue: Console errors about protobuf parsing
**Solution:** 
1. Check that `compile_protobuf.sh` completed successfully
2. Verify `proto/tracking_data_pb2.py` was modified (check file timestamp)
3. Restart all services

### Issue: Display format doesn't match Python backend
**Check:**
1. Browser console for JavaScript errors
2. TrackingPanel is receiving data (check React DevTools)
3. protobuf_bridge.js is correctly transforming data

## Verification Checklist

- [ ] Protobuf files regenerated (`tracking_data_pb2.py` has recent timestamp)
- [ ] Backend services restarted (all services running)
- [ ] Frontend rebuilt (if production mode)
- [ ] Browser cache cleared (hard refresh)
- [ ] Tracking Panel shows quaternion data
- [ ] Tracking Panel shows delta values
- [ ] "Not found" tools show ROM filename
- [ ] Status icons match (✅ 🎯 ❌)
- [ ] Frame counter displays correctly

## Command Reference

### Check if protobuf files are up to date:
```bash
ls -lh AsclepiusPrototype/04_Tracking/proto/tracking_data_pb2.py
```

### View Python backend tracking output:
```bash
# The Python backend prints tracking info every 3 seconds
# Check the console output for comparison with GUI
tail -f logs/tracking_server.log
```

### Check if services are running:
```bash
# SyncForge API (port 3001)
curl http://localhost:3001/api/health

# Tracking Config Service (port 50056)
grpcurl -plaintext localhost:50056 list
```

### Browser console debugging:
Open DevTools (F12) and check for:
1. WebSocket connection: `ws://localhost:3001/ws/tracking`
2. Tracking updates being received
3. TrackingPanel rendering

## Need Help?

If issues persist:
1. Check `TRACKING_DISPLAY_UPDATE.md` for detailed technical documentation
2. Review browser console for JavaScript errors
3. Check Python backend logs for protobuf errors
4. Verify all files were modified correctly (see "Files Modified" section in main doc)

