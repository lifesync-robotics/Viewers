# Screw Selection Dialog Updates

## Changes Made

### 1. **Common Name Field** (Moved to Top)
The screw name input field has been moved from the custom screw section to a common section at the top of the dialog, above the mode selection tabs.

**Location:** Between the header and the tabs

**Benefits:**
- ✅ Available for both custom and catalog screw selections
- ✅ More intuitive user experience
- ✅ Users can name any screw regardless of source
- ✅ Optional field with helpful placeholder text

**UI Structure:**
```
┌─────────────────────────────────────┐
│ 🔩 Pedicle Screw Selection       × │
├─────────────────────────────────────┤
│ Screw Name (optional)               │
│ [Input field]                       │
│ 💡 Hint text                        │
├─────────────────────────────────────┤
│ ⚙️ Custom Screw | 📦 Catalog Screw │
├─────────────────────────────────────┤
│ [Content based on selected tab]    │
└─────────────────────────────────────┘
```

### 2. **Default Values for Custom Screw**
Added default values to make custom screw creation faster.

**Defaults:**
- **Radius:** `3.5 mm` (Diameter: 7.0 mm)
- **Length:** `40 mm`

**Behavior:**
- Fields are pre-populated when dialog opens
- Users can modify values as needed
- Values reset to defaults when dialog closes
- Common dimensions for pedicle screws

### 3. **Updated Logic**

#### State Management
**Before:**
```typescript
const [customName, setCustomName] = useState('');
const [customRadius, setCustomRadius] = useState('');
const [customLength, setCustomLength] = useState('');
```

**After:**
```typescript
// Common name (used by both modes)
const [screwName, setScrewName] = useState('');

// Custom dimensions with defaults
const [customRadius, setCustomRadius] = useState('3.5');
const [customLength, setCustomLength] = useState('40');
```

#### Reset Form Function
**Before:**
```typescript
const resetForm = () => {
  setCustomName('');
  setCustomRadius('');
  setCustomLength('');
  setSelectedManufacturer('');
  setSelectedScrewType('');
  setSelectedVariant('');
};
```

**After:**
```typescript
const resetForm = () => {
  setScrewName('');
  setCustomRadius('3.5');  // Reset to default
  setCustomLength('40');   // Reset to default
  setSelectedManufacturer('');
  setSelectedScrewType('');
  setSelectedVariant('');
};
```

#### Name Handling
Both `handleSelectCustom()` and `handleSelectCatalog()` now use the common `screwName` field:

**Custom Screw:**
```typescript
const name = screwName.trim() || `Custom ${radius * 2}mm × ${length}mm`;
```

**Catalog Screw:**
```typescript
const defaultName = `${manufacturer} ${screwType} ⌀${diameter}mm × ${length}mm`;
const name = screwName.trim() || defaultName;
```

## User Experience Improvements

### Before
1. Open dialog
2. Switch to Custom or Catalog tab
3. If Custom: Enter name, radius, length
4. If Catalog: Select from dropdowns (no name option)
5. Submit

### After
1. Open dialog
2. **Optionally** enter custom name at top (works for both modes)
3. Switch to Custom or Catalog tab
4. If Custom: Modify pre-filled radius (3.5mm) and length (40mm) if needed
5. If Catalog: Select from dropdowns
6. Submit

### Key Benefits
✅ **Faster workflow**: Default values reduce typing
✅ **Consistent naming**: Same field for both modes
✅ **More flexible**: Can name catalog screws
✅ **Better UX**: Common fields at top, specific fields below

## Usage Examples

### Example 1: Quick Custom Screw (Using Defaults)
1. Click "🔩 Save Screw Placement"
2. Type name: "L3 Right"
3. Tab: Custom Screw (default values already filled: 3.5mm, 40mm)
4. Click "⚙️ Use Custom Screw"
5. ✅ Result: "L3 Right" screw with ⌀7.0mm × 40mm

### Example 2: Custom Screw with Modified Dimensions
1. Click "🔩 Save Screw Placement"
2. Type name: "L4 Left"
3. Tab: Custom Screw
4. Change radius: 3.5 → 2.5mm
5. Change length: 40 → 35mm
6. Click "⚙️ Use Custom Screw"
7. ✅ Result: "L4 Left" screw with ⌀5.0mm × 35mm

### Example 3: Catalog Screw with Custom Name
1. Click "🔩 Save Screw Placement"
2. Type name: "L5 Right Primary"
3. Tab: Catalog Screw
4. Select: Medtronic → CD Horizon → ⌀5.5mm × 45mm
5. Click "📦 Use Catalog Screw"
6. ✅ Result: "L5 Right Primary" (custom name) with catalog screw specifications

### Example 4: Catalog Screw with Auto-Generated Name
1. Click "🔩 Save Screw Placement"
2. Leave name field empty
3. Tab: Catalog Screw
4. Select: Medtronic → CD Horizon → ⌀5.5mm × 45mm
5. Click "📦 Use Catalog Screw"
6. ✅ Result: "Medtronic CD Horizon ⌀5.5mm × 45mm" (auto-generated)

## Technical Details

### Default Value Rationale
**Radius: 3.5mm (Diameter: 7.0mm)**
- Common size for pedicle screws in lumbar spine
- Middle ground between small (4.5mm) and large (8.5mm) screws
- Suitable for most adult patients

**Length: 40mm**
- Standard length for lumbar pedicle screws
- Appropriate for typical vertebral body depth
- Commonly available in most screw systems

### Validation
No changes to validation logic:
- Radius must be > 0
- Length must be > 0
- Both must be valid numbers
- Name remains optional

### Auto-Generated Names
If name field is empty, defaults are still generated:

**Custom Screw:**
- Format: `Custom {diameter}mm × {length}mm`
- Example: `Custom 7.0mm × 40mm`

**Catalog Screw:**
- Format: `{manufacturer} {screwType} ⌀{diameter}mm × {length}mm`
- Example: `Medtronic CD Horizon ⌀5.5mm × 45mm`

## Testing Checklist

- [x] Name field appears at top above tabs
- [x] Name field works with custom screws
- [x] Name field works with catalog screws
- [x] Default radius shows 3.5mm on open
- [x] Default length shows 40mm on open
- [x] Can modify default values
- [x] Defaults reset after dialog closes
- [x] Auto-generated names work when field empty
- [x] Custom names override auto-generated names
- [x] No TypeScript errors
- [x] No linter errors

## Migration Notes

**No Breaking Changes:**
- All existing functionality preserved
- Backward compatible with existing screws
- No changes to save/load logic
- No database schema changes required

**User Impact:**
- Positive: Faster workflow with defaults
- Positive: Can now name catalog screws
- Neutral: No retraining needed
- Neutral: Old behavior available (can clear defaults)

## Related Files
- `ScrewSelectionDialog.tsx` - Main dialog component (updated)
- `ScrewManagementPanel.tsx` - Parent component (no changes needed)
- `ScrewManagementUI.tsx` - UI components (no changes needed)

## Version History
- **v1.0**: Initial screw selection dialog
- **v1.1**: Added common name field and default values ✅ (Current)
