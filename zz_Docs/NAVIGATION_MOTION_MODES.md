# 🎯 Navigation Motion Modes Guide

## 📋 **Available Motion Modes**

The navigation system supports **5 different motion patterns**:

| Mode | Description | Movement | Use Case |
|------|-------------|----------|----------|
| `circular` | Circular in axial plane | Orbits around center (X-Y plane) | Default, good for testing |
| `linear` | **Linear axial** | Up/Down (Z axis) | Simulates moving through slices |
| `linear_sagittal` | Linear sagittal | Left/Right (X axis) | Lateral scanning |
| `linear_coronal` | Linear coronal | Front/Back (Y axis) | Anterior-posterior scanning |
| `random` | Random walk | Random 3D jitter | Simulates hand tremor |

---

## 🎯 **How to Use Linear Axial Mode** (Your Request!)

### **Method 1: Using OHIF UI (Easiest)**

```bash
1. Refresh OHIF: Ctrl + Shift + R

2. Open browser console (F12)

3. Run this command:
   commandsManager.runCommand('startNavigation', { mode: 'linear' });

4. Watch viewport move UP and DOWN along axial (Z) axis! ✅
```

### **Method 2: Using Browser Console**

```javascript
// In OHIF browser console (F12):

// Start linear axial motion
commandsManager.runCommand('startNavigation', { mode: 'linear' });

// Stop navigation
commandsManager.runCommand('stopNavigation');
```

### **Method 3: Modify Toolbar Button Default**

Edit `/home/asclepius/github/Viewers/modes/basic/src/toolbarButtons.ts`:

```typescript
{
  id: 'RealTimeNavigation',
  uiType: 'ohif.toolButton',
  props: {
    icon: 'Navigation',
    label: i18n.t('Buttons:Real-time Navigation'),
    tooltip: i18n.t('Buttons:Enable real-time navigation with tracking'),
    commands: [
      {
        commandName: 'toggleNavigation',
        commandOptions: { mode: 'linear' },  // ← Change from 'circular' to 'linear'
      }
    ],
    evaluate: 'evaluate.action',
  },
},
```

---

## 🧭 **All Motion Modes in Detail**

### **1. Circular Motion** (Default)

```javascript
commandsManager.runCommand('startNavigation', { mode: 'circular' });
```

**Motion:**
```
Center: [102.4, 102.4, 70.0]
Radius: 50mm
x = center[0] + 50 * cos(θ)  → moves in circle
y = center[1] + 50 * sin(θ)  → moves in circle
z = center[2] + 20 * sin(t)  → slight vertical oscillation
```

**Visual:**
```
     ↑ Y
     |
  ●--●--●
  |  C  |  ← Circular motion around center C
  ●--●--●
     |
     └─────→ X
```

---

### **2. Linear Axial** (Z axis - Up/Down) ⭐ **YOUR REQUEST**

```javascript
commandsManager.runCommand('startNavigation', { mode: 'linear' });
```

**Motion:**
```
Range: ±50mm along Z axis
x = center[0]           → stays constant
y = center[1]           → stays constant
z = center[2] + 50*sin(t)  → oscillates up/down
```

**Visual:**
```
    ↑ Z (Superior)
    |
    ● ← Position oscillates
    |
    C ← Center
    |
    ●
    |
    ↓ (Inferior)
```

**Medical Imaging Context:**
- Simulates moving **through slices** in axial view
- Like scrolling up/down through CT/MRI slices
- Good for testing MPR synchronization

---

### **3. Linear Sagittal** (X axis - Left/Right)

```javascript
commandsManager.runCommand('startNavigation', { mode: 'linear_sagittal' });
```

**Motion:**
```
Range: ±50mm along X axis
x = center[0] + 50*sin(t)  → oscillates left/right
y = center[1]           → stays constant
z = center[2]           → stays constant
```

**Visual:**
```
    Left ←─────●─────C─────●─────→ Right
                    (X axis)
```

---

### **4. Linear Coronal** (Y axis - Front/Back)

```javascript
commandsManager.runCommand('startNavigation', { mode: 'linear_coronal' });
```

**Motion:**
```
Range: ±50mm along Y axis
x = center[0]           → stays constant
y = center[1] + 50*sin(t)  → oscillates anterior/posterior
z = center[2]           → stays constant
```

**Visual:**
```
    Posterior ←─────●─────C─────●─────→ Anterior
                         (Y axis)
```

---

### **5. Random Walk** (3D Random Motion)

```javascript
commandsManager.runCommand('startNavigation', { mode: 'random' });
```

**Motion:**
```
Random movements in all directions:
dx = random(-2, 2) mm
dy = random(-2, 2) mm
dz = random(-1, 1) mm
```

**Use Case:** Simulates hand tremor or jittery surgical tool motion

---

## ⚙️ **Customizing Motion Parameters**

### **Adjust Range/Speed in Python Server:**

Edit `/home/asclepius/github/Viewers/tracking_server.py`:

```python
def get_linear_path(self):
    """Simulate linear motion along axial (Z) axis"""
    x = self.center[0]
    y = self.center[1]
    z = self.center[2] + math.sin(self.t * 0.5) * 50  # ← Change parameters
    #                                    ↑        ↑
    #                                  Speed   Range (mm)
```

**Parameters:**
- **Speed:** `self.t * 0.5` → higher = faster (e.g., `0.8` for faster)
- **Range:** `* 50` → amplitude in mm (e.g., `* 100` for ±100mm range)

**Examples:**
```python
# Slow, small range (±20mm)
z = self.center[2] + math.sin(self.t * 0.3) * 20

# Fast, large range (±100mm)
z = self.center[2] + math.sin(self.t * 0.8) * 100

# Constant velocity (not oscillating)
z = self.center[2] + (self.t * 2) % 100  # Linear sweep 0-100mm
```

---

## 🧪 **Testing Different Modes**

### **Quick Test Script:**

```javascript
// In OHIF browser console (F12):

console.clear();

// Test each mode for 10 seconds
const modes = ['circular', 'linear', 'linear_sagittal', 'linear_coronal'];
let index = 0;

function testNextMode() {
  if (index >= modes.length) {
    console.log('✅ All modes tested!');
    commandsManager.runCommand('stopNavigation');
    return;
  }

  const mode = modes[index];
  console.log(`\n🧪 Testing mode: ${mode}`);
  console.log('   Watch viewport for 10 seconds...\n');

  commandsManager.runCommand('stopNavigation');
  setTimeout(() => {
    commandsManager.runCommand('startNavigation', { mode: mode });
    setTimeout(() => {
      index++;
      testNextMode();
    }, 10000);
  }, 500);
}

testNextMode();
```

---

## 🎯 **For Your Linear Axial Use Case:**

### **Quick Start:**

1. **Set your center position:**
   ```javascript
   // Move crosshair to desired position, then:
   commandsManager.runCommand('setTrackingCenter');
   ```

2. **Start linear axial motion:**
   ```javascript
   commandsManager.runCommand('startNavigation', { mode: 'linear' });
   ```

3. **Expected behavior:**
   - Viewport stays centered at X, Y coordinates
   - Moves **up and down** along Z axis (axial direction)
   - Range: ±50mm from center
   - Speed: ~0.5 Hz oscillation

4. **Watch in console:**
   ```
   🔄 Update #20 (19.8 Hz) → [102.4, 102.4, 95.3]  ← Z increasing
   🔄 Update #40 (19.9 Hz) → [102.4, 102.4, 70.0]  ← Z at center
   🔄 Update #60 (20.0 Hz) → [102.4, 102.4, 44.7]  ← Z decreasing
   ```

---

## 📊 **Coordinate System Reference**

| Axis | Direction | Medical Term | Range (typical) |
|------|-----------|--------------|-----------------|
| **X** | Left ← → Right | Lateral/Sagittal | ±50mm |
| **Y** | Posterior ← → Anterior | Coronal | ±50mm |
| **Z** | Inferior ← → Superior | **Axial** | ±50mm |

**RAS Coordinate System:**
- **R**ight (+X)
- **A**nterior (+Y)
- **S**uperior (+Z)

---

## 🔄 **Switching Modes During Navigation:**

You can change modes without stopping:

```javascript
// Currently running circular
commandsManager.runCommand('startNavigation', { mode: 'circular' });

// Wait 5 seconds, then switch to linear
setTimeout(() => {
  commandsManager.runCommand('stopNavigation');
  commandsManager.runCommand('startNavigation', { mode: 'linear' });
}, 5000);
```

**Or via Python WebSocket:**

```python
# Send WebSocket command to change mode:
{
  "command": "set_mode",
  "mode": "linear"
}
```

---

## 🛠️ **Troubleshooting**

### **Mode not changing?**

```javascript
// Stop completely, then restart
commandsManager.runCommand('stopNavigation');
setTimeout(() => {
  commandsManager.runCommand('startNavigation', { mode: 'linear' });
}, 500);
```

### **Motion too fast/slow?**

Edit `tracking_server.py`:
```python
# Line ~60
z = self.center[2] + math.sin(self.t * SPEED) * RANGE
#                                      ↑         ↑
#                                   0.5 → 0.3  50 → 30
```

Then restart server:
```bash
pkill -f tracking_server.py
python3 tracking_server.py &
```

---

## ✅ **Summary**

| Your Goal | Solution |
|-----------|----------|
| **Linear axial motion** | ✅ Use `mode: 'linear'` |
| **Up/Down movement** | ✅ Z axis (axial) oscillation |
| **±50mm range** | ✅ Configured by default |
| **~20Hz updates** | ✅ Automatic |
| **Switch modes** | ✅ Just change `mode` parameter |

---

**🚀 Try it now:**

```javascript
// In OHIF console:
commandsManager.runCommand('startNavigation', { mode: 'linear' });
```

**Watch your viewport move up and down through the axial slices!** 🎯
