# Screw Management - Quick Start Guide

## 🚀 Getting Started

### Accessing the Screw Management Panel

1. **Open OHIF Viewer** with longitudinal mode
2. **Look for the right side panel** (right sidebar)
3. **Click on "Screw Management" tab** (icon: ⚙️)

The panel will appear with:
- **Save Section** (top) - Blue bordered area
- **Screws List** (middle) - Scrollable list of saved screws
- **Info Footer** (bottom) - Quick tips

---

## 📝 Basic Operations

### 1️⃣ Saving a Screw Placement

**Steps:**
1. Position your viewport to the desired screw location
2. (Optional) Load and position a 3D screw model
3. In the Screw Management panel:
   - Enter screw name (optional) - e.g., "L4 Pedicle Screw"
   - **Enter Radius** (required) - e.g., `2.0` mm
   - **Enter Length** (required) - e.g., `40.0` mm
4. Click **"🔩 Save Screw Placement"** button

**Result:**
✅ Screw appears in the list below with:
- 🔩 Icon and name
- Timestamp
- Diameter badge (⌀ 4.0 mm)
- Length badge (↕ 40.0 mm)
- Number of views captured

---

### 2️⃣ Loading a Saved Screw

**Steps:**
1. Find the screw in the list
2. Click the **"🔄 Load"** button

**What happens:**
- ⏳ System clears any existing 3D models
- 🎯 Viewport restores to saved position
- 🔍 System queries model server for matching dimensions
- 📥 3D model loads automatically
- ✅ Screw appears positioned exactly as saved

**Note:** The button shows ⏳ while loading

---

### 3️⃣ Deleting a Screw (Key Feature!)

**Steps:**
1. Find the screw you want to remove
2. Click the **🗑️** button (red delete button)
3. Confirm deletion when prompted

**What happens:**
- ✅ Screw snapshot is removed from the list
- ✅ **Associated 3D model is automatically removed**
- ✅ Viewport state is cleared
- ✅ UI updates to show remaining screws

**Important:** This is the main feature - deleting a screw **ALSO removes its 3D model**!

---

### 4️⃣ Clearing All Screws

**Steps:**
1. Click **"🧹 Clear All"** button (top right)
2. Confirm the action

**Warning:** ⚠️ This removes ALL screws and ALL 3D models. Cannot be undone!

---

## 💾 Import/Export

### Exporting Screws

**Steps:**
1. Click **"📥 Export"** button (top right)
2. A JSON file will download: `screw-placements-YYYY-MM-DD.json`

**Use Cases:**
- Backup your screw placements
- Share with colleagues
- Document surgical plans
- Version control

### Importing Screws

**Steps:**
1. Click **"📤 Import"** button (top right)
2. Select a previously exported JSON file
3. System loads all screws from the file

**Note:** Imported screws with duplicate names will be automatically renamed

---

## 🎨 UI Elements Explained

### Save Section (Blue Border)
```
┌─────────────────────────────────────┐
│ 💾 Save Screw Placement   20/40 slots│
├─────────────────────────────────────┤
│ [Screw name (optional)_____________]│
│                                      │
│ Radius (mm)*    │ Length (mm)*      │
│ [2.0_______]    │ [40.0_______]     │
│                                      │
│     [🔩 Save Screw Placement]        │
│                                      │
│ 💡 Saves current viewport state...  │
└─────────────────────────────────────┘
```

### Screw Card in List
```
┌─────────────────────────────────────┐
│ 🔩 L4 Pedicle Screw                 │
│ 11/11/2025, 3:45:23 PM              │
│                                      │
│ [⌀ 4.0 mm] [↕ 40.0 mm] [3 views]   │
│                          [🔄 Load][🗑️]│
└─────────────────────────────────────┘
```

### Status Indicators

| Badge | Meaning |
|-------|---------|
| ⌀ X.X mm | Screw diameter (2 × radius) |
| ↕ X.X mm | Screw length |
| X views | Number of viewports saved |
| 🔄 Load | Restore this screw |
| 🗑️ | Delete screw AND model |
| ⏳ | Loading in progress |

---

## 🎯 Best Practices

### For Accurate Placements

1. **Use Crosshairs Tool**
   - Activate crosshairs before saving
   - Ensures synchronized position across views

2. **Verify All Views**
   - Check axial, sagittal, coronal views
   - Confirm position in 3D volume view

3. **Name Meaningfully**
   - Use anatomical references: "L4 Left Pedicle"
   - Include side information: "Right T7"
   - Add status if needed: "Option A - Conservative"

4. **Check Dimensions**
   - Double-check radius and length before saving
   - These determine which model is loaded on restore

### For Better Organization

1. **Export Regularly**
   - Create backups after important sessions
   - Export before trying risky placements

2. **Use Consistent Naming**
   - Develop a naming convention
   - Example: `{Level}-{Side}-{Type}` → "L4-Left-Pedicle"

3. **Clean Up Old Screws**
   - Delete unsuccessful attempts
   - Keep list manageable (40 max)

---

## ⚠️ Common Issues & Solutions

### Issue: Save button is disabled
**Solution:** Reached 40 screw limit. Delete old screws first.

### Issue: No model loads when restoring
**Possible causes:**
- Model server not running → Check console logs
- No model matches dimensions → Upload correct model
- Network issue → Check browser console (F12)

### Issue: Screw name already exists
**Solution:** Service automatically adds (1), (2), etc. to make names unique

### Issue: Delete removes wrong model
**Possible cause:** Multiple models loaded with similar names
**Solution:** Use "Clear All" then reload only the screw you want

### Issue: Transform not applied correctly
**Solution:**
1. Delete the problematic screw
2. Reposition the model manually
3. Save a new screw placement

---

## 🔑 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Enter | Save screw (when in name field) |
| Esc | Close confirmation dialogs |

---

## 💡 Pro Tips

1. **Testing Positions**: Save multiple screws with different positions, then compare by loading each one

2. **Trajectory Planning**: Save screws at entry and exit points to visualize full trajectory

3. **Documentation**: Export after final decisions for surgical records

4. **Collaboration**: Share exported JSON files with surgical team for review

5. **Backup Strategy**: Export at end of each planning session

---

## 📱 Mobile/Touch Support

- ✅ Touch-friendly buttons (large tap targets)
- ✅ Scrollable lists
- ✅ Responsive layout
- ⚠️ 3D manipulation works best with mouse/stylus

---

## 🎓 Tutorial Workflow

### Complete Example: Planning L4 Pedicle Screw

1. **Load Patient Images**
   - Load lumbar spine CT scan
   - Verify all views are visible

2. **Navigate to L4**
   - Use scroll/crosshairs to find L4 vertebra
   - Position crosshairs at planned entry point

3. **Load Screw Model**
   - Go to Model Upload panel
   - Select 4.0mm diameter, 40mm length screw
   - Model appears at crosshair location

4. **Adjust Position**
   - Use manipulation tools to angle screw
   - Check trajectory doesn't breach cortex
   - Verify in all three views

5. **Save Placement**
   - Open Screw Management panel
   - Name: "L4 Left Pedicle - Preferred"
   - Radius: 2.0 mm
   - Length: 40.0 mm
   - Click "Save"

6. **Try Alternative**
   - Adjust model to different angle
   - Save as "L4 Left Pedicle - Alternative"

7. **Compare**
   - Load "Preferred" placement
   - Review position
   - Load "Alternative" placement
   - Compare

8. **Finalize**
   - Delete unwanted placement
   - Export final placement
   - Share JSON file with team

---

## 📞 Support

If you encounter issues:
1. Check browser console (F12) for error messages
2. Review `SCREW_MANAGEMENT_EXTENSION.md` for technical details
3. Verify model server is running (see Troubleshooting section)
4. Check network tab for API call failures

---

## 🎉 You're Ready!

You now know how to:
- ✅ Save screw placements with dimensions
- ✅ Load saved screws (viewport + 3D model)
- ✅ **Delete screws (removes model too!)** ← Main feature
- ✅ Export/Import for collaboration
- ✅ Manage up to 40 screws efficiently

Start planning your screw placements with confidence! 🔩
