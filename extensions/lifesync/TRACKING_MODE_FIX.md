# Tracking Mode Configuration Fix
**Date**: 2025-11-20
**Issue**: Configuration specifies hardware mode, but system still uses simulation mode
**Status**: ✅ Fixed

---

## 🐛 Problem

**User reported**:
> "When I press start navigation, it still calling simulation mode, even though I have loaded a plan of Default_Hardware which specify using hardware"

**Root Cause**:
1. ❌ Configuration was **saved** with `tracking_mode: 'hardware'` but not **applied**
2. ❌ TrackingService **hardcoded** `mode: 'simulation'` when connecting
3. ❌ No API call to switch tracking mode when configuration was applied

---

## 🔍 Issues Found

### Issue 1: Configuration Not Applied to Backend

**Location**: `TrackingConfigDialog.tsx` → `applyConfiguration()` and `saveConfiguration()`

**Problem**:
- Configuration saved `tracking_mode` to database ✅
- Configuration synced to `tracking_config.json` ✅
- But **never called** `PUT /api/tracking/mode` to switch actual tracking mode ❌

**Code Before**:
```typescript
// Save/Apply configuration
await syncConfigToBackend(configuration);
setSuccess('Configuration applied'); // ❌ Mode not switched!
```

### Issue 2: TrackingService Hardcoded Simulation Mode

**Location**: `TrackingService.ts` → `connect()`

**Problem**:
- Always sent `mode: 'simulation'` to connect API
- Ignored configuration setting

**Code Before**:
```typescript
// Line 85 & 111
body: JSON.stringify({
  mode: 'simulation' // ❌ HARDCODED!
})
```

---

## ✅ Solutions Implemented

### Fix 1: Apply Tracking Mode on Configuration Save/Apply

**File**: `TrackingConfigDialog.tsx`

**Changes**:

#### In `applyConfiguration()`:
```typescript
// Step 1: Sync config to backend
await syncConfigToBackend(configuration);

// Step 2: ✅ NEW - Switch tracking mode
console.log(`🔄 Switching tracking mode to: ${trackingMode}`);
const modeResponse = await fetch(`${apiBase}/api/tracking/mode`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ mode: trackingMode })
});

const modeResult = await modeResponse.json();
if (modeResult.success) {
  console.log(`✅ Tracking mode switched to: ${trackingMode}`);
}
```

#### In `saveConfiguration()`:
```typescript
// Step 1: Save to database
await saveToDatabase(configuration);

// Step 2: Sync to backend
await syncConfigToBackend(configuration);

// Step 3: ✅ NEW - Switch tracking mode
const modeResponse = await fetch(`${apiBase}/api/tracking/mode`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ mode: trackingMode })
});
```

---

### Fix 2: Read Tracking Mode from Configuration on Connect

**File**: `TrackingService.ts`

**Changes**:

```typescript
// ✅ NEW - Step 1: Get current tracking configuration
let trackingMode = 'simulation'; // Default
try {
  const configResponse = await fetch(`${apiUrl}/api/tracking/config`);
  if (configResponse.ok) {
    const configData = await configResponse.json();
    trackingMode = configData.tracking_mode?.current || 'simulation';
    console.log(`📋 Using tracking mode from config: ${trackingMode}`);
  }
} catch (configError) {
  console.warn('⚠️ Could not fetch tracking config, using simulation mode');
}

// Step 2: Connect with configured mode
console.log(`🔌 Connecting with mode: ${trackingMode}`);
let response = await fetch(`${apiUrl}/api/tracking/connect`, {
  method: 'POST',
  body: JSON.stringify({
    mode: trackingMode // ✅ Uses actual config value!
  })
});
```

**Retry logic also fixed**:
```typescript
// Retry connection with same mode
response = await fetch(`${apiUrl}/api/tracking/connect`, {
  method: 'POST',
  body: JSON.stringify({
    mode: trackingMode // ✅ No longer hardcoded
  })
});
```

---

## 🔄 Complete Flow (After Fix)

### Scenario: User Loads Hardware Configuration

```
1. User opens Configuration Dialog
   ↓
2. Clicks "Load Saved Configurations"
   ↓
3. Selects "Default_Hardware"
   ↓ (tracking_mode: 'hardware' loaded into UI)
4. Clicks "Apply" or "Save"
   ↓
5. ✅ TrackingConfigDialog.applyConfiguration()
   ├─ Syncs to tracking_config.json
   └─ Calls PUT /api/tracking/mode { mode: 'hardware' }
   ↓
6. User clicks "Start Navigation" / "Connect"
   ↓
7. ✅ TrackingService.connect()
   ├─ Fetches GET /api/tracking/config
   ├─ Reads tracking_mode.current = 'hardware'
   └─ Calls POST /api/tracking/connect { mode: 'hardware' }
   ↓
8. ✅ Backend starts in HARDWARE mode
   ↓
9. ✅ System uses NDI hardware, not simulation
```

---

## 🧪 Testing

### Test Case 1: Apply Hardware Mode

**Steps**:
1. Open Tracking Configuration Dialog
2. Select tracking mode: **Hardware**
3. Configure patient reference and tools
4. Click **"Apply"**
5. Check browser console

**Expected Console Output**:
```
🔄 Syncing configuration to backend...
✅ Backend configuration synced successfully
🔄 Switching tracking mode to: hardware
✅ Tracking mode switched to: hardware
```

### Test Case 2: Connect with Hardware Mode

**Steps**:
1. After applying hardware configuration
2. Open Tracking Panel
3. Click **"Connect"**
4. Check browser console

**Expected Console Output**:
```
🔗 Requesting WebSocket URL from SyncForge API
📋 Using tracking mode from config: hardware
🔌 Connecting with mode: hardware
✅ Connected to tracking server
```

### Test Case 3: Load Saved Hardware Configuration

**Steps**:
1. Open Configuration Dialog
2. Click "Load Saved Configurations"
3. Select "Default_Hardware"
4. Click "Apply"
5. Click "Connect"
6. Verify system uses hardware mode

**Expected**:
- Configuration mode indicator shows: `🔧 Hardware`
- Console shows: `mode: hardware`
- Backend uses NDI hardware (not simulation)

---

## 📊 Before vs After

| Aspect | Before | After |
|--------|--------|-------|
| **Config Save** | Saves to DB only | Saves + Applies mode ✅ |
| **Config Apply** | Syncs config only | Syncs + Switches mode ✅ |
| **Connect** | Always `simulation` | Reads from config ✅ |
| **User Experience** | Mode not respected ❌ | Mode works correctly ✅ |

---

## 🎯 API Calls Flow

### Old Flow (Broken)
```
TrackingConfigDialog
  ↓ POST /api/tracking/configurations (save to DB)
  ↓ POST /api/tracking/config/sync (sync config)
  ❌ (No mode switch!)

TrackingService.connect()
  ↓ POST /api/tracking/connect { mode: 'simulation' } ❌ WRONG
```

### New Flow (Fixed)
```
TrackingConfigDialog
  ↓ POST /api/tracking/configurations (save to DB)
  ↓ POST /api/tracking/config/sync (sync config)
  ↓ PUT /api/tracking/mode { mode: 'hardware' } ✅ NEW

TrackingService.connect()
  ↓ GET /api/tracking/config (read mode)
  ↓ POST /api/tracking/connect { mode: 'hardware' } ✅ CORRECT
```

---

## 🚀 Deployment

### 1. Restart webpack dev server

```bash
cd Viewers/platform/app
# Press Ctrl+C to stop
yarn dev
```

### 2. Clear browser cache

**Complete refresh**:
- Mac: `Cmd + Shift + R`
- Windows/Linux: `Ctrl + Shift + R`

### 3. Test

1. Load "Default_Hardware" configuration
2. Apply configuration
3. Check console for: `✅ Tracking mode switched to: hardware`
4. Click "Connect"
5. Check console for: `🔌 Connecting with mode: hardware`
6. Verify NDI hardware is used

---

## 📝 Related Files Modified

1. **`TrackingConfigDialog.tsx`**
   - ✅ `applyConfiguration()` - Added mode switch
   - ✅ `saveConfiguration()` - Added mode switch

2. **`TrackingService.ts`**
   - ✅ `connect()` - Reads mode from config
   - ✅ Retry logic - Uses correct mode

---

## ✅ Summary

**Root Cause**: Configuration saved mode but didn't apply it; Service hardcoded simulation mode

**Solution**:
1. **Save/Apply** → Call `PUT /api/tracking/mode` to switch mode
2. **Connect** → Read mode from config via `GET /api/tracking/config`

**Result**: Hardware mode now works correctly when configured! 🎉
