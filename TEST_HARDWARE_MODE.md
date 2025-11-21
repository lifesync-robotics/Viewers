# Quick Test: Hardware Mode Configuration
**Date**: 2025-11-20

---

## 🚀 Quick Test Steps

### Step 1: Restart webpack dev server

```bash
cd /Users/ronaldtse/development/LifeSyncRobotics/Viewers/platform/app

# Stop current server (Ctrl+C), then:
yarn dev

# Wait for compilation...
```

### Step 2: Open browser and clear cache

1. Open: `http://localhost:3000` (or whatever port)
2. **Clear cache**: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
3. Open DevTools Console (F12)

### Step 3: Load your "Default_Hardware" configuration

1. Open **Tracking Panel**
2. Click **"⚙️ Configuration"** button
3. Click **"Load Saved Configurations"**
4. Select **"Default_Hardware"**
5. **Check console** - should see:
   ```
   Loading configuration: Default_Hardware
   ```

### Step 4: Apply the configuration

1. Click **"Apply"** button
2. **Watch console carefully** - should see:
   ```
   🔄 Syncing configuration to backend...
   ✅ Backend configuration synced successfully
   🔄 Switching tracking mode to: hardware
   ✅ Tracking mode switched to: hardware
   Configuration applied - Mode: hardware
   ```

**✅ If you see these messages** → Mode switch is working!

**❌ If you don't see** "Tracking mode switched to: hardware" → Something failed

### Step 5: Connect to tracking

1. Close Configuration Dialog
2. In Tracking Panel, click **"Connect"**
3. **Watch console** - should see:
   ```
   🔗 Requesting WebSocket URL from SyncForge API
   📋 Using tracking mode from config: hardware
   🔌 Connecting with mode: hardware
   ✅ Connected to tracking server
   ```

**✅ If mode = hardware** → SUCCESS!

**❌ If mode = simulation** → Old code still cached, try harder refresh

### Step 6: Verify backend is using hardware

Check SyncForge API:
```bash
curl http://localhost:3001/api/tracking/status | python3 -m json.tool
```

**Expected**:
```json
{
  "success": true,
  "status": {
    "active": true,
    "mode": "hardware",    // ← Should say "hardware"
    "bridge_initialized": true
  }
}
```

---

## 🐛 Troubleshooting

### Problem: Still shows "simulation" in console

**Cause**: Old code cached in browser

**Solution**:
1. Close ALL browser tabs with the app
2. Clear browser cache completely:
   - Chrome: Settings → Privacy → Clear browsing data → Cached images and files
3. Restart browser
4. Open app again

### Problem: Mode switch fails

**Console shows**: `⚠️ Failed to switch tracking mode`

**Cause**: Backend API error

**Solution**:
1. Check SyncForge API is running:
   ```bash
   curl http://localhost:3001/api/health
   ```
2. Check tracking must be disconnected before switching mode:
   ```bash
   curl -X POST http://localhost:3001/api/tracking/disconnect
   ```
3. Try applying configuration again

### Problem: Configuration not found

**Error**: "Configuration not found in database"

**Solution**:
1. Save configuration first (don't just load)
2. Or create new configuration with hardware mode

---

## 📋 Checklist

- [ ] Webpack dev server restarted
- [ ] Browser cache cleared (hard refresh)
- [ ] Configuration loaded
- [ ] "Apply" button clicked
- [ ] Console shows "Tracking mode switched to: hardware"
- [ ] "Connect" clicked
- [ ] Console shows "Connecting with mode: hardware"
- [ ] Backend status shows `"mode": "hardware"`

**If all checked** ✅ → Hardware mode is working!

---

## 🎯 Expected vs Actual

### When Everything Works

**Console Output**:
```
// After clicking Apply:
🔄 Syncing configuration to backend...
✅ Backend configuration synced successfully
🔄 Switching tracking mode to: hardware
✅ Tracking mode switched to: hardware

// After clicking Connect:
🔗 Requesting WebSocket URL from SyncForge API
📋 Using tracking mode from config: hardware
🔌 Connecting with mode: hardware
✅ Connected to tracking server
```

**UI Indicator**:
```
Tracking Panel → Configuration badge shows:
🔧 Hardware  (not 🖥️ Simulation)
```

---

## 🚨 If It Still Doesn't Work

**Contact developer with**:
1. Full console output (screenshot or copy-paste)
2. Result of: `curl http://localhost:3001/api/tracking/config | python3 -m json.tool`
3. Result of: `curl http://localhost:3001/api/tracking/status | python3 -m json.tool`
4. Browser version and operating system
