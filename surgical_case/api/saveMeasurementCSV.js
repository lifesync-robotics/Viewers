/**
 * Backend API Endpoint for Saving Measurement CSV Files
 *
 * This endpoint saves CSV files to the surgical_case directory structure:
 * surgical_case/studies/{StudyInstanceUID}/{SeriesInstanceUID}/measurements-{timestamp}.csv
 *
 * Usage:
 * 1. Add this endpoint to your Express/Node.js backend server
 * 2. Ensure the server has write access to the OHIF workspace directory
 * 3. Configure CORS if needed
 *
 * Example integration with Express:
 *
 * const express = require('express');
 * const fs = require('fs').promises;
 * const path = require('path');
 * const app = express();
 *
 * app.use(express.json());
 *
 * // Add this route
 * app.post('/api/surgical-cases/save-csv', async (req, res) => {
 *   // ... (use code below)
 * });
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Save measurement CSV to surgical_case directory structure
 *
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body containing:
 *   - studyInstanceUID: string
 *   - seriesInstanceUID: string
 *   - filename: string (e.g., "measurements-2025-11-07T22-05-01.csv")
 *   - csvContent: string (CSV file content)
 * @param {Object} res - Express response object
 */
async function saveMeasurementCSV(req, res) {
  try {
    const { studyInstanceUID, seriesInstanceUID, filename, csvContent } = req.body;

    // Validate input
    if (!studyInstanceUID || !seriesInstanceUID || !filename || !csvContent) {
      return res.status(400).json({
        error: 'Missing required fields: studyInstanceUID, seriesInstanceUID, filename, csvContent',
      });
    }

    // Get workspace root directory (adjust path as needed)
    // __dirname is surgical_case/api, so go up 2 levels to get to workspace root
    const workspaceRoot = process.env.OHIF_WORKSPACE_ROOT || path.join(__dirname, '..', '..');
    const surgicalCaseDir = path.join(workspaceRoot, 'surgical_case');
    const studiesDir = path.join(surgicalCaseDir, 'studies');
    const studyDir = path.join(studiesDir, studyInstanceUID);
    const seriesDir = path.join(studyDir, seriesInstanceUID);

    // Create directories if they don't exist
    await fs.mkdir(seriesDir, { recursive: true });

    // Sanitize filename (remove any path traversal attempts)
    const sanitizedFilename = path.basename(filename);
    if (!sanitizedFilename.endsWith('.csv')) {
      return res.status(400).json({ error: 'Filename must end with .csv' });
    }

    // Full file path
    const filePath = path.join(seriesDir, sanitizedFilename);

    // Write CSV file
    await fs.writeFile(filePath, csvContent, 'utf8');

    // Return success with file path
    res.json({
      success: true,
      filePath: filePath,
      relativePath: `surgical_case/studies/${studyInstanceUID}/${seriesInstanceUID}/${sanitizedFilename}`,
      message: 'CSV file saved successfully',
    });
  } catch (error) {
    console.error('Error saving measurement CSV:', error);
    res.status(500).json({
      error: 'Failed to save CSV file',
      message: error.message,
    });
  }
}

/**
 * Express route handler wrapper
 */
function saveMeasurementCSVRoute(req, res) {
  return saveMeasurementCSV(req, res);
}

/**
 * List all CSV files for a given study/series
 *
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters:
 *   - studyInstanceUID: string (required)
 *   - seriesInstanceUID: string (optional)
 */
async function listMeasurementCSV(req, res) {
  try {
    const { studyInstanceUID, seriesInstanceUID } = req.query;

    if (!studyInstanceUID) {
      return res.status(400).json({
        error: 'Missing required parameter: studyInstanceUID',
      });
    }

    const workspaceRoot = process.env.OHIF_WORKSPACE_ROOT || path.join(__dirname, '..', '..');
    const surgicalCaseDir = path.join(workspaceRoot, 'surgical_case');
    const studiesDir = path.join(surgicalCaseDir, 'studies');
    const studyDir = path.join(studiesDir, studyInstanceUID);

    // Check if study directory exists
    try {
      await fs.access(studyDir);
    } catch {
      return res.json({ files: [] }); // No saved measurements
    }

    let csvFiles = [];

    if (seriesInstanceUID) {
      // List CSVs for specific series
      const seriesDir = path.join(studyDir, seriesInstanceUID);
      try {
        const files = await fs.readdir(seriesDir);
        csvFiles = files
          .filter(f => f.endsWith('.csv'))
          .map(f => ({
            filename: f,
            path: path.join(seriesDir, f),
            relativePath: `surgical_case/studies/${studyInstanceUID}/${seriesInstanceUID}/${f}`,
            studyInstanceUID,
            seriesInstanceUID,
          }));
      } catch {
        // Series directory doesn't exist
      }
    } else {
      // List CSVs for all series in study
      const seriesDirs = await fs.readdir(studyDir);
      for (const seriesUID of seriesDirs) {
        const seriesDir = path.join(studyDir, seriesUID);
        const stat = await fs.stat(seriesDir);
        if (stat.isDirectory()) {
          try {
            const files = await fs.readdir(seriesDir);
            const seriesCSVs = files
              .filter(f => f.endsWith('.csv'))
              .map(f => ({
                filename: f,
                path: path.join(seriesDir, f),
                relativePath: `surgical_case/studies/${studyInstanceUID}/${seriesUID}/${f}`,
                studyInstanceUID,
                seriesInstanceUID: seriesUID,
              }));
            csvFiles.push(...seriesCSVs);
          } catch {
            // Skip if can't read directory
          }
        }
      }
    }

    res.json({ files: csvFiles });
  } catch (error) {
    console.error('Error listing CSV files:', error);
    res.status(500).json({
      error: 'Failed to list CSV files',
      message: error.message,
    });
  }
}

/**
 * Get a specific CSV file content
 *
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters:
 *   - studyInstanceUID: string (required)
 *   - seriesInstanceUID: string (required)
 *   - filename: string (required)
 */
async function getMeasurementCSV(req, res) {
  try {
    const { studyInstanceUID, seriesInstanceUID, filename } = req.query;

    if (!studyInstanceUID || !seriesInstanceUID || !filename) {
      return res.status(400).json({
        error: 'Missing required parameters: studyInstanceUID, seriesInstanceUID, filename',
      });
    }

    const workspaceRoot = process.env.OHIF_WORKSPACE_ROOT || path.join(__dirname, '..', '..');
    const surgicalCaseDir = path.join(workspaceRoot, 'surgical_case');
    const filePath = path.join(
      surgicalCaseDir,
      'studies',
      studyInstanceUID,
      seriesInstanceUID,
      path.basename(filename) // Sanitize filename
    );

    // Check file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'CSV file not found' });
    }

    // Read and return file content
    const csvContent = await fs.readFile(filePath, 'utf8');
    res.json({
      filename: path.basename(filename),
      studyInstanceUID,
      seriesInstanceUID,
      csvContent,
    });
  } catch (error) {
    console.error('Error getting CSV file:', error);
    res.status(500).json({
      error: 'Failed to get CSV file',
      message: error.message,
    });
  }
}

module.exports = {
  saveMeasurementCSV,
  saveMeasurementCSVRoute,
  listMeasurementCSV,
  getMeasurementCSV,
};

/**
 * Example Express.js integration:
 *
 * const express = require('express');
 * const { saveMeasurementCSVRoute } = require('./surgicalCaseAPI');
 * const app = express();
 *
 * app.use(express.json());
 * app.use(express.static('public')); // Serve OHIF frontend
 *
 * // CORS configuration (if needed)
 * app.use((req, res, next) => {
 *   res.header('Access-Control-Allow-Origin', '*');
 *   res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
 *   res.header('Access-Control-Allow-Headers', 'Content-Type');
 *   next();
 * });
 *
 * // Surgical case CSV endpoint
 * app.post('/api/surgical-cases/save-csv', saveMeasurementCSVRoute);
 *
 * const PORT = process.env.PORT || 3000;
 * app.listen(PORT, () => {
 *   console.log(`Server running on port ${PORT}`);
 *   console.log(`Surgical case directory: ${path.join(process.cwd(), 'surgical_case')}`);
 * });
 */
