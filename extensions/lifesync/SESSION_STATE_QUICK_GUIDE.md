# Session State Button - Quick Guide

## What Was Added

A new **light cyan button (📋)** next to the test crosshair button that opens a comparison dialog showing:
- **Left Side:** Frontend UI state (screws, session info)
- **Right Side:** Backend session summary from Python backend
- **Alignment Check:** Visual indicator if frontend/backend are in sync

**Note:** The button has a bright cyan background (`bg-cyan-400`) with dark text for high visibility.

## How to Use

1. Click the bright cyan **📋** button in the header (next to 🧪)
2. Dialog opens showing side-by-side comparison
3. **Left side** shows all screws currently in the UI
4. **Right side** shows backend session summary from `GetSessionSummary`
5. Check the **alignment status** at the bottom of the right panel:
   - ✅ Green = Synchronized
   - ⚠️ Red = Out of sync

## What It Shows

### Frontend UI State (Left - Blue)
```
📋 Session Info
- Session ID
- Case ID
- Surgeon

🔩 Screws (count)
For each screw:
- Label (e.g., L3-R1)
- ID
- Radius, Length
- Level, Side

🦴 Rods (placeholder)
```

### Backend Summary (Right - Green)
```
📋 Session Info
- Session ID
- Series UID
- Surgeon
- Created timestamp
- Duration

🔩 Screws (X / 10)
- Total count
- Remaining capacity
- Labels (as badges)
- Distribution by level:
  - L3: L=1 R=1 (Total: 2)
  - L4: L=1 R=0 (Total: 1)

🦴 Rods (X / 5)
- Total count
- Remaining capacity

✅/⚠️ Alignment Status
```

## Use Cases

### ✅ Sanity Check
Quickly verify that UI and backend are synchronized

### 🐛 Debugging
- Check if screws are saved correctly
- Verify session state
- Identify sync issues

### 📊 Monitoring
- View capacity limits
- Check screw distribution by level
- Monitor session health

## Button Location

```
Header: 🔩 Screw Management
        [🧪] [📋] [📂] [💾] [🧹]
         ↑    ↑    ↑    ↑    ↑
      Test  NEW!  Load Save Clear
```

## Implementation Details

### Frontend Changes
- **Service:** `planningBackendService.getSessionSummary(sessionId)`
- **UI:** New `SessionStateDialog` component
- **Handler:** `showSessionState()` function

### Backend Endpoint (Already Exists)
- **URL:** `GET /api/planning/session/:sessionId/summary`
- **gRPC:** `GetSessionSummary` method in `planning_server.py`

### State References
- **UI State:** From `ScrewManagementPanel` lines 34-46
  - `screws`, `sessionId`, `caseId`, `studyInstanceUID`, `seriesInstanceUID`, `surgeon`
- **Backend State:** From `planning_server.py` line 341
  - `GetSessionSummary` method returns comprehensive session data

## Testing Scenarios

1. **Empty State:** Both sides should show 0 screws ✅
2. **Add Screw:** Counts should increment on both sides ✅
3. **Delete Screw:** Counts should decrement on both sides ✅
4. **Backend Down:** Left side works, right side shows error 🔴
5. **Session Expired:** Right side shows appropriate error 🔴

## Screenshots Location

Visual examples of the dialog in action can be seen by:
1. Running the application
2. Adding some screws
3. Clicking the new 📋 button
4. Observing the two-column comparison layout

---

**Note:** This is a diagnostic/debugging tool. It does NOT modify any data - it only displays current state for comparison.
