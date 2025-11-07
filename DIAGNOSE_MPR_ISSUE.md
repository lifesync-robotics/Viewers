# How to Diagnose MPR/3D Issue in OHIF

## ✅ Current Status
- OHIF is RUNNING on port 3000
- Orthanc is RUNNING on port 8042
- DICOMweb is ENABLED
- Configuration updated: `strictZSpacingForVolumeViewport: false`

## 🔍 Step-by-Step Diagnosis

### Step 1: Open Browser Developer Tools

1. Open OHIF in Chrome: `http://localhost:3000` or `http://192.168.40.87:3000`
2. Press **F12** to open Developer Tools
3. Click on the **Console** tab

### Step 2: Load a Study and Reproduce the Issue

1. In OHIF, click on a study to open it
2. Wait for 2D images to load (verify they work)
3. Try to switch to **MPR** or **3D** view
4. Watch the console for error messages

### Step 3: Common Error Messages and What They Mean

| Error Message | Root Cause | Solution |
|--------------|------------|----------|
| `Cannot create volume from single image` | Only 1 slice in series | Need multiple slices (20+) |
| `ImagePositionPatient is required` | Missing DICOM metadata | DICOM files are incomplete |
| `PixelSpacing is missing` | Missing spacing data | Check DICOM tags |
| `Non-uniform spacing detected` | Uneven slice spacing | May work with config change |
| `Failed to create volume viewport` | General 3D error | Check other errors above it |
| `volumeLoader is not defined` | Missing volume loader | Cornerstone issue |

### Step 4: Check Network Requests

1. In Developer Tools, click **Network** tab
2. Filter by **Fetch/XHR**
3. Reload the study
4. Look for:
   - Requests to `/dicom-web/studies/`
   - Any **red** (failed) requests
   - Status codes other than 200

### Step 5: Check DICOM Metadata

Run this in terminal to check your data:

```bash
# Get study ID
curl -u lsr:lsr http://localhost:8042/studies | jq '.[0]' || curl -u lsr:lsr http://localhost:8042/studies

# Replace STUDY_ID with actual ID from above
STUDY_ID="YOUR_STUDY_ID_HERE"

# Get series info
curl -u lsr:lsr http://localhost:8042/studies/$STUDY_ID/series | jq '.[0]'

# Get series ID from above, then get instance count
SERIES_ID="YOUR_SERIES_ID_HERE"
curl -u lsr:lsr http://localhost:8042/series/$SERIES_ID | jq '.Instances, .ExpectedNumberOfInstances'

# Get first instance
INSTANCE_ID=$(curl -u lsr:lsr http://localhost:8042/series/$SERIES_ID/instances | jq -r '.[0].ID')

# Check critical DICOM tags
curl -u lsr:lsr "http://localhost:8042/instances/$INSTANCE_ID/tags?simplify" | jq '{
  ImagePositionPatient,
  ImageOrientationPatient,
  PixelSpacing,
  SliceThickness,
  SliceLocation,
  Rows,
  Columns,
  Modality
}'
```

### Step 6: Minimum Requirements for MPR

For MPR to work, you need:

- ✅ **Multiple slices**: At least 10, ideally 20+ images
- ✅ **ImagePositionPatient**: Must be present in all instances
- ✅ **ImageOrientationPatient**: Must be present
- ✅ **PixelSpacing**: Must be defined
- ✅ **Uniform spacing**: Slices should be evenly spaced (now relaxed)
- ✅ **Same frame of reference**: All instances in same coordinate system

## 📊 Quick Diagnostic Commands

### Check Instance Count
```bash
curl -u lsr:lsr http://localhost:8042/studies | \
  jq -r '.[0]' | \
  xargs -I {} curl -u lsr:lsr http://localhost:8042/studies/{}/series | \
  jq '.[].Instances | length'
```

### Check if Required Tags Exist
```bash
INSTANCE_ID=$(curl -u lsr:lsr http://localhost:8042/instances | jq -r '.[0].ID')
curl -u lsr:lsr "http://localhost:8042/instances/$INSTANCE_ID/tags?simplify" | \
  grep -E "ImagePosition|ImageOrientation|PixelSpacing"
```

## 🎯 Most Common Issues

### Issue 1: Single Slice Series
**Symptom**: "Cannot create volume from single image"
**Check**: How many instances in series?
**Solution**: Upload a multi-slice CT/MR series

### Issue 2: Missing Metadata
**Symptom**: "ImagePositionPatient is required"
**Check**: Do DICOM files have proper tags?
**Solution**: Re-export from PACS with full metadata

### Issue 3: X-Ray or Single Frame Images
**Symptom**: 2D works, 3D doesn't
**Check**: Is this X-ray, CR, or single-frame data?
**Solution**: MPR only works with CT/MR multi-slice data

## 📝 What to Share for Help

When asking for help, provide:

1. **Error message from browser console** (exact text)
2. **Number of instances** in your series
3. **Modality** (CT, MR, XR, etc.)
4. **Sample metadata** from one instance
5. **Screenshot** of the error if possible

## 🔧 Testing with Sample Data

If you want to test with known-good data:

```bash
# Download sample CT dataset
wget https://raw.githubusercontent.com/OHIF/Viewers/master/.webpack/dcm/LIDC-IDRI-0001.zip
unzip LIDC-IDRI-0001.zip

# Upload to Orthanc
for file in *.dcm; do
  curl -u lsr:lsr -X POST http://localhost:8042/instances --data-binary @$file
done
```

## 🚀 Next Steps

1. **Open OHIF** in browser
2. **Press F12** to open console
3. **Load a study** and try MPR
4. **Copy the exact error message** from console
5. **Run the diagnostic commands** above
6. **Share the results** for further diagnosis

---

## Common Error Examples

### Example 1: Single Slice
```
Error: Cannot create volume from single image.
```
→ You only have 1 slice. Need multiple slices.

### Example 2: Missing Position
```
Error: ImagePositionPatient is required for volume rendering
```
→ DICOM metadata is incomplete.

### Example 3: Non-CT/MR Data
```
Error: Viewport type 'volume' is not supported for this data
```
→ Trying to do MPR on X-ray or other 2D-only modality.


