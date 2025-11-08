# Phase 4: UI Components & Case Integration

## 🎯 Objectives

Build user interface components for surgical navigation tracking and integrate with case.json files for automatic configuration.

---

## 📋 Tasks

### 1. **Tracking Control Panel** ✅
- [ ] Create TrackingPanel component
- [ ] Start/Stop navigation controls
- [ ] Connection status indicator
- [ ] Real-time position display
- [ ] Tool quality indicators

### 2. **Case Integration** ✅
- [ ] Load rMd transformation from case.json
- [ ] Automatic transformation on case load
- [ ] Case selector UI component
- [ ] Display case metadata

### 3. **Status Display** ✅
- [ ] Connection status (REST + WebSocket)
- [ ] Tracking frequency (100Hz → 25Hz)
- [ ] Coordinate display (register + DICOM)
- [ ] Tool visibility indicators

### 4. **Settings Panel** ✅
- [ ] Configure SyncForge API URL
- [ ] Adjust UI update frequency
- [ ] Enable/disable coordinate logging
- [ ] Transformation matrix editor

### 5. **Visual Feedback** ✅
- [ ] Color-coded status indicators
- [ ] Animated connection indicators
- [ ] Position change indicators
- [ ] Error/warning notifications

---

## 🏗️ Components Architecture

```
TrackingPanel (Main Panel)
├── ConnectionStatus
│   ├── API Status (REST)
│   ├── WebSocket Status
│   └── Frequency Display
├── ControlButtons
│   ├── Start Navigation
│   ├── Stop Navigation
│   └── Settings
├── PositionDisplay
│   ├── Register Coordinates
│   ├── DICOM Coordinates
│   └── Tool Quality
└── CaseSelector
    ├── Load Case
    ├── Display rMd
    └── Case Metadata
```

---

## 📁 File Structure

```
extensions/default/src/
├── Panels/
│   └── TrackingPanel/
│       ├── TrackingPanel.tsx          ← Main panel component
│       ├── ConnectionStatus.tsx        ← Status indicators
│       ├── ControlButtons.tsx          ← Start/Stop/Settings
│       ├── PositionDisplay.tsx         ← Coordinate display
│       ├── CaseSelector.tsx            ← Case loading UI
│       ├── SettingsModal.tsx           ← Configuration modal
│       └── index.ts                    ← Exports

extensions/default/src/services/
└── CaseLoaderService.ts                ← New: Load case.json files

extensions/cornerstone/src/utils/
└── caseIntegration.ts                  ← Case file handling
```

---

## 🎨 UI Design

### TrackingPanel (Right Sidebar)

```
┌─────────────────────────────────────┐
│  🧭 Surgical Navigation             │
├─────────────────────────────────────┤
│  Connection Status                   │
│  🟢 API:       Connected             │
│  🟢 WebSocket: 100 Hz                │
│  🟢 UI Update: 25 Hz                 │
├─────────────────────────────────────┤
│  Controls                            │
│  [▶ Start Navigation]                │
│  [⏸ Stop Navigation]                 │
│  [⚙ Settings]                        │
├─────────────────────────────────────┤
│  Position (Crosshair Tool)           │
│  Register: [75.2, 0.1, -20.0] mm     │
│  DICOM:    [25.2, 30.1, -30.0] mm    │
│  Quality:  ⭐⭐⭐⭐⭐ (Excellent)       │
├─────────────────────────────────────┤
│  Case                                │
│  📁 L1-L2 Laminectomy               │
│  rMd: Identity ✅                    │
│  [📂 Load Case...]                   │
└─────────────────────────────────────┘
```

---

## 🔧 Implementation Steps

### Step 1: Create TrackingPanel Component

**File:** `extensions/default/src/Panels/TrackingPanel/TrackingPanel.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { useSystem } from '@ohif/core';
import ConnectionStatus from './ConnectionStatus';
import ControlButtons from './ControlButtons';
import PositionDisplay from './PositionDisplay';
import CaseSelector from './CaseSelector';

export default function TrackingPanel() {
  const { servicesManager } = useSystem();
  const { trackingService } = servicesManager.services;

  const [status, setStatus] = useState({
    connected: false,
    navigating: false,
    position: null,
    quality: null
  });

  useEffect(() => {
    // Subscribe to tracking updates
    const subscription = trackingService.subscribe(
      'event::tracking_update',
      (data) => {
        setStatus(prev => ({
          ...prev,
          position: data.position,
          quality: data.quality
        }));
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="tracking-panel">
      <h2>🧭 Surgical Navigation</h2>
      <ConnectionStatus status={status} />
      <ControlButtons
        navigating={status.navigating}
        onStart={() => startNavigation()}
        onStop={() => stopNavigation()}
      />
      <PositionDisplay position={status.position} quality={status.quality} />
      <CaseSelector />
    </div>
  );
}
```

### Step 2: Register Panel in Extension

**File:** `extensions/default/src/getPanelModule.js`

Add TrackingPanel to the panel module:

```javascript
import TrackingPanel from './Panels/TrackingPanel';

// In getPanelModule function:
{
  name: 'trackingPanel',
  iconName: 'navigation',
  iconLabel: 'Tracking',
  label: 'Surgical Navigation',
  component: TrackingPanel,
},
```

### Step 3: Create CaseLoaderService

**File:** `extensions/default/src/services/CaseLoaderService.ts`

```typescript
export default class CaseLoaderService {
  public static REGISTRATION = {
    name: 'caseLoaderService',
    create: ({ servicesManager }) => {
      return new CaseLoaderService(servicesManager);
    },
  };

  async loadCase(caseId: string) {
    // Fetch case.json from SyncForge API
    const response = await fetch(
      `http://localhost:3001/api/cases/${caseId}`
    );
    const caseData = await response.json();

    // Extract rMd transformation
    const rMd = caseData.dicom_series?.fixed_image?.rMd?.matrix;

    return {
      caseData,
      rMd,
      metadata: {
        studyInstanceUID: caseData.dicom_series.fixed_image.StudyInstanceUID,
        seriesInstanceUID: caseData.dicom_series.fixed_image.SeriesInstanceUID,
      }
    };
  }
}
```

### Step 4: Auto-load Transformation

Add command to load transformation from case:

```javascript
loadCaseTransformation: ({ caseId }) => {
  const { caseLoaderService } = servicesManager.services;

  caseLoaderService.loadCase(caseId).then(({ rMd }) => {
    if (rMd && window.__navigationController) {
      window.__navigationController.loadTransformation(rMd);
      console.log('✅ Transformation loaded from case:', caseId);
    }
  });
}
```

---

## 🎨 Styling

**File:** `extensions/default/src/Panels/TrackingPanel/TrackingPanel.css`

```css
.tracking-panel {
  padding: 16px;
  background: #1a1a1a;
  color: #ffffff;
  height: 100%;
  overflow-y: auto;
}

.tracking-panel h2 {
  font-size: 18px;
  margin-bottom: 16px;
  border-bottom: 1px solid #333;
  padding-bottom: 8px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.status-dot.connected {
  background: #4ade80;
}

.status-dot.disconnected {
  background: #f87171;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.control-button {
  width: 100%;
  padding: 12px;
  margin: 8px 0;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.control-button.primary {
  background: #3b82f6;
  color: white;
}

.control-button.primary:hover {
  background: #2563eb;
}

.position-display {
  background: #2a2a2a;
  padding: 12px;
  border-radius: 6px;
  margin: 12px 0;
  font-family: monospace;
}

.position-row {
  display: flex;
  justify-content: space-between;
  margin: 4px 0;
}
```

---

## 🔗 Integration with Mode

Update mode configuration to include TrackingPanel:

**File:** `modes/basic/src/index.tsx`

```javascript
const defaultPanels = {
  right: [
    'studyBrowser',
    'trackingPanel',  // ← Add this
  ],
};
```

---

## 🧪 Testing

### Manual Test Plan

1. **Panel Visibility**
   - [ ] Panel appears in right sidebar
   - [ ] All components render correctly
   - [ ] Styling matches design

2. **Connection Status**
   - [ ] Shows disconnected initially
   - [ ] Updates when navigation starts
   - [ ] Shows real-time frequencies

3. **Controls**
   - [ ] Start button initiates navigation
   - [ ] Stop button terminates navigation
   - [ ] Settings opens configuration modal

4. **Position Display**
   - [ ] Shows register coordinates
   - [ ] Shows DICOM coordinates
   - [ ] Updates in real-time (25Hz)

5. **Case Loading**
   - [ ] Can select/load case.json
   - [ ] rMd automatically applied
   - [ ] Case metadata displayed

---

## 📊 Success Criteria

### Phase 4 Complete When:

1. ✅ **TrackingPanel renders** in OHIF right sidebar
2. ✅ **Connection status** displays real-time state
3. ✅ **Start/Stop controls** work reliably
4. ✅ **Position display** shows both coordinate systems
5. ✅ **Case integration** loads rMd automatically
6. ✅ **Settings modal** allows configuration
7. ✅ **Visual feedback** provides clear status

---

## 🚀 Quick Start

### 1. Create Panel Structure

```bash
cd /home/asclepius/github/Viewers/extensions/default/src/Panels
mkdir TrackingPanel
cd TrackingPanel
```

### 2. Create Component Files

```bash
touch TrackingPanel.tsx
touch ConnectionStatus.tsx
touch ControlButtons.tsx
touch PositionDisplay.tsx
touch CaseSelector.tsx
touch SettingsModal.tsx
touch index.ts
touch TrackingPanel.css
```

### 3. Register in Extension

Edit `extensions/default/src/getPanelModule.js` and add TrackingPanel

### 4. Update Mode Config

Edit `modes/basic/src/index.tsx` to include panel in right sidebar

### 5. Test

```bash
yarn run dev
# Navigate to http://localhost:3000
# Open right sidebar → See "Surgical Navigation" panel
```

---

## 📖 API Reference

### TrackingService Events

```typescript
trackingService.subscribe('event::tracking_update', (data) => {
  // data.position - Current position
  // data.quality - Tool quality
  // data.visible - Tool visibility
});

trackingService.subscribe('event::connection_status', (status) => {
  // status.connected - Connection state
  // status.error - Error message if any
});
```

### NavigationController API

```typescript
// Load transformation
window.__navigationController.loadTransformation(rMd);

// Get status
const status = window.__navigationController.getStatus();
// Returns: { navigating, updateCount, targetFPS, actualFPS, transformation }

// Clear transformation
window.__navigationController.clearTransformation();
```

---

## 🔜 Next Steps After Phase 4

### Phase 5: Advanced Features
- 3D tool visualization in viewport
- Tool trajectory display
- Proximity warnings
- Recording/playback functionality

---

**Version:** 1.0
**Status:** Phase 4 Planning Complete
**Ready to implement:** ✅
