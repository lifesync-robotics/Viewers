# Screw Selection Dialog Guide

## Overview
The Screw Selection Dialog provides a comprehensive interface for selecting pedicle screws from the manufacturer catalog or creating custom screws with specific dimensions.

## Features

### 1. **Dual Selection Modes**
- **Custom Screw**: Create screws with user-defined dimensions
- **Catalog Screw**: Select from manufacturer-specific pedicle screw catalog

### 2. **Manufacturer Catalog Integration**
- Connects to Planning API to fetch real-time screw catalog
- Supports manufacturer filtering
- Hierarchical selection: Manufacturer → Screw Type → Variant
- Displays detailed specifications for each screw variant

### 3. **User Experience**
- Clean tabbed interface for mode selection
- Real-time preview of selected screw dimensions
- Comprehensive error handling with retry functionality
- Loading states for better UX

## Usage

### Opening the Dialog
Click the **"🔩 Save Screw Placement"** button in the Screw Management Panel.

### Selecting a Custom Screw

1. Ensure the **"⚙️ Custom Screw"** tab is active (default)
2. Optionally enter a screw name
3. Enter **Radius (mm)** - required, must be > 0
4. Enter **Length (mm)** - required, must be > 0
5. Review the preview showing diameter and length
6. Click **"⚙️ Use Custom Screw"**

**Example:**
- Radius: `2.0` mm → Diameter: `4.0` mm
- Length: `40.0` mm
- Result: Custom screw with ⌀4.0mm × 40.0mm

### Selecting a Catalog Screw

1. Click the **"📦 Catalog Screw"** tab
2. Select a **Manufacturer** from the dropdown
   - Shows number of available variants for each manufacturer
3. Select a **Screw Type**
   - Options update based on selected manufacturer
4. Select **Dimensions** variant
   - Shows diameter, length, material, and specifications
5. Review the detailed specifications panel:
   - Manufacturer and screw type
   - Diameter and length
   - Material (e.g., Titanium Alloy Ti-6Al-4V)
   - Head type
   - Cannulated status with inner diameter
   - Break-off torque
   - Thread pitch
6. Click **"📦 Use Catalog Screw"**

## API Integration

### Endpoint
```
GET http://localhost:3001/api/planning/catalog/screws?manufacturer={manufacturer}
```

### Query Parameters
- `manufacturer` (optional): Filter catalog by manufacturer name

### Response Structure
```typescript
{
  success: boolean,
  manufacturers: [
    {
      id: string,
      name: string,
      screw_types: [
        {
          id: string,
          name: string,
          variants: [
            {
              id: string,
              diameter: number,
              length: number,
              material: string,
              thread_pitch: number,
              head_type: string,
              tulip_diameter: number,
              obj_file_path: string,
              specifications: {
                break_off_torque: number,
                cannulated: boolean,
                inner_diameter: number,
                compatible_rod_diameters: number[]
              }
            }
          ]
        }
      ]
    }
  ],
  total_variants: number
}
```

## Component Architecture

### ScrewSelectionDialog Component

**Props:**
```typescript
interface ScrewSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectScrew: (screwData: {
    name: string;
    radius: number;
    length: number;
    source: 'custom' | 'catalog';
    variantId?: string;
    manufacturer?: string;
    screwType?: string;
  }) => void;
}
```

**State Management:**
- Selection mode (custom/catalog)
- Custom screw dimensions (name, radius, length)
- Catalog selection (manufacturer, screw type, variant)
- Loading states and error handling

### Integration with ScrewManagementPanel

The dialog integrates seamlessly with the main panel:

1. **Opening**: Click "Save Screw Placement" button
2. **Selection**: User selects screw (custom or catalog)
3. **Callback**: `onSelectScrew` is called with screw data
4. **Saving**: Panel's `saveScrew` function handles:
   - Transform matrix construction
   - API request to save screw
   - 3D model loading
   - UI update

## Screw Variant ID

### Custom Screws
Format: `generated-{radius}-{length}`
- Example: `generated-2.0-40.0`

### Catalog Screws
Uses the variant ID from the catalog:
- Example: `medtronic-cdh-4.5-40`
- Format: `{vendor}-{model}-{diameter}-{length}`

This allows the system to:
- Track screw source (custom vs. catalog)
- Query correct 3D models
- Display appropriate metadata

## Error Handling

### Connection Errors
- Shows error message with retry button
- Falls back gracefully if catalog unavailable
- User can still create custom screws

### Validation Errors
- Alerts user for invalid dimensions
- Requires positive numbers > 0
- Prevents submission until valid

### Loading States
- Shows spinner during catalog fetch
- Disables controls during loading
- Provides visual feedback

## UI/UX Features

### Visual Indicators
- **🔩** - Screw icon
- **⚙️** - Custom screw indicator
- **📦** - Catalog screw indicator
- **🔘** - Cannulated feature
- **🔧** - Torque specification
- **📏** - Thread pitch specification

### Color Coding
- **Blue**: Custom screw mode
- **Green**: Catalog screw mode
- **Red**: Errors and required fields
- **Gray**: Disabled states

### Badges
Screws display informative badges:
- **Catalog**: Blue badge with "📦 Catalog"
- **Custom**: Purple badge with "⚙️ Custom"
- **Specifications**: Various colored badges for features

## Developer Notes

### Adding New Manufacturers
1. Update backend catalog service
2. No frontend changes needed - dropdown auto-populates

### Custom Validation
Located in `handleSelectCustom()`:
```typescript
const radius = parseFloat(customRadius);
const length = parseFloat(customLength);

if (isNaN(radius) || isNaN(length) || radius <= 0 || length <= 0) {
  // Show error
}
```

### Extending Specifications
To add new specifications:
1. Update `ScrewVariant` interface
2. Add display in details panel
3. Update backend catalog schema

## Testing Checklist

- [ ] Open dialog from Save Screw Placement button
- [ ] Create custom screw with valid dimensions
- [ ] Create custom screw with invalid dimensions (should show error)
- [ ] Load catalog without manufacturer filter
- [ ] Select manufacturer and verify screw types update
- [ ] Select screw type and verify variants update
- [ ] Select variant and verify details panel
- [ ] View cannulated screw specifications
- [ ] Use custom screw and verify save
- [ ] Use catalog screw and verify save
- [ ] Test with Planning API offline (should show error)
- [ ] Test retry button on error
- [ ] Close dialog without selecting
- [ ] Verify screws appear in list after selection

## Future Enhancements

### Potential Improvements
1. **Search/Filter**: Add search within catalog
2. **Favorites**: Save commonly used screws
3. **Recent**: Show recently used screws
4. **Comparison**: Compare multiple variants side-by-side
5. **3D Preview**: Show screw 3D model in dialog
6. **Bulk Add**: Select multiple screws at once
7. **Templates**: Save screw configurations as templates
8. **Validation**: Check compatibility with existing screws
9. **Suggestions**: AI-powered screw recommendations based on anatomy

### Performance Optimizations
1. Cache catalog data locally
2. Lazy load manufacturer data
3. Virtual scrolling for large catalogs
4. Debounced search inputs

## Troubleshooting

### Catalog Not Loading
**Problem**: Dropdown shows no manufacturers
**Solutions**:
1. Check Planning API is running on port 3001
2. Check Planning Service is running on port 6000
3. Verify network connectivity
4. Check browser console for errors

### Invalid Dimensions Error
**Problem**: Can't submit custom screw
**Solutions**:
1. Ensure radius and length are positive numbers
2. Check for typos in number fields
3. Verify values are > 0

### Screw Not Appearing After Save
**Problem**: Selected screw doesn't show in list
**Solutions**:
1. Check browser console for errors
2. Verify session is active
3. Check crosshairs are positioned
4. Retry with different screw

## Related Files
- `ScrewSelectionDialog.tsx` - Main dialog component
- `ScrewManagementPanel.tsx` - Parent component
- `ScrewManagementUI.tsx` - UI components
- `planningController.js` - Backend API controller
- `planningBridge.js` - gRPC bridge
- `planning_server.py` - Planning service

## API Flow

```
User Action
    ↓
Open Dialog
    ↓
Load Catalog
    ↓
GET /api/planning/catalog/screws?manufacturer={mfr}
    ↓
Express API (planningController.js)
    ↓
gRPC Bridge (planningBridge.js)
    ↓
Planning Service (planning_server.py)
    ↓
GetScrewCatalog RPC
    ↓
Return Catalog Data
    ↓
Populate Dropdowns
    ↓
User Selects Screw
    ↓
onSelectScrew Callback
    ↓
saveScrew in Panel
    ↓
POST /api/planning/screws/add-with-transform
    ↓
Save to Database
    ↓
Load 3D Model
    ↓
Update UI
```
