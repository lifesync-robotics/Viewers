/**
 * ScrewManagementPanel Component
 *
 * Manages screw placements with viewport states and 3D models
 * - Save screw placements with radius, length, and transform data
 * - Restore screw placements (loads both viewport state and 3D model)
 * - Delete screws (removes both snapshot and 3D model)
 * - Import/Export screw data as JSON
 */

import React, { useState, useEffect } from 'react';
import { getRenderingEngine } from '@cornerstonejs/core';
import { crosshairsHandler } from './utils/crosshairsHandler';

export default function ScrewManagementPanel({ servicesManager }) {
  const { viewportStateService, modelStateService } = servicesManager.services;
  const [screws, setScrews] = useState([]);
  const [screwName, setScrewName] = useState('');
  const [radius, setRadius] = useState('');
  const [length, setLength] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    loadScrews();
  }, []);

  const loadScrews = () => {
    const allScrews = viewportStateService.getAllSnapshots();
    setScrews(allScrews);
  };

  /**
   * Construct screw transform matrix from viewport cameras and crosshair center
   *
   * Transform matrix structure (4x4 in row-major order):
   * - Column 0 [0:3, 0]: Axial plane normal (X-axis of screw coordinate system)
   * - Column 1 [0:3, 1]: Axial view up (Y-axis of screw coordinate system)
   * - Column 2 [0:3, 2]: Sagittal view normal (Z-axis of screw coordinate system)
   * - Column 3 [0:3, 3]: Crosshair center (translation/position)
   * - Row 3: [0, 0, 0, 1] (homogeneous coordinates)
   *
   * @returns Float32Array(16) - 4x4 transform matrix in row-major order, or null if data unavailable
   */
  const constructScrewTransform = () => {
    try {
      console.log('═══════════════════════════════════════════════════════');
      console.log('🔧 [ScrewManagement] CONSTRUCTING SCREW TRANSFORM');
      console.log('═══════════════════════════════════════════════════════');

      // Step 1: Clear cache and get fresh crosshair data
      console.log('🔄 Clearing crosshair cache to get fresh data...');
      crosshairsHandler.clearCache();

      // Get crosshair center (translation)
      const crosshairCenter = crosshairsHandler.getCrosshairCenter();

      console.log('📋 Crosshair center received:', crosshairCenter);

      if (!crosshairCenter) {
        console.warn('⚠️ Crosshair center is not available');
        console.warn('💡 Hint: Activate the crosshairs tool from the toolbar and position it');
        return null;
      }

      const translation = crosshairCenter;
      console.log('✅ Crosshair center (translation):', translation);

      // Step 2: Get rendering engine and viewports
      const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
      if (!renderingEngine) {
        console.error('❌ Rendering engine not found');
        return null;
      }

      // Step 3: Find axial and sagittal viewports
      let axialViewport = null;
      let sagittalViewport = null;
      let coronalViewport = null;

      const viewports = renderingEngine.getViewports();
      for (const vp of viewports) {
        const vpId = vp.id.toLowerCase();
        if (vpId.includes('axial')) {
          axialViewport = vp;
          console.log(`✅ Found axial viewport: ${vp.id}`);
        } else if (vpId.includes('sagittal')) {
          sagittalViewport = vp;
          console.log(`✅ Found sagittal viewport: ${vp.id}`);
        } else if (vpId.includes('coronal')) {
          coronalViewport = vp;
          console.log(`✅ Found coronal viewport: ${vp.id}`);
        }
      }

      if (!axialViewport || !sagittalViewport || !coronalViewport) {
        console.error('❌ Could not find required viewports (axial, sagittal, and coronal)');
        console.log('Available viewports:', viewports.map(vp => vp.id));
        return null;
      }

      // Step 4: Get camera data from viewports
      const axialCamera = axialViewport.getCamera();
      const sagittalCamera = sagittalViewport.getCamera();
      const coronalCamera = coronalViewport.getCamera();

      const axialNormal = axialCamera.viewPlaneNormal;
      const coronalNormal = [-coronalCamera.viewPlaneNormal[0], -coronalCamera.viewPlaneNormal[1], -coronalCamera.viewPlaneNormal[2]];
      const sagittalNormal = sagittalCamera.viewPlaneNormal;



      console.log('───────────────────────────────────────────────────────');
      console.log('📐 Camera vectors:');
      console.log('  Axial Normal (col 0):', axialNormal);
      console.log('  Coronal Normal (col 1, negated):', coronalNormal);
      console.log('  Sagittal Normal (col 2):', sagittalNormal);

      // Step 5: Construct 4x4 transform matrix in row-major order
      // Row-major layout for a 4x4 matrix:
      // [
      //   m00, m01, m02, m03,  <- Row 0
      //   m10, m11, m12, m13,  <- Row 1
      //   m20, m21, m22, m23,  <- Row 2
      //   m30, m31, m32, m33   <- Row 3
      // ]
      //
      // Where columns are:
      // Column 0 (m00, m10, m20, m30): Axial normal + 0
      // Column 1 (m01, m11, m21, m31): Axial up + 0
      // Column 2 (m02, m12, m22, m32): Sagittal normal + 0
      // Column 3 (m03, m13, m23, m33): Translation + 1

      const transform = new Float32Array([
        // Row 0: X-components of basis vectors + translation X
        axialNormal[0], coronalNormal[0], sagittalNormal[0], translation[0],

        // Row 1: Y-components of basis vectors + translation Y
        axialNormal[1], coronalNormal[1], sagittalNormal[1], translation[1],

        // Row 2: Z-components of basis vectors + translation Z
        axialNormal[2], coronalNormal[2], sagittalNormal[2], translation[2],

        // Row 3: Homogeneous coordinates
        0, 0, 0, 1
      ]);

      console.log('───────────────────────────────────────────────────────');
      console.log('✅ Transform matrix constructed (4x4 row-major):');
      console.log('  Row 0:', [transform[0], transform[1], transform[2], transform[3]]);
      console.log('  Row 1:', [transform[4], transform[5], transform[6], transform[7]]);
      console.log('  Row 2:', [transform[8], transform[9], transform[10], transform[11]]);
      console.log('  Row 3:', [transform[12], transform[13], transform[14], transform[15]]);
      console.log('═══════════════════════════════════════════════════════');

      return transform;

    } catch (error) {
      console.error('❌ Error constructing screw transform:', error);
      console.error('Stack:', error.stack);
      return null;
    }
  };

  const saveScrew = async () => {
    try {
      const name = screwName.trim() || `Screw ${new Date().toLocaleString()}`;
      const radiusValue = parseFloat(radius) || 0;
      const lengthValue = parseFloat(length) || 0;

      // Validate input - use defaults if invalid
      let finalRadiusValue = radiusValue;
      let finalLengthValue = lengthValue;

      if (radiusValue <= 0 || lengthValue <= 0) {
        console.warn('⚠️ Please enter valid radius and length values (must be greater than 0)');
        finalRadiusValue = 3.5;
        finalLengthValue = 40;
        console.log('Using default radius and length values: 3.5mm and 40mm');
      }

      // Construct screw transform from viewport cameras and crosshair center
      const transformMatrix = constructScrewTransform();

      if (!transformMatrix) {
        console.warn('⚠️ Could not construct transform matrix - crosshairs may not be active');
        console.warn('This usually means:');
        console.warn('- Crosshairs tool is not active');
        console.warn('- Required viewports (axial/sagittal) not found');
        console.warn('Proceeding to save without transform data');
      }

      // Convert Float32Array to regular array for JSON serialization
      const transform = transformMatrix ? Array.from(transformMatrix) : [];

      if (transform.length > 0) {
        console.log('✅ Screw transform captured from viewport cameras and crosshair center');
      } else {
        console.log('⚠️ Saving screw without transform data');
      }

      // ═════════════════════════════════════════════════════════
      // STEP 1: Load and position the model BEFORE saving
      // This ensures the model is visible and matches what will be restored
      // ═════════════════════════════════════════════════════════
      console.log('═══════════════════════════════════════════════════════');
      console.log('🔧 [ScrewManagement] LOADING MODEL BEFORE SAVE');
      console.log('═══════════════════════════════════════════════════════');

      // Check if we've reached the maximum number of models
      const existingModels = modelStateService.getAllModels();
      const maxModels = viewportStateService.getMaxSnapshots();

      if (existingModels.length >= maxModels) {
        console.warn(`⚠️ Maximum number of models (${maxModels}) reached. Cannot add more screws.`);
        alert(`Maximum of ${maxModels} screws reached. Please delete some screws before adding more.`);
        return;
      }

      console.log(`📊 Current models: ${existingModels.length}/${maxModels}`);

      // Query and load the model (same as restore does)
      // Models will coexist - no need to clear existing ones
      try {
        await viewportStateService.queryAndLoadModel(finalRadiusValue, finalLengthValue, transform);
        console.log(`✅ Model loaded and positioned successfully - Total: ${modelStateService.getAllModels().length}/${maxModels}`);
      } catch (modelError) {
        console.warn('⚠️ Could not load model before saving:', modelError.message);
        console.warn('⚠️ Continuing with save anyway...');
      }

      console.log('═══════════════════════════════════════════════════════');

      // ═════════════════════════════════════════════════════════
      // STEP 2: Save the screw snapshot with current viewport states
      // ═════════════════════════════════════════════════════════
      const screw = viewportStateService.saveSnapshot(name, finalRadiusValue, finalLengthValue, transform);

      setScrewName('');
      setRadius('');
      setLength('');
      loadScrews();

      console.log(`✅ Saved screw: "${screw.name}" (R: ${finalRadiusValue}mm, L: ${finalLengthValue}mm)`);

    } catch (error) {
      console.error('Failed to save screw:', error);
    }
  };

  const restoreScrew = async (name) => {
    try {
      setIsRestoring(true);

      // Check if we've reached the maximum number of models
      const existingModels = modelStateService.getAllModels();
      const maxModels = viewportStateService.getMaxSnapshots();

      if (existingModels.length >= maxModels) {
        console.warn(`⚠️ Maximum number of models (${maxModels}) reached. Cannot restore more screws.`);
        alert(`Maximum of ${maxModels} screws reached. Please delete some screws before restoring more.`);
        setIsRestoring(false);
        return;
      }

      console.log(`🔄 Restoring screw: "${name}" (${existingModels.length + 1}/${maxModels} models)`);

      // Restore the screw (viewport state + loads model)
      // Models will coexist - no need to clear existing ones
      await viewportStateService.restoreSnapshot(name);
      console.log(`✅ Restored screw: "${name}" - Total models: ${modelStateService.getAllModels().length}/${maxModels}`);

    } catch (error) {
      console.error('Failed to restore screw:', error);
    } finally {
      setIsRestoring(false);
    }
  };

  const deleteScrew = (name) => {
    try {
      // Get the screw data before deleting
      const screw = viewportStateService.getSnapshot(name);

      if (screw) {
        // Find and remove any models that match this screw's dimensions
        const loadedModels = modelStateService.getAllModels();
        let modelsRemoved = 0;

        for (const model of loadedModels) {
          // Check if this model matches the screw by checking its metadata or name
          // Since models loaded for screws have specific naming patterns
          const modelName = model.metadata.name.toLowerCase();
          const screwRadius = screw.radius || 0;
          const screwLength = screw.length || 0;

          // Check if model name contains the screw dimensions
          if (modelName.includes(`${screwRadius}`) || modelName.includes(`${screwLength}`)) {
            console.log(`🗑️ Removing model: ${model.metadata.id} (${model.metadata.name})`);
            modelStateService.removeModel(model.metadata.id);
            modelsRemoved++;
          }
        }

        if (modelsRemoved === 0) {
          // If no models found by name matching, remove all models as fallback
          // This ensures the UI stays clean
          console.log('⚠️ No models found by dimension matching, clearing all models');
          for (const model of loadedModels) {
            modelStateService.removeModel(model.metadata.id);
          }
        }

        console.log(`✅ Removed ${modelsRemoved > 0 ? modelsRemoved : loadedModels.length} model(s)`);
      }

      // Delete the screw snapshot
      viewportStateService.deleteSnapshot(name);
      loadScrews();

      console.log(`✅ Deleted screw: "${name}"`);

    } catch (error) {
      console.error('Error deleting screw:', error);
    }
  };

  const testCrosshairDetection = () => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🧪 [DEBUG] TESTING CROSSHAIR DETECTION');
    console.log('═══════════════════════════════════════════════════════');

    try {
      // Clear cache first
      crosshairsHandler.clearCache();
      console.log('✅ Cache cleared');

      // Get crosshair center (single shared center)
      const crosshairCenter = crosshairsHandler.getCrosshairCenter();

      console.log('📊 Crosshair Detection Results (Shared Center):');
      console.log('  - hasCenter:', !!crosshairCenter);
      console.log('  - center:', crosshairCenter);

      // Test with all MPR viewports (more reliable check)
      const mprData = crosshairsHandler.getAllMPRCrosshairCenters();
      console.log('📊 MPR Crosshair Centers (All Viewports):');

      let validViewportCount = 0;
      for (const [vpId, center] of Object.entries(mprData)) {
        console.log(`  ${vpId}:`, {
          center: center
        });
        if (center) {
          validViewportCount++;
        }
      }

      console.log(`📊 Valid viewports with crosshairs: ${validViewportCount}/${Object.keys(mprData).length}`);

      // Check rendering engines and viewports
      const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
      if (renderingEngine) {
        const viewports = renderingEngine.getViewports();
        console.log('📊 Available Viewports:', viewports.map(vp => ({
          id: vp.id,
          type: vp.type,
          element: !!vp.element
        })));
      } else {
        console.error('❌ Rendering engine not found');
      }

      // Log result to console
      if (crosshairCenter) {
        console.log('✅ Crosshairs Detected!');
        console.log(`Position: [${crosshairCenter[0].toFixed(2)}, ${crosshairCenter[1].toFixed(2)}, ${crosshairCenter[2].toFixed(2)}]`);
        console.log('Check browser console (F12) for detailed information.');
      } else {
        console.warn('❌ Crosshairs Not Detected');
        console.warn('The crosshairs tool may not be active or position data is unavailable.');
        console.warn('How to activate:');
        console.warn('1. Click the crosshairs icon in the toolbar');
        console.warn('2. Click and drag in any viewport');
        console.warn('3. Try this test again');
      }

      console.log('═══════════════════════════════════════════════════════');

    } catch (error) {
      console.error('❌ Error testing crosshair detection:', error);
      console.error('Stack:', error.stack);
    }
  };

  const clearAllScrews = () => {
    try {
      // Clear all models first
      console.log('🗑️ Clearing all 3D models...');
      modelStateService.clearAllModels();

      // Clear all screws
      viewportStateService.clearAll();
      loadScrews();

      console.log('✅ All screws and models cleared');
    } catch (error) {
      console.error('Error clearing all screws:', error);
    }
  };

  const exportToJSON = () => {
    try {
      if (screws.length === 0) {
        console.warn('⚠️ No screws to export');
        return;
      }

      // Get JSON from service
      const jsonString = viewportStateService.exportJSON();

      // Create blob and download
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `screw-placements-${timestamp}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log(`✅ Exported ${screws.length} screws to: ${filename}`);

    } catch (error) {
      console.error('Failed to export:', error);
    }
  };

  const importFromJSON = () => {
    try {
      // Create file input element
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';

      input.onchange = async (e) => {
        try {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return;

          // Use the file loading method
          viewportStateService.loadSnapshotsFromFile(file)
            .then((count) => {
              // Reload screws in UI
              loadScrews();
              console.log(`✅ Successfully imported ${count} screws from: ${file.name}`);
            })
            .catch((error) => {
              console.error('Failed to import:', error);
            });

        } catch (error) {
          console.error('Failed to process file:', error);
        }
      };

      // Trigger file selection
      input.click();

    } catch (error) {
      console.error('Failed to import:', error);
    }
  };

  const maxScrews = viewportStateService.getMaxSnapshots();
  const remainingSlots = viewportStateService.getRemainingSlots();

  return (
    <div className="p-4 space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">🔩 Screw Management</h2>
        <div className="flex gap-1">
          <button
            onClick={testCrosshairDetection}
            className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-base"
            title="Test Crosshair Detection"
          >
            🧪
          </button>
          <button
            onClick={importFromJSON}
            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-base"
            title="Import Screw Placements"
          >
            📤
          </button>
          {screws.length > 0 && (
            <>
              <button
                onClick={exportToJSON}
                className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-base"
                title="Export All Screws"
              >
                📥
              </button>
              <button
                onClick={clearAllScrews}
                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-base"
                title="Clear All Screws"
              >
                🧹
              </button>
            </>
          )}
        </div>
      </div>

      {/* Save Section */}
      <div className="space-y-2 border border-blue-600 rounded p-3 bg-blue-900 bg-opacity-20">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-sm">💾 Save Screw Placement</h3>
          <span className="text-xs text-gray-400">
            {remainingSlots} / {maxScrews} slots remaining
          </span>
        </div>
        <input
          type="text"
          placeholder="Screw name (optional)"
          value={screwName}
          onChange={(e) => setScrewName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && saveScrew()}
          className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Radius (mm) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              placeholder="e.g., 2.0"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              step="0.1"
              min="0.1"
              className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Length (mm) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              placeholder="e.g., 40.0"
              value={length}
              onChange={(e) => setLength(e.target.value)}
              step="0.1"
              min="0.1"
              className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <button
          onClick={saveScrew}
          disabled={remainingSlots === 0}
          className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded font-bold text-sm transition disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          🔩 Save Screw Placement
        </button>
        {remainingSlots === 0 && (
          <p className="text-xs text-red-400">
            ⚠️ Maximum screws reached. Delete old screws or oldest will be removed.
          </p>
        )}
        <p className="text-xs text-gray-400">
          💡 Saves current viewport state, screw dimensions, and model transform
        </p>
      </div>

      {/* Screws List */}
      <div className="flex-1 flex flex-col min-h-0">
        <h3 className="font-bold text-white text-sm mb-2">
          📋 Saved Screws ({screws.length} / {maxScrews})
        </h3>

        <div className="flex-1 overflow-y-auto space-y-2">
          {screws.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">No screws saved yet</p>
              <p className="text-gray-600 text-xs mt-2">
                Enter radius and length, then click "Save Screw Placement"
              </p>
            </div>
          ) : (
            screws.map((screw) => (
              <div
                key={screw.name}
                className="border border-gray-700 rounded p-3 hover:border-blue-500 transition bg-gray-800 bg-opacity-50"
              >
                <div className="flex justify-between items-start gap-2">
                  {/* Screw Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🔩</span>
                      <p className="font-medium text-sm text-white truncate" title={screw.name}>
                        {screw.name}
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">
                      {new Date(screw.timestamp).toLocaleString()}
                    </p>
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="inline-block px-2 py-1 bg-blue-900 bg-opacity-50 border border-blue-700 rounded text-xs text-blue-300 font-semibold">
                        ⌀ {(screw.radius * 2)?.toFixed(1) ?? 0} mm
                      </span>
                      <span className="inline-block px-2 py-1 bg-green-900 bg-opacity-50 border border-green-700 rounded text-xs text-green-300 font-semibold">
                        ↕ {screw.length?.toFixed(1) ?? 0} mm
                      </span>
                      <span className="inline-block px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-400">
                        {screw.viewports.length} views
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => restoreScrew(screw.name)}
                      disabled={isRestoring}
                      className="px-2 py-2 bg-blue-600 hover:bg-blue-700 text-white text-base rounded transition disabled:bg-gray-600 disabled:cursor-not-allowed"
                      title={`Load "${screw.name}"`}
                    >
                      {isRestoring ? '⏳' : '🔄'}
                    </button>
                    <button
                      onClick={() => deleteScrew(screw.name)}
                      className="px-2 py-2 bg-red-600 hover:bg-red-700 text-white text-base rounded transition"
                      title={`Delete "${screw.name}"`}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Info Footer */}
      <div className="text-xs text-gray-500 border-t border-gray-700 pt-2 space-y-1">
        <p>💡 <strong>Save:</strong> Captures current viewport state and screw dimensions</p>
        <p>💡 <strong>Load:</strong> Restores viewport state and loads matching 3D model</p>
        <p>💡 <strong>Delete:</strong> Removes screw placement AND associated 3D model</p>
        <p>💡 <strong>Limit:</strong> Maximum {maxScrews} screws (oldest auto-removed when full)</p>
      </div>
    </div>
  );
}
