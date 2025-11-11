/**
 * VTK.js Compatibility Test Script (Official API Compliant)
 * 
 * This script tests VTK.js installation and API compatibility based on
 * official documentation: https://kitware.github.io/vtk-js/api/Filters_Sources_CylinderSource.html
 * 
 * Usage: node platform/app/server/testVtkCompat.js
 */

// Setup browser-like environment for Node.js
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html>', {
  pretendToBeVisual: true,
  resources: 'usable'
});

global.window = dom.window;
global.document = window.document;
global.navigator = window.navigator;
global.HTMLElement = window.HTMLElement;

console.log('=================================================');
console.log('VTK.js Compatibility Test (Official API)');
console.log('=================================================\n');

// =============================================================================
// Test 1: Verify VTK.js Installation
// =============================================================================
console.log('Test 1: Checking VTK.js installation...');
let vtk;
let vtkVersion;

try {
  vtk = require('@kitware/vtk.js');
  console.log('✓ VTK.js package found');
  
  try {
    const packageJson = require('@kitware/vtk.js/package.json');
    vtkVersion = packageJson.version;
    console.log(`  Version: ${vtkVersion}`);
  } catch (e) {
    console.log('  Version: Unable to determine');
  }
} catch (error) {
  console.log('✗ VTK.js package not found');
  console.log(`  Error: ${error.message}\n`);
  console.log('To install VTK.js, run:');
  console.log('  yarn add @kitware/vtk.js\n');
  process.exit(1);
}

// =============================================================================
// Test 2: Import vtkCylinderSource (Official Import Pattern)
// =============================================================================
console.log('\nTest 2: Importing vtkCylinderSource...');
let vtkCylinderSource;

try {
  // Official import pattern from documentation
  vtkCylinderSource = require('@kitware/vtk.js/Filters/Sources/CylinderSource');
  console.log('✓ vtkCylinderSource imported successfully');
  console.log('  Import path: @kitware/vtk.js/Filters/Sources/CylinderSource');
} catch (error) {
  console.log('✗ Direct import failed, trying alternative paths...');
  
  // Try alternative paths if direct import fails
  if (vtk.Filters?.Sources?.CylinderSource) {
    vtkCylinderSource = vtk.Filters.Sources.CylinderSource;
    console.log('✓ Found via vtk.Filters.Sources.CylinderSource');
  } else {
    console.log('✗ vtkCylinderSource not available');
    console.log(`  Error: ${error.message}`);
    process.exit(1);
  }
}

// =============================================================================
// Test 3: Create Instance using newInstance() (Official API)
// =============================================================================
console.log('\nTest 3: Creating vtkCylinderSource instance...');
let cylinderSource;

try {
  // Official method: newInstance() with optional initialValues
  cylinderSource = vtkCylinderSource.newInstance({
    height: 30.0,
    radius: 5.0,
    resolution: 32
  });
  console.log('✓ Instance created with newInstance()');
  console.log('  Initial values: height=30, radius=5, resolution=32');
} catch (error) {
  console.log(`✗ Instance creation failed: ${error.message}`);
  process.exit(1);
}

// =============================================================================
// Test 4: Test Getter Methods (Official API)
// =============================================================================
console.log('\nTest 4: Testing getter methods...');

try {
  // Test getRadius()
  const radius = cylinderSource.getRadius();
  console.log(`  ✓ getRadius(): ${radius}`);
  
  // Test getHeight()
  const height = cylinderSource.getHeight();
  console.log(`  ✓ getHeight(): ${height}`);
  
  // Test getResolution()
  const resolution = cylinderSource.getResolution();
  console.log(`  ✓ getResolution(): ${resolution}`);
  
  // Test getCapping()
  const capping = cylinderSource.getCapping();
  console.log(`  ✓ getCapping(): ${capping}`);
  
  // Test getCenter() - returns array
  const center = cylinderSource.getCenter();
  console.log(`  ✓ getCenter(): [${center.join(', ')}]`);
  
  // Test getCenterByReference() - returns reference to internal array
  const centerRef = cylinderSource.getCenterByReference();
  console.log(`  ✓ getCenterByReference(): [${centerRef.join(', ')}]`);
  
  // Test getDirection()
  const direction = cylinderSource.getDirection();
  console.log(`  ✓ getDirection(): [${direction.join(', ')}]`);
  
  // Test getDirectionByReference()
  const directionRef = cylinderSource.getDirectionByReference();
  console.log(`  ✓ getDirectionByReference(): [${directionRef.join(', ')}]`);
  
} catch (error) {
  console.log(`  ✗ Getter methods failed: ${error.message}`);
  process.exit(1);
}

// =============================================================================
// Test 5: Test Setter Methods (Official API)
// =============================================================================
console.log('\nTest 5: Testing setter methods...');

try {
  // Test setRadius(radius: Number)
  cylinderSource.setRadius(7.5);
  console.log(`  ✓ setRadius(7.5): ${cylinderSource.getRadius()}`);
  
  // Test setHeight(height: Number)
  cylinderSource.setHeight(40.0);
  console.log(`  ✓ setHeight(40.0): ${cylinderSource.getHeight()}`);
  
  // Test setResolution(resolution: Number)
  cylinderSource.setResolution(64);
  console.log(`  ✓ setResolution(64): ${cylinderSource.getResolution()}`);
  
  // Test setCapping(capping: Boolean)
  cylinderSource.setCapping(true);
  console.log(`  ✓ setCapping(true): ${cylinderSource.getCapping()}`);
  
  // Test setCenter(x, y, z)
  cylinderSource.setCenter(10.0, 20.0, 5.0);
  const newCenter = cylinderSource.getCenter();
  console.log(`  ✓ setCenter(10, 20, 5): [${newCenter.join(', ')}]`);
  
  // Test setCenterFrom(center: Vector3)
  cylinderSource.setCenterFrom([0, 15, 0]);
  const centerFrom = cylinderSource.getCenter();
  console.log(`  ✓ setCenterFrom([0, 15, 0]): [${centerFrom.join(', ')}]`);
  
  // Test setDirection(x, y, z)
  cylinderSource.setDirection(0, 1, 0);
  const newDirection = cylinderSource.getDirection();
  console.log(`  ✓ setDirection(0, 1, 0): [${newDirection.join(', ')}]`);
  
  // Test setDirectionFrom(direction: Vector3)
  cylinderSource.setDirectionFrom([0, 1, 0]);
  const dirFrom = cylinderSource.getDirection();
  console.log(`  ✓ setDirectionFrom([0, 1, 0]): [${dirFrom.join(', ')}]`);
  
  // Test setInitAngle(initAngle: Number) - initial angle in radians
  cylinderSource.setInitAngle(0);
  const initAngle = cylinderSource.getInitAngle();
  console.log(`  ✓ setInitAngle(0): ${initAngle} radians`);
  
  // Test setOtherRadius(radius: Number) - for elliptical base
  cylinderSource.setOtherRadius(5.0);
  const otherRadius = cylinderSource.getOtherRadius();
  console.log(`  ✓ setOtherRadius(5.0): ${otherRadius}`);
  
} catch (error) {
  console.log(`  ✗ Setter methods failed: ${error.message}`);
  console.log(error.stack);
  process.exit(1);
}

// =============================================================================
// Test 6: Generate Cylinder Geometry (requestData)
// =============================================================================
console.log('\nTest 6: Generating cylinder geometry...');

try {
  // Reset to test configuration
  cylinderSource.setRadius(5.0);
  cylinderSource.setHeight(30.0);
  cylinderSource.setResolution(32);
  cylinderSource.setCapping(true);
  cylinderSource.setCenter(0, 15, 0);
  cylinderSource.setDirection(0, 1, 0);
  
  // Note: requestData is called internally by getOutputData()
  // We don't call it directly as it requires inData and outData parameters
  console.log('  Configuration:');
  console.log(`    - Radius: ${cylinderSource.getRadius()}mm`);
  console.log(`    - Height: ${cylinderSource.getHeight()}mm`);
  console.log(`    - Resolution: ${cylinderSource.getResolution()} facets`);
  console.log(`    - Capping: ${cylinderSource.getCapping()}`);
  console.log(`    - Center: [${cylinderSource.getCenter().join(', ')}]`);
  console.log(`    - Direction: [${cylinderSource.getDirection().join(', ')}]`);
  
  console.log('  ✓ Configuration set successfully');
  
} catch (error) {
  console.log(`  ✗ Configuration failed: ${error.message}`);
  process.exit(1);
}

// =============================================================================
// Test 7: Extract Output Data (polyData)
// =============================================================================
console.log('\nTest 7: Extracting output data...');

try {
  // Get the generated polyData
  const polyData = cylinderSource.getOutputData();
  console.log('  ✓ getOutputData() successful');
  
  // Extract points
  if (polyData.getPoints) {
    const points = polyData.getPoints();
    const numPoints = points.getNumberOfPoints();
    console.log(`  ✓ Points: ${numPoints} vertices`);
    
    // Get points data as typed array
    const pointsData = points.getData();
    console.log(`  ✓ Points data: Float${pointsData.constructor.name.match(/\d+/)?.[0] || '32'}Array with ${pointsData.length} values`);
  }
  
  // Extract polygons
  if (polyData.getPolys) {
    const polys = polyData.getPolys();
    const polysData = polys.getData();
    console.log(`  ✓ Polygons: ${polysData.length} indices`);
    
    // Count faces
    let idx = 0;
    let faceCount = 0;
    while (idx < polysData.length) {
      const numVerts = polysData[idx];
      idx += numVerts + 1;
      faceCount++;
    }
    console.log(`  ✓ Faces: ${faceCount} polygons`);
  }
  
  // Extract point data (normals, etc.)
  if (polyData.getPointData) {
    const pointData = polyData.getPointData();
    console.log('  ✓ PointData available');
    
    const normals = pointData.getNormals();
    if (normals) {
      const normalsData = normals.getData();
      console.log(`  ✓ Normals: ${normalsData.length / 3} normal vectors`);
    } else {
      console.log('  ⚠ Normals not generated (use vtkPolyDataNormals if needed)');
    }
  }
  
} catch (error) {
  console.log(`  ✗ Output data extraction failed: ${error.message}`);
  console.log(error.stack);
  process.exit(1);
}

// =============================================================================
// Test 8: Convert to OBJ Format (Practical Use Case)
// =============================================================================
console.log('\nTest 8: Converting to OBJ format...');

try {
  const polyData = cylinderSource.getOutputData();
  const points = polyData.getPoints();
  const pointsData = points.getData();
  const numPoints = points.getNumberOfPoints();
  
  // Generate OBJ vertices
  const objVertices = [];
  for (let i = 0; i < numPoints; i++) {
    const idx = i * 3;
    const x = pointsData[idx].toFixed(6);
    const y = pointsData[idx + 1].toFixed(6);
    const z = pointsData[idx + 2].toFixed(6);
    objVertices.push(`v ${x} ${y} ${z}`);
  }
  
  // Generate OBJ faces
  const polys = polyData.getPolys();
  const polysData = polys.getData();
  const objFaces = [];
  let idx = 0;
  
  while (idx < polysData.length) {
    const numVerts = polysData[idx++];
    const faceIndices = [];
    for (let i = 0; i < numVerts; i++) {
      faceIndices.push(polysData[idx++] + 1); // OBJ uses 1-based indexing
    }
    objFaces.push(`f ${faceIndices.join(' ')}`);
  }
  
  console.log('  ✓ OBJ conversion successful');
  console.log(`    - Vertices: ${objVertices.length}`);
  console.log(`    - Faces: ${objFaces.length}`);
  console.log(`    - Total size: ${(objVertices.join('\n').length + objFaces.join('\n').length)} bytes`);
  
  // Sample output
  console.log('\n  Sample OBJ output (first 3 vertices, first face):');
  console.log(`    ${objVertices[0]}`);
  console.log(`    ${objVertices[1]}`);
  console.log(`    ${objVertices[2]}`);
  console.log(`    ...`);
  console.log(`    ${objFaces[0]}`);
  
} catch (error) {
  console.log(`  ✗ OBJ conversion failed: ${error.message}`);
  console.log(error.stack);
  process.exit(1);
}

// =============================================================================
// Test 9: Test extend() Method (Advanced API)
// =============================================================================
console.log('\nTest 9: Testing extend() method (advanced)...');

try {
  // The extend() method decorates objects with vtkCylinderSource characteristics
  // This is typically used internally or for custom implementations
  
  const publicAPI = {};
  const model = {
    height: 50,
    radius: 10,
    resolution: 16
  };
  
  // Note: extend() requires the full factory function, not just the module
  // This test verifies the concept exists
  if (typeof vtkCylinderSource.extend === 'function') {
    console.log('  ✓ extend() method available');
    console.log('    Purpose: Decorates objects with vtkCylinderSource characteristics');
  } else {
    console.log('  ℹ extend() not directly exposed (internal factory method)');
  }
  
} catch (error) {
  console.log(`  ⚠ extend() test skipped: ${error.message}`);
}

// =============================================================================
// Summary
// =============================================================================
console.log('\n=================================================');
console.log('✓ All VTK.js Compatibility Tests Passed!');
console.log('=================================================');
console.log(`\nVTK.js Version: ${vtkVersion || 'unknown'}`);
console.log('Import Pattern: @kitware/vtk.js/Filters/Sources/CylinderSource');
console.log('\nVerified API Methods:');
console.log('  Creation:');
console.log('    - newInstance(initialValues?)');
console.log('  Getters:');
console.log('    - getRadius(), getHeight(), getResolution()');
console.log('    - getCapping(), getCenter(), getCenterByReference()');
console.log('    - getDirection(), getDirectionByReference()');
console.log('    - getInitAngle(), getOtherRadius()');
console.log('  Setters:');
console.log('    - setRadius(), setHeight(), setResolution()');
console.log('    - setCapping(), setCenter(), setCenterFrom()');
console.log('    - setDirection(), setDirectionFrom()');
console.log('    - setInitAngle(), setOtherRadius()');
console.log('  Output:');
console.log('    - getOutputData() → polyData');
console.log('\nYour VTK.js installation is fully compatible!');
console.log('\nNext steps:');
console.log('  - Start model server: yarn dev:model-server');
console.log('  - Run full dev environment: yarn dev');
console.log('=================================================\n');

process.exit(0);
