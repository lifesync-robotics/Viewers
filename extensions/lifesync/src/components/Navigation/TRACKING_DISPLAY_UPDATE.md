# Tracking Display Update - Quaternion & Delta Information

## Overview
Updated the tracking display system to match the Python backend printout format, showing quaternion, delta values, and ROM file information for debugging purposes.

## Python Backend Output Format (Reference)
```
📡 TRACKING FRAME 2675 - 3 handles detected
====================================================================================================
✅ [1] DR-VR04-A32          | Pos:[  161.7,   -78.5, -1429.2] | Quat:[-0.381, -0.544, +0.574, +0.479] | Q:0.183 | Δ:0.02mm, 0.06°
❌ [2] DR-VR06-A32          | NOT FOUND (ROM: DR-VR06-A32.rom)
🎯 [3] DR-VR06-A33          | Pos:[   59.4,   -93.8, -1683.7] | Quat:[+0.474, +0.222, +0.850, -0.060] | Q:0.199 | Δ:0.17mm, 0.08°
```

## Changes Made

### 1. Protocol Buffer Definition (`tracking_data.proto`)
**Location:** `AsclepiusPrototype/04_Tracking/proto/tracking_data.proto`

Added new fields to `ToolTransform` message:
```protobuf
// Quaternion (w, x, y, z) - Better for tracking rotation changes
double quaternion_w = 22;
double quaternion_x = 23;
double quaternion_y = 24;
double quaternion_z = 25;

// Delta (frame-to-frame changes) - For tracking movement
double delta_position_mm = 26;      // Position change in mm
double delta_rotation_deg = 27;     // Rotation change in degrees

// ROM file information (for debugging not found tools)
string rom_file = 28;                // ROM filename being used
```

### 2. Python Backend (`tracking_server.py`)
**Location:** `AsclepiusPrototype/04_Tracking/tracking_server.py`

#### Changes:
1. **Added ROM file to tool_matrices** (line ~1562):
   - Now includes `'rom_file': rom_file` in tool data dictionary

2. **Populate quaternion in protobuf message** (line ~2055-2058):
   ```python
   # Extract quaternion from rotation matrix
   quat_tracker = self._matrix_to_quaternion(matrix_tracker)
   tool.quaternion_w = quat_tracker[0]
   tool.quaternion_x = quat_tracker[1]
   tool.quaternion_y = quat_tracker[2]
   tool.quaternion_z = quat_tracker[3]
   ```

3. **Calculate and populate delta values** (line ~2061-2080):
   ```python
   # Calculate delta (frame-to-frame changes)
   if tool_id in self._prev_tool_states:
       prev_state = self._prev_tool_states[tool_id]
       prev_pos = prev_state['position']
       prev_quat = prev_state['quaternion']
       
       pos_delta = np.linalg.norm(pos - prev_pos)
       rot_delta = self._quaternion_angular_distance(prev_quat, quat_tracker)
       
       tool.delta_position_mm = pos_delta
       tool.delta_rotation_deg = rot_delta
   else:
       tool.delta_position_mm = 0.0
       tool.delta_rotation_deg = 0.0
   ```

4. **Add ROM file to protobuf** (line ~2037):
   ```python
   tool.rom_file = tool_data.get('rom_file', '')
   ```

### 3. TypeScript Types (`tracking.types.ts`)
**Location:** `Viewers/extensions/lifesync/src/types/tracking.types.ts`

Added new optional fields to `ToolTransform` interface:
```typescript
// Quaternion (w, x, y, z) - Better for tracking rotation
quaternion?: [number, number, number, number];  // [w, x, y, z]

// Delta (frame-to-frame changes)
delta_position_mm?: number;         // Position change in mm
delta_rotation_deg?: number;        // Rotation change in degrees

// ROM file information
rom_file?: string;                  // ROM filename being used
```

### 4. Protobuf Bridge (`protobuf_bridge.js`)
**Location:** `AsclepiusPrototype/00_SyncForgeAPI/api/tracking/protobuf_bridge.js`

Added transformation for new fields (line ~721-734):
```javascript
tools[tool.toolId] = {
  tool_name: tool.toolName || tool.toolId,
  visible: tool.visible !== undefined ? tool.visible : true,
  quality: tool.quality || 'unknown',
  quality_score: tool.qualityScore || 0.0,
  is_patient_reference: tool.isPatientReference || false,
  
  // Quaternion (w, x, y, z)
  quaternion: tool.quaternionW !== undefined ? [
    tool.quaternionW || 1.0,
    tool.quaternionX || 0.0,
    tool.quaternionY || 0.0,
    tool.quaternionZ || 0.0
  ] : undefined,
  
  // Delta (frame-to-frame changes)
  delta_position_mm: tool.deltaPositionMm || 0.0,
  delta_rotation_deg: tool.deltaRotationDeg || 0.0,
  
  // ROM file information
  rom_file: tool.romFile || '',
  
  coordinates: {
    // ... existing coordinate data
  }
};
```

### 5. Tracking Panel UI (`TrackingPanel.tsx`)
**Location:** `Viewers/extensions/lifesync/src/components/Tracking/TrackingPanel.tsx`

#### Display Updates:

1. **Status Icons** (matching Python backend):
   - ✅ Patient Reference (visible)
   - 🎯 Instrument (visible)
   - ❌ Tool not found

2. **Frame Counter Display**:
   ```tsx
   📡 TRACKING FRAME {frameNumber} - {handleCount} handles detected
   🟢 Live / 🔴 Disconnected
   ```

3. **Tool Information Display**:
   - **Position**: `Pos (mm): [x, y, z]` with formatted spacing
   - **Quaternion**: `Quat: [+w, +x, +y, +z]` with sign indicators
   - **Quality**: `Q: 0.xxx` (3 decimal places)
   - **Delta**: `Δ: 0.xxmm, 0.xx°` (position and rotation changes)

4. **Not Found Handling**:
   ```tsx
   ❌ NOT FOUND (ROM: filename.rom)
   ```

## Deployment Steps

### ⚠️ REQUIRED: Regenerate Protobuf Files
Before the changes can work, you must regenerate the Python protobuf files:

```bash
cd AsclepiusPrototype/04_Tracking
bash compile_protobuf.sh
```

This will:
1. Use the Python virtual environment (`.venv`)
2. Compile `tracking_data.proto` using `grpc_tools.protoc`
3. Generate:
   - `proto/tracking_data_pb2.py` (protobuf messages)
   - `proto/tracking_data_pb2_grpc.py` (gRPC service definitions)

### Testing the Changes

1. **Start the backend services**:
   ```bash
   cd AsclepiusPrototype
   ./start_all_services_fixed.sh
   ```

2. **Start the OHIF viewer** (if not started automatically):
   ```bash
   cd Viewers
   yarn run dev
   ```

3. **Load a tracking configuration** in the Tracking Panel

4. **Start navigation** to see the updated display

## Expected UI Behavior

### For Visible Tools:
```
🎯 DR-VR06-A33              ● Visible
  Pos (mm):    [   59.4,   -93.8, -1683.7]
  Quat:        [+0.474, +0.222, +0.850, -0.060]
  Q:           0.199
  Δ:           0.17mm, 0.08°
```

### For Patient Reference:
```
✅ DR-VR04-A32              ● Visible
  Pos (mm):    [  161.7,   -78.5, -1429.2]
  Quat:        [-0.381, -0.544, +0.574, +0.479]
  Q:           0.183
  Δ:           0.02mm, 0.06°
```

### For Tools Not Found:
```
❌ DR-VR06-A32              ● Hidden
  ❌ NOT FOUND (ROM: DR-VR06-A32.rom)
```

## Benefits for Debugging

1. **Quaternion Display**: 
   - More accurate rotation representation than Euler angles
   - No gimbal lock issues
   - Better for tracking small rotational changes

2. **Delta Values**:
   - Immediately see frame-to-frame movement
   - Helps identify tracking jitter or instability
   - Useful for validating tracking quality

3. **ROM File Display**:
   - Quickly identify which ROM file is being used
   - Debug missing ROM files
   - Verify correct tool configuration

4. **Status Icons**:
   - Quick visual identification of tool types and status
   - Matches Python backend console output
   - Consistent debugging experience

## Files Modified

1. `AsclepiusPrototype/04_Tracking/proto/tracking_data.proto` (protobuf schema)
2. `AsclepiusPrototype/04_Tracking/tracking_server.py` (backend data population)
3. `AsclepiusPrototype/00_SyncForgeAPI/api/tracking/protobuf_bridge.js` (data transformation)
4. `Viewers/extensions/lifesync/src/types/tracking.types.ts` (TypeScript types)
5. `Viewers/extensions/lifesync/src/components/Tracking/TrackingPanel.tsx` (UI display)

## Notes

- All new fields are **optional** to maintain backward compatibility
- Delta values start at 0.0 for the first frame
- Quaternion format is **[w, x, y, z]** (scalar-first convention)
- ROM file field is populated from tracking configuration
- The display is **monospace font** for alignment with Python backend output

## Future Enhancements

1. Add color coding for delta values (green = stable, yellow = moving, red = unstable)
2. Add historical delta tracking graphs
3. Add quaternion interpolation visualization
4. Add ROM file switching UI
5. Add tracking quality trend analysis

