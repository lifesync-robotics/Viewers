# 🔍 Where is the Real-time Navigation Button?

## Location

The **"Real-time Navigation"** button is in the **PRIMARY TOOLBAR** (top toolbar, main viewer area).

```
┌─────────────────────────────────────────────────────────────────────┐
│  OHIF Viewer                                           [×]           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  [📏] [🔍] [✋] [🔄] [🎨] [📸] [📤] [🧭] [📐] [✏️] [⋮]        │  │
│  │   ^     ^    ^    ^    ^    ^    ^    ^    ^    ^   ^         │  │
│  │   │     │    │    │    │    │    │    │    │    │   │         │  │
│  │   │     │    │    │    │    │    │    └─── REAL-TIME          │  │
│  │   │     │    │    │    │    │    │         NAVIGATION          │  │
│  │   │     │    │    │    │    │    │         BUTTON ✨           │  │
│  │   │     │    │    │    │    │    │                             │  │
│  │   │     │    │    │    │    │    └──── Model Upload            │  │
│  │   │     │    │    │    │    └───────── Capture                 │  │
│  │   │     │    │    │    └────────────── Window Level            │  │
│  │   │     │    │    └─────────────────── Trackball Rotate        │  │
│  │   │     │    └──────────────────────── Pan                     │  │
│  │   │     └───────────────────────────── Zoom                    │  │
│  │   └─────────────────────────────────── Measurement Tools       │  │
│  │                                                                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                               │   │
│  │                    VIEWPORT AREA                              │   │
│  │                                                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Button Details

- **Icon:** 🧭 Navigation icon (compass-like)
- **Label:** "Real-time Navigation"
- **Tooltip:** "Enable real-time surgical navigation with tracking (20Hz)"
- **Position:** Between "Model Upload" and "Layout" buttons

## Step-by-Step to Find It

### 1. Open OHIF
```
http://localhost:3000
```

### 2. Load a Study
- Load any study from Orthanc
- Or use: `http://localhost:3000/?StudyInstanceUIDs=<study-id>`

### 3. Look at Top Toolbar
The button should be visible in the main toolbar, look for:
- 📤 **Upload** button (Model Upload)
- 🧭 **Navigation** button ← **THIS IS IT!**
- 📐 **Layout** button

### 4. Click It!
- Click once to **start navigation**
- Click again to **stop navigation**

## If You Still Don't See It

### Check 1: Is OHIF Fully Loaded?
Wait for the study to fully load. The toolbar might not be fully rendered until a study is loaded.

### Check 2: Browser Console
Open browser console (F12) and check for errors:
```javascript
// Check if the button is registered
const { toolbarService } = servicesManager.services;
console.log(toolbarService.getButtons());
// Look for 'RealTimeNavigation' in the list
```

### Check 3: Mode Configuration
Make sure you're in **Basic Viewer** mode (not a different mode like TMTV or Segmentation).

The button is only configured for the Basic Viewer mode.

### Check 4: Hard Refresh
Try a hard refresh in the browser:
- **Windows/Linux:** `Ctrl + Shift + R`
- **Mac:** `Cmd + Shift + R`

### Check 5: Clear Cache
```javascript
// In browser console
localStorage.clear();
sessionStorage.clear();
location.reload();
```

## Alternative: Use Console Commands

If you can't find the button, you can still use navigation via console:

```javascript
// Open browser console (F12)

// Start navigation
commandsManager.runCommand('startNavigation', { mode: 'circular' });

// Stop navigation
commandsManager.runCommand('stopNavigation');

// Toggle navigation
commandsManager.runCommand('toggleNavigation', { mode: 'circular' });
```

## What Should Happen When You Click It

1. ✅ Browser notification: "Navigation Started"
2. ✅ Console logs: "Starting navigation mode: circular"
3. ✅ Crosshair starts moving automatically
4. ✅ Button stays active/highlighted

## Still Having Issues?

Let me know and I can:
1. Show you the exact toolbar configuration
2. Create a custom hotkey (e.g., Ctrl+N)
3. Add the button to a different location
4. Create a dedicated navigation panel
