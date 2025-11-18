# 🔄 Force Reload Instructions

The viewer is showing old code (Export JSON button) instead of the new code (Save Plan button).

## Solution: Force Browser to Reload New Code

### **Option 1: Hard Refresh (Quickest)**

1. Open the OHIF Viewer in your browser (http://localhost:3000)
2. **Hard refresh** to clear cache:
   - **Mac**: Press `Cmd + Shift + R`
   - **Windows/Linux**: Press `Ctrl + Shift + F5` or `Ctrl + Shift + R`
3. Wait for the page to fully reload
4. Check if the buttons have changed:
   - ❌ Old: 📤 Import | 📥 Export
   - ✅ New: 📂 Load Plan | 💾 Save Plan

---

### **Option 2: Clear Browser Cache**

If hard refresh doesn't work:

1. Open Developer Tools (F12)
2. Right-click the refresh button in the browser
3. Select **"Empty Cache and Hard Reload"**
4. Wait for page to reload

---

### **Option 3: Restart Webpack Dev Server**

If the above doesn't work, restart the viewer:

```bash
# In the terminal where viewer is running, press Ctrl+C to stop it
# Then restart:
cd /Users/ronaldtse/development/LifeSyncRobotics/Viewers
yarn run dev:viewer
```

Wait for webpack to compile (you'll see "Compiled successfully" message), then refresh the browser.

---

## ✅ How to Verify It's Working

After reloading, you should see:

### **Header Buttons (Top-Right)**:
- **Before placing screws**: 🧪 | 📂 Load Plan
- **After placing screws**: 🧪 | 📂 Load Plan | 💾 Save Plan | 🧹 Clear All

### **Test the New Functionality**:
1. Place a screw (radius: 3, length: 40)
2. Click **💾 Save Plan** (should appear after placing screw)
3. You should see a **prompt asking for plan name** (NOT a JSON download)
4. Enter a name like "Test Plan"
5. You should see success alert: "Plan saved successfully! Plan ID: PLAN-..."

---

## 🐛 Still Not Working?

If you still see the old Export JSON button:

1. Check webpack compilation output in the terminal
2. Look for any errors during build
3. Try closing ALL browser tabs with OHIF and opening a fresh one
4. Check if there are multiple viewer instances running:
   ```bash
   lsof -ti:3000
   ```
   If you see multiple PIDs, kill them all and restart

---

## 📝 Expected Behavior

**Old Code (What you're seeing now)**:
- Click button → Downloads JSON file

**New Code (What you should see)**:
- Click button → Prompt for plan name → Saves to database → Success alert


