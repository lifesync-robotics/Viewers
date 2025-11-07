#!/bin/bash
# Automated MPR Readiness Checker

USER="lsr"
PASS="lsr"
HOST="localhost:8042"

echo "═══════════════════════════════════════════════════"
echo "       OHIF MPR/3D Readiness Diagnostic Tool       "
echo "═══════════════════════════════════════════════════"
echo ""

# Check if Orthanc is accessible
echo "🔍 Checking Orthanc connection..."
if ! curl -u $USER:$PASS -s -f http://$HOST/system > /dev/null; then
    echo "❌ Cannot connect to Orthanc!"
    echo "   Check credentials or if Orthanc is running"
    exit 1
fi
echo "✅ Orthanc is accessible"
echo ""

# Get studies
echo "🔍 Checking for studies..."
STUDIES=$(curl -u $USER:$PASS -s http://$HOST/studies)
STUDY_COUNT=$(echo "$STUDIES" | jq 'length' 2>/dev/null || echo "$STUDIES" | grep -o '"' | wc -l)

if [ "$STUDY_COUNT" -eq 0 ]; then
    echo "❌ NO STUDIES FOUND!"
    echo "   Upload DICOM files first:"
    echo "   curl -u $USER:$PASS -X POST http://$HOST/instances --data-binary @yourfile.dcm"
    exit 1
fi

echo "✅ Found $STUDY_COUNT study/studies"
echo ""

# Get first study
STUDY_ID=$(echo "$STUDIES" | jq -r '.[0]' 2>/dev/null || echo "$STUDIES" | grep -oP '"\K[^"]+' | head -1)
echo "📁 Analyzing Study: $STUDY_ID"
echo ""

# Get series in study
SERIES=$(curl -u $USER:$PASS -s http://$HOST/studies/$STUDY_ID/series)
SERIES_COUNT=$(echo "$SERIES" | jq 'length' 2>/dev/null || echo "1")
echo "📊 Series in study: $SERIES_COUNT"
echo ""

# Analyze each series
SERIES_IDS=$(echo "$SERIES" | jq -r '.[].ID' 2>/dev/null || echo "$SERIES" | grep -oP '"ID"\s*:\s*"\K[^"]+')

for SERIES_ID in $SERIES_IDS; do
    echo "─────────────────────────────────────────────────"
    echo "🔬 Series: $SERIES_ID"

    # Get series details
    SERIES_INFO=$(curl -u $USER:$PASS -s http://$HOST/series/$SERIES_ID)
    INSTANCE_COUNT=$(echo "$SERIES_INFO" | jq -r '.Instances | length' 2>/dev/null || echo "$SERIES_INFO" | grep -oP '"Instances"\s*:\s*\[\s*"\K[^"]+' | wc -l)
    MODALITY=$(echo "$SERIES_INFO" | jq -r '.MainDicomTags.Modality' 2>/dev/null || echo "Unknown")
    DESCRIPTION=$(echo "$SERIES_INFO" | jq -r '.MainDicomTags.SeriesDescription' 2>/dev/null || echo "N/A")

    echo "   Modality: $MODALITY"
    echo "   Description: $DESCRIPTION"
    echo "   Instance Count: $INSTANCE_COUNT"

    # Check instance count
    if [ "$INSTANCE_COUNT" -lt 5 ]; then
        echo "   ❌ TOO FEW SLICES for MPR (need 10+, ideally 20+)"
        echo "   💡 MPR requires a multi-slice CT or MR series"
    elif [ "$INSTANCE_COUNT" -lt 10 ]; then
        echo "   ⚠️  Low slice count. MPR may work but not ideal"
    else
        echo "   ✅ Sufficient slices for MPR"
    fi

    # Check modality
    case "$MODALITY" in
        CT|MR|MRI|PET)
            echo "   ✅ Modality supports MPR/3D"
            ;;
        CR|DX|XA|XR|RF)
            echo "   ❌ X-ray/2D modality - MPR NOT supported"
            continue
            ;;
        *)
            echo "   ⚠️  Modality: $MODALITY - may or may not support MPR"
            ;;
    esac

    # Get first instance for metadata check
    echo ""
    echo "   🔍 Checking DICOM metadata..."
    INSTANCES=$(curl -u $USER:$PASS -s http://$HOST/series/$SERIES_ID/instances)
    INSTANCE_ID=$(echo "$INSTANCES" | jq -r '.[0].ID' 2>/dev/null || echo "$INSTANCES" | grep -oP '"ID"\s*:\s*"\K[^"]+' | head -1)

    TAGS=$(curl -u $USER:$PASS -s "http://$HOST/instances/$INSTANCE_ID/tags?simplify")

    # Check critical tags
    HAS_IPP=$(echo "$TAGS" | grep -q "ImagePositionPatient" && echo "yes" || echo "no")
    HAS_IOP=$(echo "$TAGS" | grep -q "ImageOrientationPatient" && echo "yes" || echo "no")
    HAS_PS=$(echo "$TAGS" | grep -q "PixelSpacing" && echo "yes" || echo "no")
    HAS_ST=$(echo "$TAGS" | grep -q "SliceThickness" && echo "yes" || echo "no")

    # Results
    if [ "$HAS_IPP" = "yes" ]; then
        IPP=$(echo "$TAGS" | jq -r '.ImagePositionPatient // empty' 2>/dev/null || echo "$TAGS" | grep -oP '"ImagePositionPatient"\s*:\s*\K[^}]+')
        echo "   ✅ ImagePositionPatient: $IPP"
    else
        echo "   ❌ ImagePositionPatient: MISSING (REQUIRED!)"
    fi

    if [ "$HAS_IOP" = "yes" ]; then
        echo "   ✅ ImageOrientationPatient: Present"
    else
        echo "   ❌ ImageOrientationPatient: MISSING (REQUIRED!)"
    fi

    if [ "$HAS_PS" = "yes" ]; then
        PS=$(echo "$TAGS" | jq -r '.PixelSpacing // empty' 2>/dev/null)
        echo "   ✅ PixelSpacing: $PS"
    else
        echo "   ⚠️  PixelSpacing: Missing (needed for accurate 3D)"
    fi

    if [ "$HAS_ST" = "yes" ]; then
        ST=$(echo "$TAGS" | jq -r '.SliceThickness // empty' 2>/dev/null)
        echo "   ✅ SliceThickness: $ST mm"
    else
        echo "   ⚠️  SliceThickness: Missing"
    fi

    # Overall verdict
    echo ""
    echo "   📋 MPR READINESS VERDICT:"
    if [ "$HAS_IPP" = "yes" ] && [ "$HAS_IOP" = "yes" ] && [ "$INSTANCE_COUNT" -ge 10 ] && [[ "$MODALITY" =~ ^(CT|MR|MRI|PET)$ ]]; then
        echo "   ✅ ✅ ✅ This series SHOULD work with MPR!"
    elif [ "$HAS_IPP" = "no" ] || [ "$HAS_IOP" = "no" ]; then
        echo "   ❌ CANNOT use MPR - Missing required metadata"
    elif [ "$INSTANCE_COUNT" -lt 5 ]; then
        echo "   ❌ CANNOT use MPR - Not enough slices"
    elif [[ "$MODALITY" =~ ^(CR|DX|XA|XR|RF)$ ]]; then
        echo "   ❌ CANNOT use MPR - 2D modality only"
    else
        echo "   ⚠️  MAY work with MPR, but results uncertain"
    fi

    echo ""
done

echo "═══════════════════════════════════════════════════"
echo ""
echo "🎯 NEXT STEPS:"
echo ""
echo "1. Open OHIF: http://192.168.40.87:3000"
echo "2. Press F12 to open Developer Console"
echo "3. Load the study and try MPR view"
echo "4. If it fails, copy the EXACT error message"
echo ""
echo "📖 For detailed guide, see: DIAGNOSE_MPR_ISSUE.md"
echo ""
echo "═══════════════════════════════════════════════════"


