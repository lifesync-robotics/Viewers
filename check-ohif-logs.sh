#!/bin/bash
echo "===== OHIF Log Checker and Diagnostics ====="
echo ""

# Check if OHIF is running
if pgrep -f "webpack.*3000" > /dev/null; then
    echo "✅ OHIF webpack dev server is RUNNING"
    echo ""
else
    echo "❌ OHIF is NOT running!"
    echo "Start it with: cd /home/asclepius/github/Viewers && yarn dev"
    exit 1
fi

# Check webpack process details
echo "=== Webpack Process Info ==="
ps aux | grep -E "webpack.*3000" | grep -v grep
echo ""

# Check if port 3000 is listening
echo "=== Port 3000 Status ==="
if lsof -i :3000 > /dev/null 2>&1; then
    lsof -i :3000 | head -5
    echo "✅ OHIF is listening on port 3000"
else
    echo "❌ Port 3000 is not listening"
fi
echo ""

# Check recent network activity to Orthanc
echo "=== Testing Orthanc Connection ==="
curl -u lsr:lsr -s -o /dev/null -w "Orthanc HTTP Status: %{http_code}\n" http://localhost:8042/system
curl -u lsr:lsr -s -o /dev/null -w "DICOMweb HTTP Status: %{http_code}\n" http://localhost:8042/dicom-web/studies
echo ""

# Check OHIF config
echo "=== OHIF Configuration ==="
echo "Default data source:"
grep "defaultDataSourceName" /home/asclepius/github/Viewers/platform/app/public/config/default.js | head -1

echo ""
echo "Orthanc data source config:"
grep -A 10 "sourceName.*orthanc" /home/asclepius/github/Viewers/platform/app/public/config/default.js | head -15

echo ""
echo "Z-spacing setting:"
grep "strictZSpacingForVolumeViewport" /home/asclepius/github/Viewers/platform/app/public/config/default.js

echo ""
echo "=== Browser Console Log Instructions ==="
echo "To check client-side OHIF logs:"
echo "1. Open OHIF: http://192.168.40.87:3000 or http://localhost:3000"
echo "2. Press F12 to open Developer Tools"
echo "3. Go to 'Console' tab"
echo "4. Try to open a study in MPR/3D mode"
echo "5. Look for errors (red text) or warnings (yellow text)"
echo ""
echo "Common MPR errors to look for:"
echo "  - 'Cannot create volume from single image'"
echo "  - 'ImagePositionPatient is missing'"
echo "  - 'Non-uniform spacing'"
echo "  - 'Failed to create volume viewport'"
echo "  - 'PixelSpacing is missing'"
echo ""

echo "=== Network Tab Instructions ==="
echo "To check DICOMweb requests:"
echo "1. In Developer Tools, go to 'Network' tab"
echo "2. Filter by 'Fetch/XHR'"
echo "3. Load a study"
echo "4. Look for requests to '/dicom-web/'"
echo "5. Check if any requests fail (red) or return errors"
echo ""

echo "=== Manual DICOM Data Check ==="
echo "Run these commands to check your data:"
echo ""
echo "# List all studies:"
echo "curl -u lsr:lsr http://localhost:8042/studies"
echo ""
echo "# Get study details (replace STUDY_ID):"
echo "curl -u lsr:lsr http://localhost:8042/studies/STUDY_ID"
echo ""
echo "# Check instance count in a series (replace SERIES_ID):"
echo "curl -u lsr:lsr http://localhost:8042/series/SERIES_ID | grep -E 'Instances|ExpectedNumber'"
echo ""
echo "# Check metadata of first instance (replace INSTANCE_ID):"
echo "curl -u lsr:lsr 'http://localhost:8042/instances/INSTANCE_ID/tags?simplify' | grep -E 'ImagePosition|ImageOrientation|PixelSpacing|SliceThickness'"
echo ""

echo "=== Quick Test ==="
echo "Testing if OHIF can reach Orthanc through proxy..."
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000/dicom-web/studies

echo ""
echo "===== Next Steps ====="
echo "1. Open OHIF in browser and press F12"
echo "2. Try to view a study in MPR mode"
echo "3. Copy any error messages from Console"
echo "4. Share those errors for diagnosis"


