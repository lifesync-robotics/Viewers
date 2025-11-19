import React, { useState, useEffect } from 'react';

export default function ViewportStatePanel({ servicesManager }) {
  const { viewportStateService } = servicesManager.services;
  const [snapshots, setSnapshots] = useState([]);
  const [snapshotName, setSnapshotName] = useState('');
  const [radius, setRadius] = useState('');
  const [length, setLength] = useState('');

  useEffect(() => {
    loadSnapshots();
  }, []);

  const loadSnapshots = () => {
    const allSnapshots = viewportStateService.getAllSnapshots();
    setSnapshots(allSnapshots);
  };

  const saveSnapshot = () => {
    try {
      const name = snapshotName.trim() || `Snapshot ${new Date().toLocaleString()}`;
      const radiusValue = parseFloat(radius) || 0;
      const lengthValue = parseFloat(length) || 0;

      // Save snapshot with radius and length (service ensures unique name)
      const snapshot = viewportStateService.saveSnapshot(name, radiusValue, lengthValue);

      setSnapshotName('');
      setRadius('');
      setLength('');
      loadSnapshots();

      console.log(`✅ Saved: "${snapshot.name}" with ${snapshot.viewports.length} viewports (radius: ${radiusValue}, length: ${lengthValue})`);

    } catch (error) {
      console.error('Failed to save:', error);
      alert(`❌ ${error.message}`);
    }
  };

  const restoreSnapshot = async (name) => {
    try {
      await viewportStateService.restoreSnapshot(name);
      console.log(`✅ Restored: "${name}"`);

    } catch (error) {
      console.error('Failed to restore:', error);
      alert(`❌ ${error.message}`);
    }
  };

  const deleteSnapshot = (name) => {
    if (confirm(`Delete snapshot "${name}"?`)) {
      viewportStateService.deleteSnapshot(name);
      loadSnapshots();
    }
  };

  const clearAll = () => {
    if (confirm('⚠️ Delete all snapshots? This cannot be undone.')) {
      viewportStateService.clearAll();
      loadSnapshots();
    }
  };

  const exportToJSON = () => {
    try {
      if (snapshots.length === 0) {
        alert('⚠️ No snapshots to export');
        return;
      }

      // Get JSON from service
      const jsonString = viewportStateService.exportJSON();

      // Create blob and download
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `viewport-snapshots-${timestamp}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log(`✅ Exported ${snapshots.length} snapshots to: ${filename}`);
      console.log(`📁 Full download path: ${window.location.origin}/${filename} (check your Downloads folder)`);

    } catch (error) {
      console.error('Failed to export:', error);
      alert(`❌ Export failed: ${error.message}`);
    }
  };

  const maxSnapshots = viewportStateService.getMaxSnapshots();

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

          // Use the new file loading method that handles both formats
          viewportStateService.loadSnapshotsFromFile(file)
            .then((count) => {
              // Reload snapshots in UI
              loadSnapshots();
              alert(`✅ Successfully imported ${count} snapshots from: ${file.name}`);
              console.log(`✅ Successfully imported ${count} snapshots from: ${file.name}`);
              console.log(`📁 Full file path: ${file.name}`);
            })
            .catch((error) => {
              console.error('Failed to import:', error);
              alert(`❌ Import failed: ${error.message}`);
            });

        } catch (error) {
          console.error('Failed to process file:', error);
          alert(`❌ Failed to process file: ${error.message}`);
        }
      };

      // Trigger file selection
      input.click();

    } catch (error) {
      console.error('Failed to import:', error);
      alert(`❌ Import failed: ${error.message}`);
    }
  };

  const remainingSlots = viewportStateService.getRemainingSlots();

  return (
    <div className="p-4 space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Viewport Snapshots</h2>
        <div className="flex gap-2">
          <button
            onClick={importFromJSON}
            className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
            title="Import snapshots from JSON file"
          >
            📤 Import JSON
          </button>
          {snapshots.length > 0 && (
            <>
              <button
                onClick={exportToJSON}
                className="text-xs px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded"
                title="Export all snapshots to JSON file"
              >
                📥 Export JSON
              </button>
              <button
                onClick={clearAll}
                className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
                title="Clear all snapshots"
              >
                🧹 Clear All
              </button>
            </>
          )}
        </div>
      </div>

      {/* Save Section */}
      <div className="space-y-2 border border-blue-600 rounded p-3 bg-blue-900 bg-opacity-20">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-sm">💾 Save Current State</h3>
          <span className="text-xs text-gray-400">
            {remainingSlots} / {maxSnapshots} slots remaining
          </span>
        </div>
        <input
          type="text"
          placeholder="Snapshot name (optional)"
          value={snapshotName}
          onChange={(e) => setSnapshotName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && saveSnapshot()}
          className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Radius (mm)</label>
            <input
              type="number"
              placeholder="0"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              step="0.1"
              min="0"
              className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Length (mm)</label>
            <input
              type="number"
              placeholder="0"
              value={length}
              onChange={(e) => setLength(e.target.value)}
              step="0.1"
              min="0"
              className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <button
          onClick={saveSnapshot}
          disabled={remainingSlots === 0}
          className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded font-bold text-sm transition disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          💾 Save All Viewports
        </button>
        {remainingSlots === 0 && (
          <p className="text-xs text-red-400">
            ⚠️ Snapshot limit reached. Delete old snapshots or oldest will be removed.
          </p>
        )}
        <p className="text-xs text-gray-400">
          Saves all orthographic viewports with radius and length metadata
        </p>
      </div>

      {/* Snapshots List */}
      <div className="flex-1 flex flex-col min-h-0">
        <h3 className="font-bold text-white text-sm mb-2">
          📋 Saved Snapshots ({snapshots.length} / {maxSnapshots})
        </h3>

        <div className="flex-1 overflow-y-auto space-y-2">
          {snapshots.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">No snapshots saved yet</p>
              <p className="text-gray-600 text-xs mt-2">
                Click "Save All Viewports" to create your first snapshot
              </p>
            </div>
          ) : (
            snapshots.map((snapshot) => (
              <div
                key={snapshot.name}
                className="border border-gray-700 rounded p-3 hover:border-gray-600 transition"
              >
                <div className="flex justify-between items-start gap-2">
                  {/* Snapshot Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-white truncate mb-1" title={snapshot.name}>
                      {snapshot.name}
                    </p>
                    <p className="text-xs text-gray-400 mb-1">
                      {new Date(snapshot.timestamp).toLocaleString()}
                    </p>
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="inline-block px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300">
                        {snapshot.viewports.length} viewports
                      </span>
                      {(snapshot.radius > 0 || snapshot.length > 0) && (
                        <>
                          <span className="inline-block px-2 py-0.5 bg-blue-900 rounded text-xs text-blue-300">
                            📏 R: {snapshot.radius?.toFixed(1) ?? 0} mm
                          </span>
                          <span className="inline-block px-2 py-0.5 bg-green-900 rounded text-xs text-green-300">
                            📐 L: {snapshot.length?.toFixed(1) ?? 0} mm
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => restoreSnapshot(snapshot.name)}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition"
                      title={`Restore "${snapshot.name}"`}
                    >
                      🔄 Restore
                    </button>
                    <button
                      onClick={() => deleteSnapshot(snapshot.name)}
                      className="px-2 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition"
                      title="Delete this snapshot"
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
        <p>💡 <strong>Save:</strong> Captures current state of all 3 viewports</p>
        <p>💡 <strong>Restore:</strong> Click 🔄 to restore any saved snapshot</p>
        <p>💡 <strong>Limit:</strong> Maximum {maxSnapshots} snapshots (oldest auto-removed)</p>
      </div>
    </div>
  );
}
