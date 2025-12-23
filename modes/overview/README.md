# Overview Mode - 4x4 Grid Display

## Introduction

The Overview Mode displays medical imaging series in a **4x4 grid layout** showing 16 evenly-spaced frames from the entire series. This provides a comprehensive overview of the study at a glance, making it ideal for:

- Quick series review
- Identifying key anatomical regions
- Spotting anomalies across the full scan range
- Initial case assessment

![Overview Mode](https://via.placeholder.com/800x600?text=4x4+Grid+Overview)

## Features

### ✅ Standard OHIF Features
- **Measurement Tracking**: Draw annotations and track measurements
- **Thumbnail List**: Navigate between series
- **Tracked Measurements Panel**: View and manage measurements
- **DICOM SR Support**: Import/export structured reports

### 🎯 Overview-Specific Features
- **4x4 Grid Layout**: 16 viewports arranged in a grid
- **Evenly-Spaced Sampling**: Frames are distributed across the entire series
- **Synchronized Tools**: All viewports share the same tool group
- **Quick Navigation**: Click any frame to focus on that region

## Layout

```
┌─────┬─────┬─────┬─────┐
│  1  │  2  │  3  │  4  │  ← First quarter of series
├─────┼─────┼─────┼─────┤
│  5  │  6  │  7  │  8  │  ← Second quarter
├─────┼─────┼─────┼─────┤
│  9  │ 10  │ 11  │ 12  │  ← Third quarter
├─────┼─────┼─────┼─────┤
│ 13  │ 14  │ 15  │ 16  │  ← Fourth quarter
└─────┴─────┴─────┴─────┘
```

### Panel Layout
- **Left Panel**: Series thumbnail list
- **Center**: 4x4 viewport grid
- **Right Panel**: Tracked measurements

## Frame Distribution

For a series with `N` frames, the 16 viewports display:
- **Frame 1**: `0` (First frame)
- **Frame 2**: `N × 1/15`
- **Frame 3**: `N × 2/15`
- ...
- **Frame 15**: `N × 14/15`
- **Frame 16**: `N - 1` (Last frame)

This ensures even sampling across the entire series regardless of total frame count.

## Usage

### Accessing Overview Mode

1. Open a study in the OHIF Viewer
2. Select **"Overview 4x4 Grid"** from the mode selector
3. The series will automatically display in the 4x4 grid

### Tools Available

- **Window/Level**: Adjust image brightness and contrast
- **Zoom**: Zoom in/out on all viewports
- **Pan**: Pan around images
- **Measurement Tools**: Length, Bidirectional, Ellipse, etc.
- **Annotation Tools**: Arrow, Freehand, etc.

### Workflow

1. **Initial Review**: Scan all 16 frames to get series overview
2. **Identify ROI**: Spot regions of interest across the scan
3. **Measure**: Add measurements to tracked frames
4. **Export**: Generate DICOM SR with measurements

## Configuration

### Route Configuration

```javascript
routes: [
  {
    path: 'overview',
    layoutTemplate: () => overviewLayout,
  },
]
```

### Hanging Protocol

The mode uses a custom hanging protocol (`overview4x4`) that:
- Creates a 4×4 grid viewport structure
- Distributes frames evenly across the series
- Assigns all viewports to the same tool group

## Differences from Longitudinal Mode

| Feature | Longitudinal Mode | Overview Mode |
|---------|------------------|---------------|
| **Layout** | Single viewport | 4×4 grid (16 viewports) |
| **Frame Display** | Sequential scrolling | Evenly-spaced sampling |
| **Use Case** | Detailed analysis | Quick overview |
| **LifeSync Features** | Not included | Not included |

## Differences from LifeSync Modes

Overview mode is a **standard OHIF mode** without LifeSync-specific features:

❌ No screw management panel  
❌ No tracking panel  
❌ No registration panel  
❌ No segmentation panel  
✅ Only measurement tracking (standard OHIF)

## Technical Details

### Dependencies

```json
{
  "@ohif/extension-default": "^3.0.0",
  "@ohif/extension-cornerstone": "^3.0.0",
  "@ohif/extension-measurement-tracking": "^3.0.0"
}
```

### Mode ID

```javascript
id: "@ohif/mode-overview"
```

### Route Path

```
/overview
```

## Customization

### Changing Grid Size

To modify the grid layout (e.g., 3×3 or 5×5):

1. Edit `src/hangingProtocol.ts`
2. Update `rows` and `columns` in `viewportStructure`
3. Update the `viewports` array length

Example for 3×3:

```javascript
viewportStructure: {
  layoutType: 'grid',
  properties: {
    rows: 3,
    columns: 3,
  },
},
viewports: Array.from({ length: 9 }, (_, index) => {
  // ... viewport configuration
})
```

### Adjusting Frame Distribution

Modify the position calculation in `hangingProtocol.ts`:

```javascript
const position = index / (totalViewports - 1);
```

## Troubleshooting

### Issue: Grid not displaying
**Solution**: Check that series has enough frames (at least 1)

### Issue: Frames not evenly spaced
**Solution**: Verify hanging protocol is correctly loaded

### Issue: Tools not working
**Solution**: Ensure all viewports are assigned to 'default' tool group

## Performance Considerations

- **Memory Usage**: 16 simultaneous viewports use more memory
- **Rendering**: May be slower on low-end hardware
- **Best For**: Series with 16+ frames for meaningful distribution

## See Also

- [OHIF Modes Documentation](https://docs.ohif.org/platform/modes/)
- [Hanging Protocols](https://docs.ohif.org/platform/hanging-protocols/)
- [Measurement Tracking](https://docs.ohif.org/platform/extensions/measurement-tracking/)

