# 🧭 How to Use Tracking in OHIF

## Two Panels Available

### **1. Tracking Control** (Configuration Panel)
- **Icon**: 🔧 (tool-more-menu)
- **Label**: "Tracking"
- **Purpose**: Configure tracking mode, enable/disable tools, view system status
- **What you see**:
  - Tracking Mode (Simulation/Hardware)
  - Tracking Tools list
  - System Status
  - Refresh/Reload buttons

### **2. Surgical Navigation** (Navigation Panel) ⭐ NEW
- **Icon**: ✛ (crosshair)
- **Label**: "Navigate"
- **Purpose**: Start/stop tracking and see real-time position
- **What you see**:
  - Start/Stop Navigation buttons
  - Set Center button
  - Real-time crosshair position (X, Y, Z)
  - Frame counter

---

## 🚀 How to Start Tracking (Step by Step)

### **Prerequisites**
Make sure these are running:

```bash
# Terminal 1: SyncForge API
cd AsclepiusPrototype/00_SyncForgeAPI
npm start

# Terminal 2: Tracking Simulator
cd AsclepiusPrototype/04_Tracking
python tracking_simulator.py --port 9999

# Terminal 3: OHIF
cd Viewers
yarn dev
```

---

### **Step 1: Open OHIF**
- Navigate to: http://localhost:3000
- Load any DICOM study

---

### **Step 2: Open "Surgical Navigation" Panel**
- Look for the **crosshair icon** (✛) in the sidebar
- Label: "Navigate"
- Click to open

You should see:
```
┌─────────────────────────────────┐
│ 🧭 Surgical Navigation          │
├─────────────────────────────────┤
│ Connection Status               │
│ ● Connected                     │
│ Navigation Status               │
│ ● Inactive                      │
├─────────────────────────────────┤
│ [▶️ Start Navigation]           │
│ [📍 Set Center]                 │
└─────────────────────────────────┘
```

---

### **Step 3: Start Navigation**
1. Click **"▶️ Start Navigation"** button
2. Wait 1-2 seconds
3. You should see:
   - Button changes to "⏹️ Stop Navigation"
   - "Crosshair Position" section appears
   - X, Y, Z coordinates start updating
   - Frame counter incrementing

```
┌─────────────────────────────────┐
│ Crosshair Position              │
├─────────────────────────────────┤
│ X:  45.23 mm                    │
│ Y:  23.45 mm                    │
│ Z:   8.67 mm                    │
│ Quality: excellent              │
│ Frames: 1234                    │
└─────────────────────────────────┘
```

---

### **Step 4: Watch the Crosshair Move**
- The crosshair in the viewport should start moving
- It follows the simulated tracking data
- In simulation mode, it moves in a circular pattern

---

### **Step 5: Set Center (Optional)**
- Click **"📍 Set Center"** to recenter the tracking
- The current crosshair position becomes the new center point

---

### **Step 6: Stop Navigation**
- Click **"⏹️ Stop Navigation"** when done
- Crosshair stops moving
- Position display disappears

---

## 🎯 What Each Panel Does

### **Tracking Control Panel**
Use this to:
- ✅ Switch between Simulation and Hardware mode
- ✅ Enable/disable specific tracking tools
- ✅ Check system status
- ✅ Reload configuration
- ✅ View Phase 4 features (Patient Reference Status, Tool Coordinates)

### **Surgical Navigation Panel**
Use this to:
- ✅ Start/Stop tracking navigation
- ✅ See real-time crosshair position
- ✅ Set tracking center
- ✅ Monitor connection status
- ✅ View frame count

---

## 🐛 Troubleshooting

### **Problem: "Start Navigation" button does nothing**

**Check**:
1. Is SyncForge API running?
   ```bash
   curl http://localhost:3001/api/health
   ```
2. Is tracking simulator running?
   ```bash
   ps aux | grep tracking_simulator
   ```
3. Check browser console (F12) for errors

---

### **Problem: "Connection Status: Disconnected"**

**Solution**:
```bash
# Restart SyncForge API
cd AsclepiusPrototype/00_SyncForgeAPI
pkill -f "node.*server.js"
npm start
```

---

### **Problem: Crosshair doesn't move**

**Check**:
1. Is navigation started? (Button should say "Stop Navigation")
2. Is simulator sending data?
   ```bash
   # Check simulator log
   tail -f AsclepiusPrototype/logs/simulator_*.log
   ```
3. Is WebSocket connected? (Check "WebSocket (Tracking): Connected" in footer)

---

### **Problem: "Surgical Navigation" panel not showing**

**Solution**:
```bash
# Clear OHIF cache
cd Viewers
rm -rf .webpack node_modules/.cache
yarn dev
```

---

## 📊 Expected Behavior

### **Simulation Mode**
- Crosshair moves in a **circular pattern**
- Update rate: ~80-100 Hz
- 4 tools visible: pr, EE, pointer, crosshair
- Position changes smoothly

### **Hardware Mode** (NDI Tracker)
- Crosshair follows the physical pointer
- Update rate: ~30 Hz (depends on NDI settings)
- Position reflects real-world movement

---

## 🎮 Keyboard Shortcuts

None yet, but you can add them in `commandsModule.ts`!

---

## 📝 Summary

**Quick Start:**
1. Start API + Simulator
2. Open OHIF
3. Load study
4. Open "Surgical Navigation" panel (crosshair icon)
5. Click "Start Navigation"
6. Watch crosshair move!

**That's it! 🎉**
