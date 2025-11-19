/**
 * Screw Selection Dialog
 *
 * Comprehensive dialog for selecting screws from catalog or creating custom screws
 * Features:
 * - Manufacturer filtering
 * - Left panel: Custom screw dimensions
 * - Right panel: Catalog screw selection with dropdowns
 */

import React, { useState, useEffect } from 'react';

interface ScrewVariant {
  id: string;
  diameter: number;
  length: number;
  material: string;
  thread_pitch: number;
  head_type: string;
  tulip_diameter: number;
  obj_file_path: string;
  specifications: {
    break_off_torque: number;
    cannulated: boolean;
    inner_diameter: number;
    compatible_rod_diameters: number[];
  };
}

interface ScrewType {
  id: string;
  name: string;
  variants: ScrewVariant[];
}

interface Manufacturer {
  id: string;
  name: string;
  screw_types: ScrewType[];
}

interface CatalogData {
  manufacturers: Manufacturer[];
  total_variants: number;
}

interface ScrewSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectScrew: (screwData: {
    name: string;
    radius: number;
    length: number;
    source: 'custom' | 'catalog';
    variantId?: string;
    manufacturer?: string;
    screwType?: string;
  }) => void;
}

const ScrewSelectionDialog: React.FC<ScrewSelectionDialogProps> = ({
  isOpen,
  onClose,
  onSelectScrew,
}) => {
  // Selection mode
  const [selectionMode, setSelectionMode] = useState<'custom' | 'catalog'>('custom');

  // Common screw label field (used by both custom and catalog)
  const [screwLabel, setScrewLabel] = useState('');

  // Custom screw state with defaults
  const [customRadius, setCustomRadius] = useState('3.5');
  const [customLength, setCustomLength] = useState('40');

  // Catalog state
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('');
  const [selectedScrewType, setSelectedScrewType] = useState<string>('');
  const [selectedVariant, setSelectedVariant] = useState<string>('');
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Derived data
  const currentManufacturer = manufacturers.find(m => m.id === selectedManufacturer);
  const currentScrewType = currentManufacturer?.screw_types.find(st => st.id === selectedScrewType);
  const currentVariant = currentScrewType?.variants.find(v => v.id === selectedVariant);

  // Load catalog on mount or when manufacturer changes
  useEffect(() => {
    if (isOpen) {
      loadCatalog();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedManufacturer) {
      loadCatalog(selectedManufacturer);
      // Reset selections
      setSelectedScrewType('');
      setSelectedVariant('');
    }
  }, [selectedManufacturer]);

  const loadCatalog = async (manufacturer?: string) => {
    try {
      setIsLoadingCatalog(true);
      setCatalogError(null);

      const url = manufacturer
        ? `http://localhost:3001/api/planning/catalog/screws?manufacturer=${manufacturer}`
        : 'http://localhost:3001/api/planning/catalog/screws';

      console.log('📦 Loading screw catalog:', url);

      const response = await fetch(url);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load catalog');
      }

      setManufacturers(data.manufacturers || []);
      console.log(`✅ Loaded ${data.total_variants} screw variants from ${data.manufacturers?.length || 0} manufacturers`);
    } catch (error) {
      console.error('❌ Error loading catalog:', error);
      setCatalogError(error.message);
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const handleSelectCustom = () => {
    const radius = parseFloat(customRadius);
    const length = parseFloat(customLength);

    if (!customRadius || !customLength || isNaN(radius) || isNaN(length) || radius <= 0 || length <= 0) {
      alert('⚠️ Please enter valid radius and length values.\n\nBoth must be positive numbers greater than 0.');
      return;
    }

    const label = screwLabel.trim() || `Custom ${radius * 2}mm × ${length}mm`;

    onSelectScrew({
      name: label,  // Pass as 'name' for now, will be converted to screwLabel in parent
      radius,
      length,
      source: 'custom',
    });

    // Reset and close
    resetForm();
    onClose();
  };

  const handleSelectCatalog = () => {
    if (!currentVariant || !currentManufacturer || !currentScrewType) {
      alert('⚠️ Please select a screw from the catalog.');
      return;
    }

    const radius = currentVariant.diameter / 2; // Convert diameter to radius
    const length = currentVariant.length;
    const defaultLabel = `${currentManufacturer.name} ${currentScrewType.name} ⌀${currentVariant.diameter}mm × ${length}mm`;
    const label = screwLabel.trim() || defaultLabel;

    onSelectScrew({
      name: label,  // Pass as 'name' for now, will be converted to screwLabel in parent
      radius,
      length,
      source: 'catalog',
      variantId: currentVariant.id,
      manufacturer: currentManufacturer.name,
      screwType: currentScrewType.name,
    });

    // Reset and close
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setScrewLabel('');
    setCustomRadius('3.5');
    setCustomLength('40');
    setSelectedManufacturer('');
    setSelectedScrewType('');
    setSelectedVariant('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">🔩 Pedicle Screw Selection</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white text-2xl"
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Common Screw Label Field */}
        <div className="px-6 pt-4 pb-2 bg-gray-850 border-b border-gray-700">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Screw Label (optional)
            </label>
            <input
              type="text"
              placeholder="e.g., L3 Right, L4 Left, Custom Screw..."
              value={screwLabel}
              onChange={(e) => setScrewLabel(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              💡 If not specified, a default label will be generated based on your selection
            </p>
          </div>
        </div>

        {/* Mode Selection Tabs */}
        <div className="flex border-b border-gray-700 bg-gray-800">
          <button
            onClick={() => setSelectionMode('custom')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition ${
              selectionMode === 'custom'
                ? 'bg-gray-900 text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            ⚙️ Custom Screw
          </button>
          <button
            onClick={() => setSelectionMode('catalog')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition ${
              selectionMode === 'catalog'
                ? 'bg-gray-900 text-green-400 border-b-2 border-green-400'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            📦 Catalog Screw
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectionMode === 'custom' ? (
            // ═══════════════════════════════════════════════════════
            // CUSTOM SCREW PANEL
            // ═══════════════════════════════════════════════════════
            <div className="space-y-4 max-w-2xl mx-auto">
              <div className="p-4 bg-blue-900 bg-opacity-20 border border-blue-600 rounded">
                <h3 className="text-lg font-bold text-white mb-2">⚙️ Create Custom Screw</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Enter custom dimensions for a screw that is not in the catalog
                </p>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">
                        Radius (mm) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        placeholder="e.g., 2.0"
                        value={customRadius}
                        onChange={(e) => setCustomRadius(e.target.value)}
                        step="0.1"
                        min="0.1"
                        className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
                      />
                      {customRadius && !isNaN(parseFloat(customRadius)) && (
                        <p className="text-xs text-gray-500 mt-1">
                          Diameter: {(parseFloat(customRadius) * 2).toFixed(1)} mm
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm text-gray-300 mb-1">
                        Length (mm) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        placeholder="e.g., 40.0"
                        value={customLength}
                        onChange={(e) => setCustomLength(e.target.value)}
                        step="0.1"
                        min="0.1"
                        className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview */}
              {customRadius && customLength && !isNaN(parseFloat(customRadius)) && !isNaN(parseFloat(customLength)) && (
                <div className="p-4 bg-gray-800 border border-gray-700 rounded">
                  <h4 className="text-sm font-bold text-white mb-2">Preview</h4>
                  <div className="flex gap-2">
                    <span className="inline-block px-2 py-1 bg-blue-900 bg-opacity-50 border border-blue-700 rounded text-xs text-blue-300 font-semibold">
                      ⌀ {(parseFloat(customRadius) * 2).toFixed(1)} mm
                    </span>
                    <span className="inline-block px-2 py-1 bg-green-900 bg-opacity-50 border border-green-700 rounded text-xs text-green-300 font-semibold">
                      ↕ {parseFloat(customLength).toFixed(1)} mm
                    </span>
                    <span className="inline-block px-2 py-1 bg-purple-900 bg-opacity-50 border border-purple-700 rounded text-xs text-purple-300">
                      ⚙️ Custom
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // ═══════════════════════════════════════════════════════
            // CATALOG SCREW PANEL
            // ═══════════════════════════════════════════════════════
            <div className="space-y-4">
              {/* Manufacturer Selection */}
              <div className="p-4 bg-green-900 bg-opacity-20 border border-green-600 rounded">
                <h3 className="text-lg font-bold text-white mb-2">📦 Select from Catalog</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Choose a screw from the manufacturer catalog
                </p>

                <div className="space-y-3">
                  {/* Manufacturer Dropdown */}
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">
                      Manufacturer <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedManufacturer}
                      onChange={(e) => setSelectedManufacturer(e.target.value)}
                      disabled={isLoadingCatalog}
                      className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm focus:outline-none focus:border-green-500 disabled:opacity-50"
                    >
                      <option value="">-- Select Manufacturer --</option>
                      {manufacturers.map((mfr) => (
                        <option key={mfr.id} value={mfr.id}>
                          {mfr.name} ({mfr.screw_types.reduce((sum, st) => sum + st.variants.length, 0)} variants)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Screw Type Dropdown */}
                  {selectedManufacturer && currentManufacturer && (
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">
                        Screw Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={selectedScrewType}
                        onChange={(e) => setSelectedScrewType(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm focus:outline-none focus:border-green-500"
                      >
                        <option value="">-- Select Screw Type --</option>
                        {currentManufacturer.screw_types.map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.name} ({st.variants.length} variants)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Variant Dropdown */}
                  {selectedScrewType && currentScrewType && (
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">
                        Dimensions <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={selectedVariant}
                        onChange={(e) => setSelectedVariant(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm focus:outline-none focus:border-green-500"
                      >
                        <option value="">-- Select Dimensions --</option>
                        {currentScrewType.variants.map((variant) => (
                          <option key={variant.id} value={variant.id}>
                            ⌀{variant.diameter}mm × {variant.length}mm - {variant.material}
                            {variant.specifications?.cannulated ? ' (Cannulated)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Loading State */}
              {isLoadingCatalog && (
                <div className="text-center py-8">
                  <div className="animate-spin text-4xl mb-2">🔄</div>
                  <p className="text-gray-400">Loading catalog...</p>
                </div>
              )}

              {/* Error State */}
              {catalogError && (
                <div className="p-4 bg-red-900 bg-opacity-20 border border-red-600 rounded">
                  <p className="text-red-300 text-sm">❌ {catalogError}</p>
                  <button
                    onClick={() => loadCatalog()}
                    className="mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
                  >
                    🔄 Retry
                  </button>
                </div>
              )}

              {/* Selected Variant Details */}
              {currentVariant && (
                <div className="p-4 bg-gray-800 border border-gray-700 rounded">
                  <h4 className="text-sm font-bold text-white mb-3">Selected Screw Details</h4>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-gray-500">Manufacturer</p>
                      <p className="text-sm text-white">{currentManufacturer?.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Type</p>
                      <p className="text-sm text-white">{currentScrewType?.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Diameter</p>
                      <p className="text-sm text-white">{currentVariant.diameter} mm</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Length</p>
                      <p className="text-sm text-white">{currentVariant.length} mm</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Material</p>
                      <p className="text-sm text-white">{currentVariant.material}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Head Type</p>
                      <p className="text-sm text-white">{currentVariant.head_type || 'Standard'}</p>
                    </div>
                  </div>

                  {/* Specifications */}
                  {currentVariant.specifications && (
                    <div className="pt-3 border-t border-gray-700">
                      <p className="text-xs text-gray-500 mb-2">Specifications</p>
                      <div className="flex flex-wrap gap-2">
                        {currentVariant.specifications.cannulated && (
                          <span className="inline-block px-2 py-1 bg-blue-900 bg-opacity-50 border border-blue-700 rounded text-xs text-blue-300">
                            🔘 Cannulated ({currentVariant.specifications.inner_diameter}mm)
                          </span>
                        )}
                        {currentVariant.specifications.break_off_torque > 0 && (
                          <span className="inline-block px-2 py-1 bg-purple-900 bg-opacity-50 border border-purple-700 rounded text-xs text-purple-300">
                            🔧 {currentVariant.specifications.break_off_torque}Nm
                          </span>
                        )}
                        {currentVariant.thread_pitch > 0 && (
                          <span className="inline-block px-2 py-1 bg-green-900 bg-opacity-50 border border-green-700 rounded text-xs text-green-300">
                            📏 Pitch: {currentVariant.thread_pitch}mm
                          </span>
                        )}
                        <span className="inline-block px-2 py-1 bg-blue-900 bg-opacity-50 border border-blue-700 rounded text-xs text-blue-300">
                          📦 Catalog
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-700 bg-gray-800">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
          >
            Cancel
          </button>
          <button
            onClick={selectionMode === 'custom' ? handleSelectCustom : handleSelectCatalog}
            className={`px-6 py-2 text-white rounded text-sm font-bold transition ${
              selectionMode === 'custom'
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {selectionMode === 'custom' ? '⚙️ Use Custom Screw' : '📦 Use Catalog Screw'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScrewSelectionDialog;
