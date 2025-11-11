/**
 * Model Server for OHIF (VTK.js Enabled)
 *
 * This Express server provides:
 * 1. Static file serving for 3D models (OBJ files)
 * 2. API endpoints to list available models
 * 3. File upload capability for user models
 * 4. CORS support to avoid browser security issues
 * 5. VTK.js-based procedural cylinder generation (in-memory, cached)
 *    - Automatically generates fallback cylinders when models are not found
 *    - Uses vtkCylinderSource for high-quality geometry
 *    - Cached in memory for session lifetime (no disk storage)
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

// Setup browser-like environment for VTK.js (required for Node.js)
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html>', {
  pretendToBeVisual: true,
  resources: 'usable'
});

global.window = dom.window;
global.document = window.document;
global.navigator = window.navigator;
global.HTMLElement = window.HTMLElement;

// Load VTK.js using official import pattern
let vtkCylinderSource = null;
let vtkEnabled = false;

try {
  // Official import pattern from documentation:
  // https://kitware.github.io/vtk-js/api/Filters_Sources_CylinderSource.html
  vtkCylinderSource = require('@kitware/vtk.js/Filters/Sources/CylinderSource');
  vtkEnabled = true;
  console.log('✓ VTK.js vtkCylinderSource loaded successfully');
  console.log('  Import: @kitware/vtk.js/Filters/Sources/CylinderSource');
} catch (error) {
  console.log('ℹ️ VTK.js not available - using manual cylinder generation');
  console.log('   This is normal and works perfectly fine!');
}

const app = express();
const PORT = process.env.MODEL_SERVER_PORT || 5001;

// Directory paths
const MODELS_DIR = path.join(__dirname, '../../../models');
const SERVER_MODELS_DIR = path.join(MODELS_DIR, 'server');
const USER_MODELS_DIR = path.join(MODELS_DIR, 'uploads');

// Model naming convention: 7300-T10{diameter}{length}.obj
// where diameter = radius * 2 with decimal point removed
// e.g., radius 3.25mm → diameter 6.5mm → "65"
//       length 35mm → "35"
//       result: "7300-T106535.obj"
// Special case: 7300-T10_Top.obj (screw cap, no dimensions)
const MODEL_PREFIX = '7300-T10';
const SCREW_CAP_FILENAME = '7300-T10_Top.obj';

// Ensure directories exist
[MODELS_DIR, SERVER_MODELS_DIR, USER_MODELS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

/**
 * Model lookup dictionary for quick queries
 * Structure: { "radius_length": { filename, radius, length, diameter, ... } }
 * Example: { "6.5_35": { filename: "7300-T1013035.obj", radius: 6.5, length: 35, ... } }
 */
let modelDictionary = {};

/**
 * In-memory cache for generated cylinder models (session-based)
 * Structure: { "radius_length": { objContent: "...", modelInfo: {...} } }
 */
const generatedCylinderCache = {};

/**
 * Generate filename from radius and length following the naming convention
 * Formula: 7300-T10{diameter}{length}.obj
 * where diameter = (radius * 2) with decimal removed
 *
 * @param {number} radius - Screw radius in mm
 * @param {number} length - Screw length in mm
 * @returns {string} - Generated filename
 *
 * Examples:
 *   - radius 3.25, length 35 → "7300-T106535.obj"
 *   - radius 6.5, length 40 → "7300-T1013040.obj"
 */
function generateModelFilename(radius, length) {
  const diameter = radius * 2;
  const diameterStr = diameter.toString().replace('.', '');
  const lengthStr = length.toString().replace('.', '');
  return `${MODEL_PREFIX}${diameterStr}${lengthStr}.obj`;
}

/**
 * Parse filename to extract radius and length
 *
 * @param {string} filename - Model filename
 * @returns {object|null} - { radius, length, diameter, isCap } or null if not matching convention
 *
 * Examples:
 *   - "7300-T106535.obj" → { radius: 3.25, length: 35, diameter: 6.5, isCap: false }
 *   - "7300-T1013040.obj" → { radius: 6.5, length: 40, diameter: 13, isCap: false }
 *   - "7300-T10_Top.obj" → { radius: null, length: null, diameter: null, isCap: true }
 */
function parseModelFilename(filename) {
  // Special case: screw cap
  if (filename === SCREW_CAP_FILENAME) {
    return {
      radius: null,
      length: null,
      diameter: null,
      isCap: true
    };
  }

  // Check if filename matches the convention
  if (!filename.startsWith(MODEL_PREFIX) || !filename.endsWith('.obj')) {
    return null;
  }

  // Extract the part after prefix and before .obj
  const numbersStr = filename.substring(MODEL_PREFIX.length, filename.length - 4);

  // The format is {diameter}{length}
  // We need to figure out where diameter ends and length begins
  // Common lengths are 2-3 digits (e.g., 35, 40, 350)
  // Common diameters are 2-3 digits (e.g., 65, 130)

  // Try to parse - assume length is the last 2-3 digits
  // This is a heuristic approach
  let diameter = null;
  let length = null;

  // Try different splits (last 2 digits as length, last 3 digits as length)
  for (let lengthDigits = 2; lengthDigits <= 3; lengthDigits++) {
    if (numbersStr.length > lengthDigits) {
      const lengthStr = numbersStr.slice(-lengthDigits);
      const diameterStr = numbersStr.slice(0, -lengthDigits);

      // Try to parse
      const parsedLength = parseInt(lengthStr);
      let parsedDiameter = parseFloat(diameterStr);

      // If diameter has no decimal, try adding one
      if (diameterStr.length === 2) {
        // e.g., "65" → 6.5
        parsedDiameter = parseFloat(diameterStr[0] + '.' + diameterStr[1]);
      } else if (diameterStr.length === 3) {
        // e.g., "130" → 13.0
        parsedDiameter = parseFloat(diameterStr.slice(0, -1) + '.' + diameterStr.slice(-1));
      }

      // Validate reasonable ranges
      if (parsedDiameter >= 5 && parsedDiameter <= 20 && parsedLength >= 20 && parsedLength <= 100) {
        diameter = parsedDiameter;
        length = parsedLength;
        break;
      }
    }
  }

  if (diameter === null || length === null) {
    return null;
  }

  const radius = diameter / 2;

  return {
    radius: radius,
    length: length,
    diameter: diameter,
    isCap: false
  };
}

/**
 * Convert VTK PolyData to OBJ format string (Official API Pattern)
 *
 * Based on official vtk.js polyData structure and test patterns
 *
 * @param {object} polyData - VTK PolyData object from getOutputData()
 * @returns {string} - OBJ format string
 */
function polyDataToOBJ(polyData) {
  let obj = '# Generated Cylinder Model using VTK.js\n';
  obj += '# Generated by OHIF Model Server\n';
  obj += '# Based on official API: https://kitware.github.io/vtk-js/\n\n';

  // Extract points using official getPoints() API
  const points = polyData.getPoints();
  const pointsData = points.getData(); // Returns typed array (Float32Array or Float64Array)
  const numPoints = points.getNumberOfPoints();

  // Write vertices
  obj += '# Vertices\n';
  for (let i = 0; i < numPoints; i++) {
    const idx = i * 3;
    const x = pointsData[idx].toFixed(6);
    const y = pointsData[idx + 1].toFixed(6);
    const z = pointsData[idx + 2].toFixed(6);
    obj += `v ${x} ${y} ${z}\n`;
  }
  obj += '\n';

  // Extract normals if available (optional - vtkCylinderSource may not generate them)
  if (polyData.getPointData) {
    const pointData = polyData.getPointData();
    const normals = pointData.getNormals();
    if (normals) {
      const normalsData = normals.getData();
      obj += '# Normals\n';
      for (let i = 0; i < numPoints; i++) {
        const idx = i * 3;
        const nx = normalsData[idx].toFixed(6);
        const ny = normalsData[idx + 1].toFixed(6);
        const nz = normalsData[idx + 2].toFixed(6);
        obj += `vn ${nx} ${ny} ${nz}\n`;
      }
      obj += '\n';
    }
  }

  // Extract polygons using official getPolys() API
  const polys = polyData.getPolys();
  const polysData = polys.getData(); // Returns typed array with format: [numVerts, idx1, idx2, ..., numVerts, ...]

  obj += '# Faces\n';
  let idx = 0;
  while (idx < polysData.length) {
    const numVerts = polysData[idx++];
    const faceIndices = [];

    for (let i = 0; i < numVerts; i++) {
      faceIndices.push(polysData[idx++] + 1); // OBJ uses 1-based indexing
    }

    obj += `f ${faceIndices.join(' ')}\n`;
  }

  return obj;
}

/**
 * Generate a cylinder geometry (manual fallback implementation)
 * Used when VTK.js is not available
 *
 * @param {number} radius - Cylinder radius in mm
 * @param {number} length - Cylinder length/height in mm
 * @param {number} segments - Number of radial segments (default: 50)
 * @returns {string} - OBJ format string
 */
function generateCylinderOBJManual(radius, length, segments = 50) {
  let obj = '# Generated Cylinder Model (Manual)\n';
  obj += `# Radius: ${radius}mm, Length: ${length}mm (Y-axis flipped)\n`;
  obj += '# Generated by OHIF Model Server\n\n';

  const vertices = [];

  // Generate vertices for bottom circle (at y=0)
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    vertices.push({ x, y: 0, z }); // Bottom circle at y=0
  }

  // Generate vertices for top circle (at y=-length, flipped)
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    vertices.push({ x, y: -length, z }); // Top circle at y=-length (flipped)
  }

  // Add center vertices for caps
  vertices.push({ x: 0, y: 0, z: 0 }); // Bottom center at y=0
  vertices.push({ x: 0, y: -length, z: 0 }); // Top center at y=-length (flipped)

  // Write vertices
  obj += '# Vertices\n';
  vertices.forEach(v => {
    obj += `v ${v.x.toFixed(6)} ${v.y.toFixed(6)} ${v.z.toFixed(6)}\n`;
  });

  obj += '\n';

  // Generate normals
  obj += '# Normals\n';
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const nx = Math.cos(angle);
    const nz = Math.sin(angle);
    obj += `vn ${nx.toFixed(6)} 0.000000 ${nz.toFixed(6)}\n`;
  }
  obj += 'vn 0.000000 1.000000 0.000000\n'; // Bottom normal (flipped - pointing up at y=0)
  obj += 'vn 0.000000 -1.000000 0.000000\n'; // Top normal (flipped - pointing down at y=-length)

  obj += '\n# Faces\n';

  // Side faces (quads as triangles)
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    const bottom1 = i + 1;
    const bottom2 = next + 1;
    const top1 = i + segments + 1;
    const top2 = next + segments + 1;

    // Two triangles per side segment
    obj += `f ${bottom1}//${i + 1} ${bottom2}//${next + 1} ${top2}//${next + 1}\n`;
    obj += `f ${bottom1}//${i + 1} ${top2}//${next + 1} ${top1}//${i + 1}\n`;
  }

  // Bottom cap (triangles from center)
  const bottomCenter = segments * 2 + 1;
  const bottomNormalIdx = segments + 1;
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    obj += `f ${bottomCenter}//${bottomNormalIdx} ${next + 1}//${bottomNormalIdx} ${i + 1}//${bottomNormalIdx}\n`;
  }

  // Top cap (triangles from center)
  const topCenter = segments * 2 + 2;
  const topNormalIdx = segments + 2;
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    obj += `f ${topCenter}//${topNormalIdx} ${i + segments + 1}//${topNormalIdx} ${next + segments + 1}//${topNormalIdx}\n`;
  }

  return obj;
}

/**
 * Generate a cylinder geometry using VTK.js (Official API)
 * Creates a cylinder mesh to use as a fallback when actual model doesn't exist
 *
 * Based on official documentation:
 * https://kitware.github.io/vtk-js/api/Filters_Sources_CylinderSource.html
 *
 * @param {number} radius - Cylinder radius in mm
 * @param {number} length - Cylinder length/height in mm
 * @param {number} resolution - Number of facets around the cylinder (default: 50)
 * @returns {string} - OBJ format string
 */
function generateCylinderOBJ(radius, length, resolution = 50) {
  // Use VTK.js if available, otherwise fallback to manual generation
  if (!vtkEnabled || !vtkCylinderSource) {
    console.log(`   🔧 Using manual cylinder generation: radius=${radius}mm, length=${length}mm`);
    return generateCylinderOBJManual(radius, length, resolution);
  }

  try {
    console.log(`   🔧 Using VTK.js to generate cylinder: radius=${radius}mm, length=${length}mm`);

    // Create VTK cylinder source using official newInstance() method
    // Can pass initial values as parameter
    const cylinderSource = vtkCylinderSource.newInstance({
      height: length,
      radius: radius,
      resolution: resolution,
      capping: true, // Add end caps
      center: [0, -length / 2, 0], // Center at origin, oriented along negative Y axis (flipped)
      direction: [0, -1, 0] // Negative Y-axis direction (flipped for consistency with existing OBJ)
    });

    // Get the generated polyData directly (no update() call needed)
    const polyData = cylinderSource.getOutputData();

    // Convert to OBJ format
    const objContent = polyDataToOBJ(polyData);

    console.log(`   ✅ VTK.js cylinder generated successfully (Y-axis flipped)`);

    return objContent;
  } catch (error) {
    console.error('   ❌ VTK.js cylinder generation failed:', error.message);
    console.log('   🔧 Falling back to manual cylinder generation');
    return generateCylinderOBJManual(radius, length, resolution);
  }
}

/**
 * Generate a cylinder model as fallback (in-memory, cached)
 *
 * @param {number} radius - Cylinder radius in mm
 * @param {number} length - Cylinder length in mm
 * @returns {object} - Model info object with cached OBJ content
 */
function generateFallbackCylinder(radius, length) {
  const key = `${radius}_${length}`;
  const filename = generateModelFilename(radius, length);

  // Check if already in cache
  if (generatedCylinderCache[key]) {
    console.log(`   💾 Returning cached cylinder: ${filename}`);
    return generatedCylinderCache[key];
  }

  console.log('   🔧 Generating fallback cylinder (in-memory)...');
  console.log(`   Radius: ${radius}mm, Length: ${length}mm`);

  // Generate OBJ content using VTK.js
  const objContent = generateCylinderOBJ(radius, length);

  const modelInfo = {
    filename: filename,
    radius: radius,
    length: length,
    diameter: radius * 2,
    isCap: false,
    type: 'generated',
    url: `/api/models/cylinder/${radius}/${length}.obj`,
    size: Buffer.byteLength(objContent, 'utf8'),
    exists: true,
    generated: true,
    cached: true,
    message: 'Cylinder generated as replacement for actual thread model'
  };

  // Cache for this session
  generatedCylinderCache[key] = {
    modelInfo: modelInfo,
    objContent: objContent
  };

  console.log(`   ✅ Cylinder generated and cached (${modelInfo.size} bytes)`);

  return generatedCylinderCache[key];
}

/**
 * Build model dictionary from available files
 * Scans server models directory and creates lookup dictionary
 */
function buildModelDictionary() {
  modelDictionary = {};

  if (!fs.existsSync(SERVER_MODELS_DIR)) {
    console.log('Server models directory does not exist');
    return;
  }

  const files = fs.readdirSync(SERVER_MODELS_DIR)
    .filter(file => path.extname(file).toLowerCase() === '.obj');

  let parsedCount = 0;

  files.forEach(filename => {
    const parsed = parseModelFilename(filename);

    if (parsed) {
      const stats = fs.statSync(path.join(SERVER_MODELS_DIR, filename));

      if (parsed.isCap) {
        // Special case: screw cap (no dimensions)
        modelDictionary['cap'] = {
          filename: filename,
          radius: null,
          length: null,
          diameter: null,
          isCap: true,
          type: 'cap',
          url: `/models/server/${filename}`,
          size: stats.size,
          exists: true
        };
        parsedCount++;
      } else {
        // Regular screw model with dimensions
        const key = `${parsed.radius}_${parsed.length}`;
        modelDictionary[key] = {
          filename: filename,
          radius: parsed.radius,
          length: parsed.length,
          diameter: parsed.diameter,
          isCap: false,
          type: 'screw',
          url: `/models/server/${filename}`,
          size: stats.size,
          exists: true
        };
        parsedCount++;
      }
    }
  });

  console.log(`Model dictionary built: ${parsedCount} models indexed`);
  if (modelDictionary['cap']) {
    console.log(`  - Screw cap model: ${modelDictionary['cap'].filename}`);
  }
  return modelDictionary;
}

// Build dictionary on startup
buildModelDictionary();

// Enable CORS for all routes to avoid browser security issues
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, USER_MODELS_DIR);
  },
  filename: function (req, file, cb) {
    // Create unique filename with timestamp
    const timestamp = Date.now();
    const originalName = file.originalname.replace(/\s+/g, '_'); // Replace spaces
    const filename = `${timestamp}_${originalName}`;
    cb(null, filename);
  }
});

// File filter to only accept .obj files
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.obj') {
    cb(null, true);
  } else {
    cb(new Error('Only .obj files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max file size
  }
});

/**
 * Get list of all available models
 * Returns both server models and user-uploaded models
 */
app.get('/api/models/list', (req, res) => {
  try {
    const models = [];

    // Get server models
    if (fs.existsSync(SERVER_MODELS_DIR)) {
      const serverFiles = fs.readdirSync(SERVER_MODELS_DIR)
        .filter(file => path.extname(file).toLowerCase() === '.obj');

      serverFiles.forEach(file => {
        const stats = fs.statSync(path.join(SERVER_MODELS_DIR, file));
        const parsed = parseModelFilename(file);

        const modelInfo = {
          id: `server_${file}`,
          name: file.replace('.obj', ''),
          filename: file,
          type: 'server',
          url: `/models/server/${file}`,
          size: stats.size,
          createdAt: stats.birthtime,
          format: 'obj'
        };

        // Add parsed dimensions if available
        if (parsed) {
          if (parsed.isCap) {
            modelInfo.isCap = true;
            modelInfo.modelType = 'cap';
            modelInfo.description = 'Screw cap/top';
          } else {
            modelInfo.radius = parsed.radius;
            modelInfo.length = parsed.length;
            modelInfo.diameter = parsed.diameter;
            modelInfo.isCap = false;
            modelInfo.modelType = 'screw';
          }
        }

        models.push(modelInfo);
      });
    }

    // Get user-uploaded models
    if (fs.existsSync(USER_MODELS_DIR)) {
      const userFiles = fs.readdirSync(USER_MODELS_DIR)
        .filter(file => path.extname(file).toLowerCase() === '.obj');

      userFiles.forEach(file => {
        const stats = fs.statSync(path.join(USER_MODELS_DIR, file));
        models.push({
          id: `user_${file}`,
          name: file.replace(/^\d+_/, '').replace('.obj', ''), // Remove timestamp prefix
          filename: file,
          type: 'user',
          url: `/models/uploads/${file}`,
          size: stats.size,
          createdAt: stats.birthtime,
          format: 'obj'
        });
      });
    }

    res.json({
      success: true,
      count: models.length,
      models: models.sort((a, b) => b.createdAt - a.createdAt) // Sort by newest first
    });
  } catch (error) {
    console.error('Error listing models:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list models',
      message: error.message
    });
  }
});

/**
 * Query model by radius and length, or get screw cap
 * GET /api/models/query?radius=6.5&length=35
 * GET /api/models/query?type=cap
 */
app.get('/api/models/query', (req, res) => {
  try {
    console.log('───────────────────────────────────────────────────────');
    console.log('🔍 [Model Server] QUERY REQUEST RECEIVED');
    console.log('   Query params:', req.query);

    // Special case: query for screw cap
    if (req.query.type === 'cap') {
      console.log('   Type: Screw cap');
      const capModel = modelDictionary['cap'];

      if (capModel) {
        console.log('   ✅ Screw cap found in dictionary');
        res.json({
          success: true,
          found: true,
          model: capModel,
          query: { type: 'cap' }
        });
      } else {
        console.log('   ⚠️ Screw cap not in dictionary, checking filesystem...');
        // Check filesystem
        const capPath = path.join(SERVER_MODELS_DIR, SCREW_CAP_FILENAME);
        if (fs.existsSync(capPath)) {
          const stats = fs.statSync(capPath);
          const model = {
            filename: SCREW_CAP_FILENAME,
            radius: null,
            length: null,
            diameter: null,
            isCap: true,
            type: 'cap',
            url: `/models/server/${SCREW_CAP_FILENAME}`,
            size: stats.size,
            exists: true,
            description: 'Screw cap/top'
          };

          // Add to dictionary
          modelDictionary['cap'] = model;

          res.json({
            success: true,
            found: true,
            model: model,
            query: { type: 'cap' }
          });
        } else {
          res.json({
            success: true,
            found: false,
            expectedFilename: SCREW_CAP_FILENAME,
            query: { type: 'cap' },
            message: 'Screw cap model not found'
          });
        }
      }
      return;
    }

    // Regular query by radius and length
    const radius = parseFloat(req.query.radius);
    const length = parseFloat(req.query.length);

    console.log('   Type: Regular model query');
    console.log('   Radius:', radius);
    console.log('   Length:', length);

    if (isNaN(radius) || isNaN(length)) {
      console.log('   ❌ Invalid parameters');
      return res.status(400).json({
        success: false,
        error: 'Invalid radius or length parameters',
        message: 'Both radius and length must be valid numbers, or use type=cap for screw cap'
      });
    }

    // Generate expected filename
    const expectedFilename = generateModelFilename(radius, length);
    console.log('   Expected filename:', expectedFilename);

    // Check in dictionary
    const key = `${radius}_${length}`;
    console.log('   Dictionary key:', key);
    console.log('   Dictionary keys available:', Object.keys(modelDictionary));

    const modelInfo = modelDictionary[key];

    if (modelInfo) {
      console.log('   ✅ Model found in dictionary');
      console.log('   Model info:', modelInfo);
      res.json({
        success: true,
        found: true,
        model: modelInfo,
        query: { radius, length }
      });
    } else {
      console.log('   ⚠️ Model not in dictionary, checking filesystem...');
      // Check if file exists even if not in dictionary
      const filePath = path.join(SERVER_MODELS_DIR, expectedFilename);
      console.log('   File path:', filePath);

      const exists = fs.existsSync(filePath);
      console.log('   File exists:', exists);

      if (exists) {
        console.log('   ✅ Model found in filesystem');
        const stats = fs.statSync(filePath);
        const model = {
          filename: expectedFilename,
          radius: radius,
          length: length,
          diameter: radius * 2,
          isCap: false,
          type: 'screw',
          url: `/models/server/${expectedFilename}`,
          size: stats.size,
          exists: true
        };

        // Add to dictionary for future queries
        modelDictionary[key] = model;
        console.log('   ℹ️ Added to dictionary for future queries');

        res.json({
          success: true,
          found: true,
          model: model,
          query: { radius, length }
        });
      } else {
        console.log('   ❌ Model not found');
        console.log('   Directory contents:', fs.readdirSync(SERVER_MODELS_DIR).filter(f => f.endsWith('.obj')));

        // Generate fallback cylinder (in-memory)
        try {
          const cylinderCache = generateFallbackCylinder(radius, length);
          const cylinderModel = cylinderCache.modelInfo;

          console.log('   ✅ Returning generated cylinder as fallback');

          res.json({
            success: true,
            found: false,
            model: cylinderModel,
            query: { radius, length },
            message: 'Cylinder generated as replacement for actual thread model'
          });
        } catch (error) {
          console.error('   ❌ Error generating cylinder:', error);
          res.json({
            success: true,
            found: false,
            expectedFilename: expectedFilename,
            query: { radius, length },
            message: 'Model not found in server directory and cylinder generation failed',
            error: error.message
          });
        }
      }
    }
  } catch (error) {
    console.error('Error querying model:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to query model',
      message: error.message
    });
  }
});

/**
 * Get all available radius/length combinations
 * GET /api/models/dimensions
 */
app.get('/api/models/dimensions', (req, res) => {
  try {
    const dimensions = Object.values(modelDictionary).map(model => ({
      radius: model.radius,
      length: model.length,
      diameter: model.diameter,
      filename: model.filename,
      url: model.url
    }));

    // Group by radius
    const byRadius = {};
    dimensions.forEach(dim => {
      if (!byRadius[dim.radius]) {
        byRadius[dim.radius] = [];
      }
      byRadius[dim.radius].push(dim.length);
    });

    res.json({
      success: true,
      count: dimensions.length,
      dimensions: dimensions,
      byRadius: byRadius,
      availableRadii: Object.keys(byRadius).map(r => parseFloat(r)).sort((a, b) => a - b)
    });
  } catch (error) {
    console.error('Error getting dimensions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dimensions',
      message: error.message
    });
  }
});

/**
 * Serve generated cylinder OBJ file from cache
 * GET /api/models/cylinder/:radius/:lengthWithExt
 * Accepts both formats:
 *   - /api/models/cylinder/3.5/40 (without extension)
 *   - /api/models/cylinder/3.5/40.obj (with extension)
 */
app.get('/api/models/cylinder/:radius/:lengthWithExt', (req, res) => {
  try {
    console.log('🔧 [Cylinder Request] Params:', req.params);

    // Parse radius
    const radius = parseFloat(req.params.radius);

    // Parse length - remove .obj extension if present
    let lengthWithExt = req.params.lengthWithExt;
    const length = parseFloat(lengthWithExt.replace(/\.obj$/, ''));

    console.log(`   Parsed: radius=${radius}, length=${length}`);

    if (isNaN(radius) || isNaN(length)) {
      console.error('   ❌ Invalid parameters');
      return res.status(400).json({
        success: false,
        error: 'Invalid radius or length parameters',
        received: { radius: req.params.radius, lengthWithExt: req.params.lengthWithExt }
      });
    }

    const key = `${radius}_${length}`;

    // Check cache first
    let cylinderCache = generatedCylinderCache[key];

    // Generate if not in cache
    if (!cylinderCache) {
      console.log(`   🔧 Generating cylinder on-demand: radius=${radius}, length=${length}`);
      cylinderCache = generateFallbackCylinder(radius, length);
    } else {
      console.log(`   💾 Using cached cylinder: ${key}`);
    }

    // Serve the OBJ content
    res.set('Content-Type', 'text/plain');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET');
    res.send(cylinderCache.objContent);

    console.log(`   ✅ Cylinder served successfully (${cylinderCache.objContent.length} bytes)`);
  } catch (error) {
    console.error('   ❌ Error serving cylinder:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate cylinder',
      message: error.message
    });
  }
});

/**
 * Rebuild model dictionary
 * POST /api/models/rebuild-dictionary
 */
app.post('/api/models/rebuild-dictionary', (req, res) => {
  try {
    buildModelDictionary();
    res.json({
      success: true,
      message: 'Model dictionary rebuilt',
      count: Object.keys(modelDictionary).length,
      models: Object.values(modelDictionary)
    });
  } catch (error) {
    console.error('Error rebuilding dictionary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to rebuild dictionary',
      message: error.message
    });
  }
});

/**
 * Upload a new model
 */
app.post('/api/models/upload', upload.single('model'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const modelInfo = {
      success: true,
      model: {
        id: `user_${req.file.filename}`,
        name: req.file.originalname.replace('.obj', ''),
        filename: req.file.filename,
        type: 'user',
        url: `/models/uploads/${req.file.filename}`,
        size: req.file.size,
        format: 'obj',
        uploadedAt: new Date()
      }
    };

    console.log(`Model uploaded successfully: ${req.file.filename}`);
    res.json(modelInfo);
  } catch (error) {
    console.error('Error uploading model:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload model',
      message: error.message
    });
  }
});

/**
 * Delete a user-uploaded model
 */
app.delete('/api/models/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(USER_MODELS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Model not found'
      });
    }

    fs.unlinkSync(filePath);
    console.log(`Model deleted: ${filename}`);

    res.json({
      success: true,
      message: 'Model deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting model:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete model',
      message: error.message
    });
  }
});

/**
 * Serve static model files
 * This allows direct access to model files via URL
 */
app.use('/models/server', express.static(SERVER_MODELS_DIR, {
  setHeaders: (res, filepath) => {
    // Set appropriate CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Content-Type', 'text/plain'); // OBJ files are text
  }
}));

app.use('/models/uploads', express.static(USER_MODELS_DIR, {
  setHeaders: (res, filepath) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Content-Type', 'text/plain');
  }
}));

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    serverTime: new Date(),
    modelsDir: MODELS_DIR,
    serverModelsDir: SERVER_MODELS_DIR,
    userModelsDir: USER_MODELS_DIR,
    modelDictionaryCount: Object.keys(modelDictionary).length,
    generatedCylindersCached: Object.keys(generatedCylinderCache).length,
    vtkEnabled: vtkEnabled,
    cylinderGenerationMode: vtkEnabled ? 'VTK.js' : 'Manual'
  });
});

/**
 * Debug endpoint - get model dictionary
 */
app.get('/api/models/debug/dictionary', (req, res) => {
  res.json({
    success: true,
    count: Object.keys(modelDictionary).length,
    keys: Object.keys(modelDictionary),
    dictionary: modelDictionary
  });
});

/**
 * Debug endpoint - test cylinder URL parsing
 */
app.get('/api/models/debug/test-cylinder-parsing', (req, res) => {
  const testCases = [
    { url: '/api/models/cylinder/3.5/40', expectedRadius: 3.5, expectedLength: 40 },
    { url: '/api/models/cylinder/3.5/40.obj', expectedRadius: 3.5, expectedLength: 40 },
    { url: '/api/models/cylinder/6.5/35', expectedRadius: 6.5, expectedLength: 35 },
    { url: '/api/models/cylinder/6.5/35.obj', expectedRadius: 6.5, expectedLength: 35 }
  ];

  const results = testCases.map(test => {
    // Simulate parsing
    const parts = test.url.split('/');
    const radius = parseFloat(parts[4]);
    const lengthStr = parts[5];
    const length = parseFloat(lengthStr.replace(/\.obj$/, ''));

    return {
      url: test.url,
      expected: { radius: test.expectedRadius, length: test.expectedLength },
      parsed: { radius, length },
      success: radius === test.expectedRadius && length === test.expectedLength
    };
  });

  res.json({
    success: true,
    message: 'Cylinder URL parsing test',
    testResults: results,
    allPassed: results.every(r => r.success)
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    error: error.message
  });
});

// Start server
app.listen(PORT, () => {
  const vtkStatus = vtkEnabled ? 'VTK.js Enabled' : 'Manual Mode';
  console.log('=================================================');
  console.log(`3D Model Server Started (${vtkStatus})`);
  console.log('=================================================');
  console.log(`Server running on: http://localhost:${PORT}`);
  console.log(`Server models directory: ${SERVER_MODELS_DIR}`);
  console.log(`User uploads directory: ${USER_MODELS_DIR}`);
  console.log(`Model dictionary: ${Object.keys(modelDictionary).length} models indexed`);
  console.log('');
  console.log('Model Naming Convention:');
  console.log(`  Format: ${MODEL_PREFIX}{diameter}{length}.obj`);
  console.log(`  Example: ${MODEL_PREFIX}6535.obj (radius 3.25mm, length 35mm)`);
  console.log('');
  console.log('Cylinder Generation (In-Memory):');
  if (vtkEnabled) {
    console.log('  ✓ VTK.js vtkCylinderSource active');
    console.log('  ✓ High-quality procedural geometry');
  } else {
    console.log('  ⚠ VTK.js not available - using manual geometry');
    console.log('  ✓ Fallback manual cylinder generation active');
  }
  console.log('  ✓ Generated on-the-fly when models are not found');
  console.log('  ✓ Cached in memory for session lifetime');
  console.log('  ✓ No disk storage required for generated models');
  console.log('');
  console.log('Available endpoints:');
  console.log(`  GET  /api/models/list                      - List all models with dimensions`);
  console.log(`  GET  /api/models/query                     - Query by radius & length (?radius=6.5&length=35)`);
  console.log(`                                             - Query screw cap (?type=cap)`);
  console.log(`                                             - Auto-generates cylinder fallback if not found`);
  console.log(`  GET  /api/models/cylinder/:r/:l.obj        - Get generated cylinder OBJ (supports .obj extension)`);
  console.log(`  GET  /api/models/dimensions                - Get all available dimensions`);
  console.log(`  GET  /api/models/debug/dictionary          - View model dictionary (debug)`);
  console.log(`  GET  /api/models/debug/test-cylinder-parsing - Test cylinder URL parsing (debug)`);
  console.log(`  POST /api/models/rebuild-dictionary        - Rebuild model lookup dictionary`);
  console.log(`  POST /api/models/upload             - Upload new model`);
  console.log(`  DELETE /api/models/:filename        - Delete user model`);
  console.log(`  GET  /models/server/*               - Access server models`);
  console.log(`  GET  /models/uploads/*              - Access uploaded models`);
  console.log(`  GET  /api/health                    - Health check (shows cache & VTK stats)`);
  console.log('=================================================');
});

module.exports = app;
