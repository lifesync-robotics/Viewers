# Phase 4 Quick Test Guide

## 🧪 30-Second Test

### Prerequisites
✅ SyncForge API running: `http://localhost:3001`
✅ Tracking simulator running
✅ OHIF Viewer running: `http://localhost:3000`

---

## Step-by-Step Test

### 1. **Open OHIF**
```
Navigate to: http://localhost:3000
Load any DICOM study (CT/MRI/MPR)
```

### 2. **Open Surgical Navigation Panel**
```
1. Look at RIGHT SIDEBAR
2. Click the panel selector
3. Select "🧭 Surgical Navigation"
```

**Expected:** Dark panel with "Phase 4: UI Components" subtitle appears

---

### 3. **Verify Panel Sections**

**Should see:**
- ✅ Connection Status (4 rows with dots)
- ✅ Controls (2 buttons)
- ✅ Position Display (coordinates)
- ✅ Case & Transformation (input + buttons)
- ✅ Frame counter at bottom

---

### 4. **Load Identity Transformation**
```
Click: "📐 Load Identity Matrix"
```

**Expected:**
- Console: `✅ Identity transformation loaded`
- Transform status: `Identity ✅`

---

### 5. **Start Navigation**
```
Click: "▶ Start Navigation"
```

**Expected:**
- Button changes to "⏸ Stop Navigation"
- Status dots turn GREEN 🟢
- Hz values appear
- Notice: "🔄 Navigation active - tracking in real-time"

**Console Output:**
```
🚀 Starting navigation from UI...
🧭 [startNavigation] Starting navigation mode: linear
🎯 TrackingService initialized
🔗 Requesting WebSocket URL from SyncForge API
✅ Got WebSocket URL: ws://localhost:3001/ws/tracking
✅ WebSocket connected - tracking data streaming at 100Hz
```

---

### 6. **Watch Real-Time Updates**

**Position Display should show:**
```
Register: [75.2, 0.1, -20.0] mm    ← Changes every frame
Visibility: ✓ Visible
Quality: ⭐⭐⭐⭐⭐ (excellent)
Transform: Identity ✅
```

**Status should show:**
```
API:        🟢 Connected
WebSocket:  🟢 100.0 Hz          ← Data rate
UI Update:  🟢 25.0 Hz           ← UI rate
Navigation: 🟢 Active
```

**Frame counter increments:** `Frames: 25, 50, 75...`

---

### 7. **Verify Crosshair Movement**

**In MPR viewports:**
- ✅ Crosshair should move in circular/linear pattern
- ✅ All 3 views synchronized
- ✅ Smooth motion (no jitter)

---

### 8. **Stop Navigation**
```
Click: "⏸ Stop Navigation"
```

**Expected:**
- Button changes back to "▶ Start Navigation"
- Status dots turn GRAY ⚪
- Notice disappears
- Position freezes at last value

---

## ✅ Success Criteria

| Test | Expected Result | Status |
|------|----------------|--------|
| Panel visible | Appears in right sidebar | ☐ |
| All sections render | 5 sections displayed | ☐ |
| Identity load works | Transform status updates | ☐ |
| Start button works | Navigation begins | ☐ |
| Status updates | Green dots, Hz values | ☐ |
| Position updates | Coordinates change | ☐ |
| Crosshair moves | Smooth circular motion | ☐ |
| Stop button works | Navigation ends | ☐ |

---

## 🐛 Troubleshooting

### Panel Not Visible
```bash
# Check webpack compiled
tail -20 /tmp/ohif_dev.log

# Hard reload browser
Ctrl+Shift+R
```

### No Data Updates
```bash
# Check SyncForge API
curl http://localhost:3001/api/health

# Check tracking simulator
ps aux | grep tracking_simulator
```

### Connection Fails
```
# Console shows old error?
Clear browser cache completely
Close all tabs
Reopen in Incognito
```

---

## 🎨 Visual Check

### Colors Should Be:
- 🟢 **Green** - Active/Connected
- ⚪ **Gray** - Inactive/Disconnected
- 🔵 **Blue** - Headings/accents
- ⚫ **Dark** - Background (#1a1a2e)

### Animations:
- Status dots should **pulse** when active
- Buttons should have **hover effects**
- Text should be **clear and readable**

---

## 📸 Screenshot Checklist

Take screenshots of:
1. Panel closed (right sidebar buttons)
2. Panel open (full UI)
3. Before starting navigation
4. During navigation (green indicators)
5. Position with data
6. Crosshair moving in viewport

---

## 🔧 Advanced Tests

### Test Case Loading
```
1. Enter case ID (if you have one)
2. Click "📂 Load"
3. Watch for case info display
4. Check console for transformation load
```

### Test Transformation
```
1. Load identity
2. Start navigation
3. Watch position (only Register shown)
4. Stop
5. Load case with rMd
6. Start again
7. Now BOTH Register and DICOM shown
```

---

## 📊 Performance Check

```javascript
// In browser console
const status = window.__navigationController.getStatus();
console.log('Actual FPS:', status.actualFPS);
console.log('Update count:', status.updateCount);
```

**Expected:**
- Actual FPS: ~25 Hz
- No console errors
- Smooth updates
- No memory leaks

---

## ✅ Phase 4 Test Complete!

If all tests pass:
- ✅ Panel renders correctly
- ✅ All controls functional
- ✅ Real-time updates working
- ✅ Visual feedback clear
- ✅ No errors in console

**Status:** READY TO COMMIT! 🎉

---

**Next:** Commit Phase 4 changes and create milestone tag
