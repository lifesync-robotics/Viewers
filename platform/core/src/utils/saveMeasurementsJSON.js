/**
 * Auto-save measurements as JSON to surgical_case directory
 * JSON format preserves full annotation data for easy reload
 */

/**
 * Save all measurements for a study/series to JSON
 * @param {Array} measurements - Array of measurement objects from MeasurementService
 * @param {string} studyInstanceUID
 * @param {string} seriesInstanceUID
 */
export async function saveMeasurementsJSON(measurements, studyInstanceUID, seriesInstanceUID) {
  if (!measurements || measurements.length === 0) {
    return;
  }

  if (!studyInstanceUID || !seriesInstanceUID) {
    console.warn('⚠️ Cannot save measurements: Missing StudyInstanceUID or SeriesInstanceUID');
    return;
  }

  // Generate filename with timestamp
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `measurements-${timestamp}.json`;

  // Prepare JSON data with full annotation information
  const measurementData = {
    version: '1.0',
    savedAt: now.toISOString(),
    studyInstanceUID,
    seriesInstanceUID,
    measurementCount: measurements.length,
    measurements: measurements.map(m => {
      // Determine measurement type from multiple possible sources
      let measurementType = m.type || m.toolName || m.label?.split('-')[0] || 'Unknown';
      
      // If type is still not clear, try to infer from displayText structure
      if (measurementType === 'Unknown' && m.displayText) {
        // FiducialMarker has X, Y, Z in secondary
        if (m.displayText.secondary && m.displayText.secondary.some(s => s.includes('X:') && s.includes('mm'))) {
          measurementType = 'FiducialMarker';
        }
      }
      
      return {
        // Core identification
        uid: m.uid,
        label: m.label,
        type: measurementType, // 'Length', 'Bidirectional', 'FiducialMarker', etc.
        
        // DICOM references
        SOPInstanceUID: m.SOPInstanceUID,
        FrameOfReferenceUID: m.FrameOfReferenceUID,
        referenceSeriesUID: m.referenceSeriesUID,
        referenceStudyUID: m.referenceStudyUID,
        
        // Measurement data (tool-specific)
        data: m.data, // Full data object
        points: m.points, // Array of coordinate points
        
        // Display information
        displayText: m.displayText,
        description: m.description,
        
        // Metadata
        metadata: m.metadata,
        
        // Rendering hints
        isVisible: m.isVisible !== false,
        isLocked: m.isLocked || false,
      };
    }),
  };

  try {
    const response = await fetch('http://localhost:3001/api/surgical-cases/save-json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        studyInstanceUID,
        seriesInstanceUID,
        filename,
        jsonContent: JSON.stringify(measurementData, null, 2),
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Measurements JSON saved to: ${result.filePath}`);
      return result;
    } else {
      const error = await response.text();
      console.warn(`⚠️ Failed to save measurements JSON: ${error}`);
    }
  } catch (error) {
    console.warn('⚠️ Could not save measurements JSON (backend may not be configured):', error.message);
  }
}

/**
 * Load measurements JSON from surgical_case directory
 * @param {string} studyInstanceUID
 * @param {string} seriesInstanceUID
 * @returns {Promise<Object|null>} Parsed measurement data or null
 */
export async function loadMeasurementsJSON(studyInstanceUID, seriesInstanceUID) {
  try {
    // First, list available JSON files
    const params = new URLSearchParams({ studyInstanceUID, seriesInstanceUID });
    const listResponse = await fetch(
      `http://localhost:3001/api/surgical-cases/list-json?${params.toString()}`
    );

    if (!listResponse.ok) {
      return null;
    }

    const { files } = await listResponse.json();
    if (!files || files.length === 0) {
      return null;
    }

    // Get the most recent file
    const latestFile = files[files.length - 1]; // Assumes sorted by name (timestamp)

    // Load the file
    const getParams = new URLSearchParams({
      studyInstanceUID,
      seriesInstanceUID,
      filename: latestFile.filename,
    });

    const getResponse = await fetch(
      `http://localhost:3001/api/surgical-cases/get-json?${getParams.toString()}`
    );

    if (getResponse.ok) {
      const data = await getResponse.json();
      const measurements = JSON.parse(data.jsonContent);
      console.log(`📂 Loaded ${measurements.measurementCount} measurements from ${latestFile.filename}`);
      return measurements;
    }

    return null;
  } catch (error) {
    console.warn('⚠️ Error loading measurements JSON:', error.message);
    return null;
  }
}

export default {
  saveMeasurementsJSON,
  loadMeasurementsJSON,
};
