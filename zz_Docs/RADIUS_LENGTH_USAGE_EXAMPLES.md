# Radius and Length - Usage Examples

## Quick Start Guide

### Example 1: Save Snapshot with Radius and Length (UI)

**Steps:**
1. Open your OHIF viewer
2. Navigate to the Viewport Snapshots panel (usually in left sidebar)
3. Fill in the form:
   ```
   Name: L1L Screw
   Radius (mm): 6.5
   Length (mm): 35.0
   ```
4. Click "💾 Save All Viewports"

**Result:** Snapshot saved with metadata `{ radius: 6.5, length: 35.0 }`

---

### Example 2: Import Python Script JSON

**Scenario:** You ran the Python script and it generated `viewport-snapshots-ohif.json`

**Steps:**
1. Locate the file (usually in `C:\slicer_data\viewport-snapshots-ohif.json`)
2. In OHIF Viewport Snapshots panel, click "📤 Import JSON"
3. Select the `viewport-snapshots-ohif.json` file
4. Wait for success message: "✅ Successfully imported X snapshots"

**Example Python Output:**
```json
[
  [
    "L1L",
    {
      "name": "L1L",
      "timestamp": "2025-11-07T14:30:45.123Z",
      "radius": 6.5,
      "length": 35.0,
      "viewports": [...]
    }
  ],
  [
    "L1R",
    {
      "name": "L1R",
      "timestamp": "2025-11-07T14:30:46.456Z",
      "radius": 7.0,
      "length": 40.0,
      "viewports": [...]
    }
  ]
]
```

**After Import:** You'll see both snapshots with their radius/length values displayed.

---

### Example 3: Programmatic Save (JavaScript)

**Use Case:** Automatically save snapshots from a custom tool

```javascript
// In your custom extension or tool
async function saveScrewSnapshot(screwName, radiusMm, lengthMm) {
  const { viewportStateService } = window.servicesManager.services;

  try {
    const snapshot = viewportStateService.saveSnapshot(
      screwName,
      radiusMm,
      lengthMm
    );

    console.log(`✅ Saved: ${snapshot.name}`);
    console.log(`   Radius: ${snapshot.radius} mm`);
    console.log(`   Length: ${snapshot.length} mm`);
    console.log(`   Viewports: ${snapshot.viewports.length}`);

    return snapshot;
  } catch (error) {
    console.error('Failed to save:', error);
    return null;
  }
}

// Usage
saveScrewSnapshot('L1L Screw', 6.5, 35);
saveScrewSnapshot('L1R Screw', 6.5, 35);
saveScrewSnapshot('L2L Screw', 7.0, 40);
```

---

### Example 4: Batch Import from API

**Use Case:** Load snapshots from a remote server

```javascript
async function importSnapshotsFromServer(serverUrl) {
  const { viewportStateService } = window.servicesManager.services;

  try {
    // Fetch from server
    const response = await fetch(`${serverUrl}/api/snapshots/ohif-format`);
    const jsonData = await response.json();

    // Convert to JSON string
    const jsonString = JSON.stringify(jsonData);

    // Import
    const count = viewportStateService.importFromJSONFile(jsonString);

    console.log(`✅ Imported ${count} snapshots from server`);

    // List all snapshots
    const allSnapshots = viewportStateService.getAllSnapshots();
    allSnapshots.forEach(snap => {
      console.log(`  - ${snap.name}: R=${snap.radius}mm, L=${snap.length}mm`);
    });

    return count;
  } catch (error) {
    console.error('Import failed:', error);
    return 0;
  }
}

// Usage
importSnapshotsFromServer('http://localhost:5000');
```

---

### Example 5: Export and Share

**Use Case:** Export snapshots to share with colleagues

```javascript
function exportSnapshotsToFile() {
  const { viewportStateService } = window.servicesManager.services;

  // Get all snapshots
  const snapshots = viewportStateService.getAllSnapshots();

  if (snapshots.length === 0) {
    alert('No snapshots to export');
    return;
  }

  // Get JSON string
  const jsonString = viewportStateService.exportJSON();

  // Create download
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `my-snapshots-${timestamp}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);

  console.log(`✅ Exported ${snapshots.length} snapshots to ${filename}`);
}

// Usage - can be called from browser console
exportSnapshotsToFile();
```

---

### Example 6: Filter Snapshots by Radius/Length

**Use Case:** Find all snapshots with specific dimensions

```javascript
function findSnapshotsByDimensions(minRadius, maxRadius, minLength, maxLength) {
  const { viewportStateService } = window.servicesManager.services;

  const allSnapshots = viewportStateService.getAllSnapshots();

  const filtered = allSnapshots.filter(snap => {
    const r = snap.radius || 0;
    const l = snap.length || 0;

    return (r >= minRadius && r <= maxRadius) &&
           (l >= minLength && l <= maxLength);
  });

  console.log(`Found ${filtered.length} snapshots matching criteria:`);
  filtered.forEach(snap => {
    console.log(`  - ${snap.name}: R=${snap.radius}mm, L=${snap.length}mm`);
  });

  return filtered;
}

// Usage
// Find snapshots with radius 6-7mm and length 30-40mm
const matches = findSnapshotsByDimensions(6, 7, 30, 40);
```

---

### Example 7: Restore Snapshot and Get Dimensions

**Use Case:** Restore a viewport and check its screw dimensions

```javascript
function restoreAndGetDimensions(snapshotName) {
  const { viewportStateService } = window.servicesManager.services;

  try {
    // Get snapshot first to check dimensions
    const snapshot = viewportStateService.getSnapshot(snapshotName);

    if (!snapshot) {
      console.error(`Snapshot "${snapshotName}" not found`);
      return null;
    }

    // Show dimensions
    console.log(`Restoring: ${snapshot.name}`);
    console.log(`  Radius: ${snapshot.radius} mm`);
    console.log(`  Length: ${snapshot.length} mm`);
    console.log(`  Viewports: ${snapshot.viewports.length}`);
    console.log(`  Saved: ${new Date(snapshot.timestamp).toLocaleString()}`);

    // Restore viewports
    const success = viewportStateService.restoreSnapshot(snapshotName);

    if (success) {
      console.log('✅ Viewport restored successfully');
      return {
        name: snapshot.name,
        radius: snapshot.radius,
        length: snapshot.length,
        timestamp: snapshot.timestamp
      };
    } else {
      console.error('❌ Failed to restore viewport');
      return null;
    }
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
}

// Usage
restoreAndGetDimensions('L1L Screw');
```

---

### Example 8: Python Script Integration

**Scenario:** Update Python script to save custom radius/length

```python
# In your Python script (debug_planner.py)

# Set custom radius and length for specific screws
SCREWRADIUS = {
    'L1L': 6.5,
    'L1R': 6.5,
    'L2L': 7.0,
    'L2R': 7.0,
    'L3L': 7.5,
    'L3R': 7.5,
    # ... more screws
}

SCREWBODYLENGTH = {
    'L1L': 35.0,
    'L1R': 35.0,
    'L2L': 40.0,
    'L2R': 40.0,
    'L3L': 45.0,
    'L3R': 45.0,
    # ... more screws
}

# Save with custom dimensions
haves = ['L1L', 'L1R', 'L2L', 'L2R']
save_screws_to_ohif_format(haves, SCREWRADIUS, SCREWBODYLENGTH)

# Output: viewport-snapshots-ohif.json with radius and length
print("✅ Saved snapshots with custom dimensions")
```

**Then in OHIF:**
1. Import the generated `viewport-snapshots-ohif.json`
2. All screws will have their specific radius and length values

---

### Example 9: Validate Snapshot Data

**Use Case:** Check if snapshots have valid radius/length values

```javascript
function validateSnapshots() {
  const { viewportStateService } = window.servicesManager.services;

  const snapshots = viewportStateService.getAllSnapshots();

  console.log('📊 Snapshot Validation Report');
  console.log('─────────────────────────────');

  let validCount = 0;
  let missingCount = 0;

  snapshots.forEach(snap => {
    const hasRadius = snap.radius && snap.radius > 0;
    const hasLength = snap.length && snap.length > 0;
    const isValid = hasRadius && hasLength;

    if (isValid) {
      validCount++;
      console.log(`✅ ${snap.name}: R=${snap.radius}mm, L=${snap.length}mm`);
    } else {
      missingCount++;
      console.log(`⚠️  ${snap.name}: Missing dimensions`);
      if (!hasRadius) console.log(`    - No radius`);
      if (!hasLength) console.log(`    - No length`);
    }
  });

  console.log('─────────────────────────────');
  console.log(`Total: ${snapshots.length} snapshots`);
  console.log(`Valid: ${validCount} with dimensions`);
  console.log(`Missing: ${missingCount} without dimensions`);

  return { validCount, missingCount, total: snapshots.length };
}

// Usage
validateSnapshots();
```

---

### Example 10: Update Existing Snapshot Dimensions

**Use Case:** You want to change radius/length for an existing snapshot

**Note:** Currently, you need to save a new snapshot with updated values. Here's a helper:

```javascript
async function updateSnapshotDimensions(oldName, newRadius, newLength) {
  const { viewportStateService } = window.servicesManager.services;

  try {
    // Get existing snapshot
    const oldSnapshot = viewportStateService.getSnapshot(oldName);

    if (!oldSnapshot) {
      console.error(`Snapshot "${oldName}" not found`);
      return false;
    }

    // First, restore it
    viewportStateService.restoreSnapshot(oldName);

    // Wait a bit for viewport to update
    await new Promise(resolve => setTimeout(resolve, 500));

    // Save new snapshot with updated dimensions
    const newName = `${oldName} (Updated)`;
    const newSnapshot = viewportStateService.saveSnapshot(
      newName,
      newRadius,
      newLength
    );

    console.log(`✅ Created updated snapshot:`);
    console.log(`   Old: ${oldName} - R=${oldSnapshot.radius}, L=${oldSnapshot.length}`);
    console.log(`   New: ${newName} - R=${newRadius}, L=${newLength}`);

    // Optionally delete old one
    // viewportStateService.deleteSnapshot(oldName);

    return true;
  } catch (error) {
    console.error('Update failed:', error);
    return false;
  }
}

// Usage
updateSnapshotDimensions('L1L Screw', 7.0, 40.0);
```

---

## Common Workflows

### Workflow 1: Clinical Planning Session

1. **Load Patient Data** → DICOM images loaded
2. **Python Script** → Generate screw trajectories
3. **Export Snapshots** → `save_screws_to_ohif_format()` creates JSON
4. **Import to OHIF** → Load `viewport-snapshots-ohif.json`
5. **Review** → Restore each snapshot to review trajectory
6. **Dimensions** → Verify radius/length match surgical plan

### Workflow 2: Teaching/Training

1. **Save Examples** → Create snapshots of good/bad placements
2. **Add Metadata** → Include radius/length for reference
3. **Export** → Share JSON file with students
4. **Import** → Students load examples in their viewer
5. **Compare** → Restore snapshots to compare approaches

### Workflow 3: Research Study

1. **Collect Data** → Save snapshots for each case
2. **Export All** → Generate comprehensive JSON file
3. **Analyze** → Parse JSON to extract radius/length statistics
4. **Report** → Include dimensions in research findings

---

## Tips and Tricks

### 💡 Tip 1: Quick Console Access
Open browser console (F12) and access service directly:
```javascript
const vss = window.servicesManager.services.viewportStateService;
vss.getAllSnapshots().forEach(s => console.log(s.name, s.radius, s.length));
```

### 💡 Tip 2: Keyboard Shortcuts
When entering dimensions, press Enter to save immediately (works in Name field).

### 💡 Tip 3: Default Values
If radius/length are 0 or not specified, they won't show badges - this is by design for backward compatibility.

### 💡 Tip 4: Bulk Operations
Use JavaScript console to process multiple snapshots at once (see examples above).

### 💡 Tip 5: File Management
Name your exported JSON files descriptively:
- `patient-123-screws-2025-11-07.json`
- `study-cohort-a-snapshots.json`
- `teaching-examples-lumbar.json`

---

## Troubleshooting Examples

### Issue: Import Shows 0 Snapshots

**Check the JSON structure:**
```javascript
// Load and inspect JSON
fetch('/path/to/file.json')
  .then(r => r.json())
  .then(data => {
    console.log('JSON structure:', data);
    console.log('Is array?', Array.isArray(data));
    console.log('First item:', data[0]);
  });
```

### Issue: Dimensions Not Displaying

**Verify snapshot data:**
```javascript
const snap = viewportStateService.getSnapshot('Your Snapshot Name');
console.log('Radius:', snap.radius, typeof snap.radius);
console.log('Length:', snap.length, typeof snap.length);
console.log('Should show?', (snap.radius > 0 || snap.length > 0));
```

---

## Additional Resources

- Main documentation: `RADIUS_LENGTH_IMPLEMENTATION_SUMMARY.md`
- ViewportStateService API: `extensions/cornerstone/src/viewportStateService.ts`
- UI Component: `extensions/cornerstone/src/viewportStatePanel.tsx`
- Python Script: `slicer/planner/deployment/debug_planner.py`

---

**Last Updated:** November 7, 2025
