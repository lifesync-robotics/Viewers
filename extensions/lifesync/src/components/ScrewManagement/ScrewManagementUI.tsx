/**
 * ScrewManagementUI Components
 *
 * Presentational components for the Screw Management Panel
 * Separated for better maintainability and testability
 */

import React from 'react';

// Re-export CrosshairBookmarks component and types
export { CrosshairBookmarks } from './CrosshairBookmarks';
export type { CrosshairBookmark, ScrewPlacementRequest } from './CrosshairBookmarks';

// ═══════════════════════════════════════════════════════
// Header Components
// ═══════════════════════════════════════════════════════

interface HeaderProps {
  sessionId: string | null;
}

export const Header: React.FC<HeaderProps> = ({ sessionId }) => (
  <h2 className="text-xl font-bold text-white flex items-center gap-2">
    🔩 Screw Management
    {sessionId && (
      <span className="text-green-400 text-xs" title="API Connected">
        ●
      </span>
    )}
  </h2>
);

// ═══════════════════════════════════════════════════════
// Status Components
// ═══════════════════════════════════════════════════════

interface SessionStatusProps {
  status: 'initializing' | 'ready' | 'error';
  sessionId: string | null;
  onRetry: () => void;
}

export const SessionStatus: React.FC<SessionStatusProps> = ({
  status,
  sessionId,
  onRetry,
}) => {
  if (status === 'initializing') {
    return (
      <div className="p-2 bg-yellow-900 bg-opacity-30 border border-yellow-600 rounded text-xs text-yellow-300">
        🔄 Connecting to planning service...
      </div>
    );
  }

  if (status === 'ready' && sessionId) {
    return (
      <div className="p-2 bg-green-900 bg-opacity-30 border border-green-600 rounded text-xs text-green-300">
        ✅ Planning session ready ({sessionId.substring(0, 8)}...)
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="p-2 bg-red-900 bg-opacity-30 border border-red-600 rounded text-xs">
        <div className="text-red-300 mb-1">⚠️ Planning API unavailable</div>
        <button
          onClick={onRetry}
          className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
        >
          🔄 Retry Connection
        </button>
      </div>
    );
  }

  return null;
};

export const LoadingScreen: React.FC = () => (
  <div className="flex flex-col h-full bg-gray-900 text-white p-4 space-y-4 items-center justify-center">
    <div className="text-center">
      <div className="animate-spin text-4xl mb-4">🔄</div>
      <h2 className="text-xl font-bold text-white mb-2">🔗 Initializing Planning Session</h2>
      <p className="text-gray-400">Connecting to planning service...</p>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════
// Combined Compact Toolbar - All Tools in Multiple Rows
// ═══════════════════════════════════════════════════════

interface CompactToolbarProps {
  // Move Tool
  isMoveToolActive: boolean;
  onToggleMoveTool: () => void;
  selectedScrew?: { label: string } | null;
  modelCount?: number;
  screwCount?: number;
  // Add Screw
  remainingSlots: number;
  maxScrews: number;
  onOpenDialog: () => void;
  // Plan Actions
  onTestCrosshair: () => void;
  onShowSessionState: () => void;
  onLoadPlan: () => void;
  onSavePlan: () => void;
  onClearAll: () => void;
  isSavingPlan: boolean;
  hasScrews: boolean;
  // Debug
  onDebug?: () => void;
}

export const CompactToolbar: React.FC<CompactToolbarProps> = ({
  isMoveToolActive,
  onToggleMoveTool,
  selectedScrew,
  modelCount = 0,
  screwCount = 0,
  remainingSlots,
  maxScrews,
  onOpenDialog,
  onTestCrosshair,
  onShowSessionState,
  onLoadPlan,
  onSavePlan,
  onClearAll,
  isSavingPlan,
  hasScrews,
  onDebug,
}) => (
  <div className="space-y-2 border border-gray-600 rounded p-2 bg-gray-800 bg-opacity-30">
    {/* Row 1: Add Screw & Move Tool */}
    <div className="flex items-center gap-2">
      <button
        onClick={onOpenDialog}
        disabled={remainingSlots === 0}
        className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded transition disabled:bg-gray-600 disabled:cursor-not-allowed"
        title={
          remainingSlots === 0
            ? '⚠️ Maximum screws reached. Delete old screws first.'
            : `Add New Screw (${remainingSlots}/${maxScrews} slots remaining)`
        }
      >
        ➕
      </button>
      <span className="text-xs text-gray-400" title="Available screw slots">
        {remainingSlots}/{maxScrews}
      </span>

      <div className="w-px h-6 bg-gray-600 mx-1" />

      <button
        onClick={onToggleMoveTool}
        className={`px-2 py-1 rounded transition ${
          isMoveToolActive
            ? 'bg-purple-600 text-white ring-2 ring-purple-400'
            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
        }`}
        title={
          isMoveToolActive
            ? 'Move Tool Active - Click and drag screws on MPR'
            : `Activate Move Tool (${screwCount} screws, ${modelCount} models)`
        }
      >
        ✋
      </button>

      {selectedScrew && (
        <span className="text-xs text-green-400 font-medium" title={`Selected: ${selectedScrew.label}`}>
          {selectedScrew.label}
        </span>
      )}
    </div>

    {/* Row 2: Plan Actions */}
    <div className="flex items-center gap-2">
      <button
        onClick={onLoadPlan}
        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
        title="Load Plan"
      >
        📂
      </button>

      {hasScrews && (
        <>
          <button
            onClick={onSavePlan}
            disabled={isSavingPlan}
            className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Save Plan"
          >
            {isSavingPlan ? '⏳' : '💾'}
          </button>
          <button
            onClick={onClearAll}
            className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
            title="Clear All Screws"
          >
            🧹
          </button>
        </>
      )}
    </div>

    {/* Row 3: Debug/Test Tools */}
    <div className="flex items-center gap-2">
      <button
        onClick={onTestCrosshair}
        className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded"
        title="Test Crosshair Detection"
      >
        🧪
      </button>
      <button
        onClick={onShowSessionState}
        className="px-2 py-1 bg-pink-600 hover:bg-pink-700 text-white rounded"
        title="Session Screw/Rod State"
      >
        📋
      </button>
      {onDebug && (
        <button
          onClick={onDebug}
          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
          title="Debug screw interaction"
        >
          🔍
        </button>
      )}
    </div>
  </div>
);

// Keep legacy components for backwards compatibility
export const ScrewToolbar: React.FC<any> = () => null;
export const SaveScrewButton: React.FC<any> = () => null;

// ═══════════════════════════════════════════════════════
// Screw List Components - Table Layout
// ═══════════════════════════════════════════════════════

interface ScrewListHeaderProps {
  screwCount: number;
  maxScrews: number;
}

export const ScrewListHeader: React.FC<ScrewListHeaderProps> = ({
  screwCount,
  maxScrews,
}) => (
  <div className="flex items-center justify-between mb-3">
    <h3 className="font-bold text-white text-base">
      📋 Saved Screws ({screwCount} / {maxScrews})
    </h3>
  </div>
);

export const EmptyScrewList: React.FC = () => (
  <div className="text-center py-12 bg-gray-800 bg-opacity-30 rounded">
    <p className="text-gray-400 text-base mb-2">📭 No screws saved yet</p>
    <p className="text-gray-500 text-sm">
      Click "Add New Screw" above to add your first screw
    </p>
  </div>
);

// ═══════════════════════════════════════════════════════
// Screw Dimension Selector Component (Dropdown)
// ═══════════════════════════════════════════════════════

interface ScrewDimensionSelectorProps {
  value: string | number;
  options: number[];
  onChange: (newValue: number) => void;
  label: 'diameter' | 'length';
  isUpdating?: boolean;
}

export const ScrewDimensionSelector: React.FC<ScrewDimensionSelectorProps> = ({
  value,
  options,
  onChange,
  label,
  isUpdating = false,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const selectorRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  const displayValue = typeof value === 'number' ? value.toFixed(1) : value;
  const icon = label === 'diameter' ? '⌀' : '↕';
  const bgColor = label === 'diameter' ? 'bg-blue-900' : 'bg-green-900';
  const borderColor = label === 'diameter' ? 'border-blue-700' : 'border-green-700';
  const textColor = label === 'diameter' ? 'text-blue-200' : 'text-green-200';
  const hoverBgColor = label === 'diameter' ? 'hover:bg-blue-800' : 'hover:bg-green-800';

  return (
    <div className="relative" ref={selectorRef}>
      <button
        onClick={() => !isUpdating && setIsOpen(!isOpen)}
        disabled={isUpdating}
        className={`inline-flex items-center gap-1 px-2 py-1 ${bgColor} bg-opacity-50 ${borderColor} border rounded text-sm ${textColor} font-semibold ${hoverBgColor} transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
        title={isUpdating ? 'Updating...' : `Click to change ${label === 'diameter' ? 'diameter' : 'length'}`}
      >
        <span>{isUpdating ? '⏳' : icon}</span>
        <span>{displayValue}</span>
        {!isUpdating && (
          <span className={`text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>
            ▼
          </span>
        )}
      </button>

      {isOpen && !isUpdating && options.length > 0 && (
        <div className="absolute z-50 mt-1 bg-gray-800 border border-gray-700 rounded shadow-lg max-h-60 overflow-y-auto min-w-[80px]">
          {options.map((option) => {
            const optionValue = typeof option === 'number' ? option.toFixed(1) : option;
            const isSelected = Math.abs(parseFloat(displayValue) - parseFloat(optionValue)) < 0.01;
            return (
              <button
                key={option}
                onClick={() => {
                  onChange(parseFloat(optionValue));
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm transition ${
                  isSelected
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-white hover:bg-gray-700'
                }`}
              >
                {optionValue}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// Screw Dimension Slider Component (Horizontal Slider)
// ═══════════════════════════════════════════════════════

interface ScrewDimensionSliderProps {
  value: string | number;
  options: number[];
  onChange: (newValue: number) => void;
  /** Called when user is actively dragging (in-progress) */
  onDrag?: (newValue: number) => void;
  /** Called when user releases slider (committed) */
  onCommit?: (newValue: number) => void;
  label: 'diameter' | 'length';
  isUpdating?: boolean;
}

export const ScrewDimensionSlider: React.FC<ScrewDimensionSliderProps> = ({
  value,
  options,
  onChange,
  onDrag,
  onCommit,
  label,
  isUpdating = false,
}) => {
  const numericValue = typeof value === 'number' ? value : parseFloat(value);
  
  // Sort options to ensure correct slider behavior
  const sortedOptions = [...options].sort((a, b) => a - b);
  const minValue = sortedOptions[0] || 0;
  const maxValue = sortedOptions[sortedOptions.length - 1] || 100;
  
  // Find closest option index for current value
  const currentIndex = sortedOptions.findIndex(opt => Math.abs(opt - numericValue) < 0.01);
  
  // Track if user is actively dragging
  const [isDragging, setIsDragging] = React.useState(false);
  
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value, 10);
    const selectedValue = sortedOptions[index];
    if (selectedValue !== undefined) {
      // If we have separate drag/commit handlers, use them
      if (onDrag && isDragging) {
        onDrag(selectedValue);
      } else {
        // Fallback to onChange for backward compatibility
        onChange(selectedValue);
      }
    }
  };
  
  const handleMouseDown = () => {
    setIsDragging(true);
  };
  
  const handleMouseUp = (e: React.MouseEvent<HTMLInputElement>) => {
    setIsDragging(false);
    const index = parseInt((e.target as HTMLInputElement).value, 10);
    const selectedValue = sortedOptions[index];
    if (selectedValue !== undefined && onCommit) {
      onCommit(selectedValue);
    }
  };
  
  const handleTouchEnd = (e: React.TouchEvent<HTMLInputElement>) => {
    setIsDragging(false);
    const index = parseInt((e.target as HTMLInputElement).value, 10);
    const selectedValue = sortedOptions[index];
    if (selectedValue !== undefined && onCommit) {
      onCommit(selectedValue);
    }
  };

  const displayValue = numericValue.toFixed(1);
  const icon = label === 'diameter' ? '⌀' : '↕';
  const bgColor = label === 'diameter' ? 'bg-blue-900' : 'bg-green-900';
  const borderColor = label === 'diameter' ? 'border-blue-700' : 'border-green-700';
  const textColor = label === 'diameter' ? 'text-blue-200' : 'text-green-200';
  const trackColor = label === 'diameter' ? 'accent-blue-500' : 'accent-green-500';

  return (
    <div className="flex flex-col gap-1 min-w-[140px]">
      {/* Value Display */}
      <div className={`inline-flex items-center justify-center gap-1 px-2 py-1 ${bgColor} bg-opacity-50 ${borderColor} border rounded text-sm ${textColor} font-semibold`}>
        <span>{isUpdating ? '⏳' : (isDragging ? '🔄' : icon)}</span>
        <span>{displayValue}</span>
      </div>
      
      {/* Slider */}
      <input
        type="range"
        min={0}
        max={sortedOptions.length - 1}
        step={1}
        value={currentIndex >= 0 ? currentIndex : 0}
        onChange={handleSliderChange}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleTouchEnd}
        disabled={isUpdating}
        className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer ${trackColor} disabled:opacity-50 disabled:cursor-not-allowed`}
        style={{
          background: `linear-gradient(to right, ${label === 'diameter' ? '#3b82f6' : '#10b981'} 0%, ${label === 'diameter' ? '#1e40af' : '#047857'} 100%)`
        }}
        title={`${label === 'diameter' ? 'Diameter' : 'Length'}: ${displayValue}mm${isDragging ? ' (dragging...)' : ''}`}
      />
      
      {/* Min/Max Labels */}
      <div className="flex justify-between text-xs text-gray-500">
        <span>{minValue.toFixed(1)}</span>
        <span>{maxValue.toFixed(1)}</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// Screw Table Component - CRUD Style Layout
// ═══════════════════════════════════════════════════════

interface ScrewDisplayInfo {
  label: string;
  description: string;
  source: 'catalog' | 'generated' | 'unknown';
  radius: number;
  length: number;
  manufacturerInfo?: {
    vendor: string;
    model: string;
  } | null;
}

interface ScrewTableProps {
  screws: any[];
  displayInfoGetter: (screw: any) => ScrewDisplayInfo;
  isRestoring: boolean;
  onView: (screw: any) => void;
  onEdit: (screw: any) => void;
  onDelete: (screw: any) => void;
  showEditButton: boolean; // default is true
  onUpdateDiameter?: (screw: any, newDiameter: number) => void;
  onUpdateLength?: (screw: any, newLength: number) => void;
  onDragDiameter?: (screw: any, newDiameter: number) => void; // Called during slider drag
  onDragLength?: (screw: any, newLength: number) => void; // Called during slider drag
  availableDiameters?: number[];
  availableLengths?: number[];
  updatingScrewId?: string | null;
  showDescription?: boolean; // default is true - shows dimension text under screw name
  useSliders?: boolean; // default is false - use sliders instead of dropdowns for dimensions
}

export const ScrewTable: React.FC<ScrewTableProps> = ({
  screws,
  displayInfoGetter,
  isRestoring,
  onView,
  onEdit,
  onDelete,
  showEditButton = false,
  onUpdateDiameter,
  onUpdateLength,
  onDragDiameter,
  onDragLength,
  availableDiameters = [],
  availableLengths = [],
  updatingScrewId = null,
  showDescription = true,
  useSliders = false,
}) => {
  // Table is hidden - commented out to preserve code for future use
  return null;
  
  /* COMMENTED OUT - Original table implementation
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-700">
      <table className="w-full text-sm text-left">
        {/* Table Header *\/}
        <thead className="text-xs uppercase bg-gray-800 text-gray-300 border-b border-gray-700">
          <tr>
            <th scope="col" className="px-4 py-2 font-semibold">Name</th>
            <th scope="col" className="px-4 py-2 font-semibold text-center">Diameter (mm)</th>
            <th scope="col" className="px-4 py-2 font-semibold text-center">Length (mm)</th>
            <th scope="col" className="px-4 py-2 font-semibold text-center">Actions</th>
          </tr>
        </thead>

        {/* Table Body *\/}
        <tbody>
          {screws.map((screw, index) => {
            let displayInfo;
            try {
              displayInfo = displayInfoGetter(screw);
            } catch (error) {
              // Render error row
              return (
                <tr key={screw.screw_id || index} className="border-b border-gray-700 bg-red-900 bg-opacity-20">
                  <td className="px-4 py-2 text-red-300" colSpan={3}>
                    ⚠️ Invalid Screw Data: {error.message}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => onDelete(screw)}
                      className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition"
                      title="Delete Invalid Screw"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              );
            }

            const isApiData = !!screw.screw_id;
            const diameter = displayInfo.radius * 2;
            const screwId = screw.screw_id || screw.id || index;
            const isUpdating = updatingScrewId === screwId;

            return (
              <tr
                key={screwId}
                className="border-b border-gray-700 bg-gray-800 bg-opacity-30 hover:bg-gray-700 hover:bg-opacity-40 transition"
              >
                {/* Name Column - Clickable *\/}
                <td className="px-4 py-2">
                  <button
                    onClick={() => onView(screw)}
                    disabled={isRestoring}
                    className="text-left w-full hover:text-blue-400 transition disabled:cursor-not-allowed"
                    title={isRestoring ? 'Loading...' : `Click to view "${displayInfo.label}"`}
                  >
                    <p className="font-medium text-white text-sm truncate">
                      {isRestoring ? '⏳ ' : ''}{displayInfo.label}
                    </p>
                    {showDescription && displayInfo.description && (
                      <p className="text-xs text-gray-500 truncate" title={displayInfo.description}>
                        {displayInfo.description}
                      </p>
                    )}
                  </button>
                </td>

                {/* Diameter Column *\/}
                <td className="px-4 py-2 text-center">
                  {onUpdateDiameter && availableDiameters.length > 0 ? (
                    useSliders ? (
                      <ScrewDimensionSlider
                        value={diameter}
                        options={availableDiameters}
                        onChange={(newDiameter) => onUpdateDiameter(screw, newDiameter)}
                        onDrag={onDragDiameter ? (newDiameter) => onDragDiameter(screw, newDiameter) : undefined}
                        onCommit={(newDiameter) => onUpdateDiameter(screw, newDiameter)}
                        label="diameter"
                        isUpdating={isUpdating}
                      />
                    ) : (
                      <ScrewDimensionSelector
                        value={diameter}
                        options={availableDiameters}
                        onChange={(newDiameter) => onUpdateDiameter(screw, newDiameter)}
                        label="diameter"
                        isUpdating={isUpdating}
                      />
                    )
                  ) : (
                    <span className="inline-block px-2 py-1 bg-blue-900 bg-opacity-50 border border-blue-700 rounded text-sm text-blue-200 font-semibold">
                      ⌀ {diameter.toFixed(1)}
                    </span>
                  )}
                </td>

                {/* Length Column *\/}
                <td className="px-4 py-2 text-center">
                  {onUpdateLength && availableLengths.length > 0 ? (
                    useSliders ? (
                      <ScrewDimensionSlider
                        value={displayInfo.length}
                        options={availableLengths}
                        onChange={(newLength) => onUpdateLength(screw, newLength)}
                        onDrag={onDragLength ? (newLength) => onDragLength(screw, newLength) : undefined}
                        onCommit={(newLength) => onUpdateLength(screw, newLength)}
                        label="length"
                        isUpdating={isUpdating}
                      />
                    ) : (
                      <ScrewDimensionSelector
                        value={displayInfo.length}
                        options={availableLengths}
                        onChange={(newLength) => onUpdateLength(screw, newLength)}
                        label="length"
                        isUpdating={isUpdating}
                      />
                    )
                  ) : (
                    <span className="inline-block px-2 py-1 bg-green-900 bg-opacity-50 border border-green-700 rounded text-sm text-green-200 font-semibold">
                      ↕ {displayInfo.length.toFixed(1)}
                    </span>
                  )}
                </td>

                {/* Actions Column *\/}
                <td className="px-4 py-2">
                  <div className="flex gap-2 justify-center">
                    {showEditButton && (
                      <button
                        onClick={() => onEdit(screw)}
                        className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded transition"
                        title={`Edit "${displayInfo.label}"`}
                      >
                        ✏️
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(screw)}
                      className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition"
                      title={`Delete "${displayInfo.label}"`}
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
  */
};

// Legacy card component kept for compatibility
interface ScrewCardProps {
  screw: any;
  displayInfo: ScrewDisplayInfo;
  isRestoring: boolean;
  onRestore: (screw: any) => void;
  onDelete: (screw: any) => void;
}

export const ScrewCard: React.FC<ScrewCardProps> = ({
  screw,
  displayInfo,
  isRestoring,
  onRestore,
  onDelete,
}) => {
  const timestamp = screw.timestamp || screw.placed_at || screw.created_at || Date.now();
  const isApiData = !!screw.screw_id;

  return (
    <div className="border border-gray-700 rounded p-3 hover:border-blue-500 transition bg-gray-800 bg-opacity-50">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-lg">🔩</span>
            <p className="font-medium text-sm text-white truncate" title={displayInfo.label}>
              {displayInfo.label}
            </p>
            {displayInfo.source === 'catalog' && (
              <span className="inline-block px-1.5 py-0.5 bg-blue-900 bg-opacity-50 border border-blue-700 rounded text-xs text-blue-300">
                📦 Catalog
              </span>
            )}
            {displayInfo.source === 'generated' && (
              <span className="inline-block px-1.5 py-0.5 bg-purple-900 bg-opacity-50 border border-purple-700 rounded text-xs text-purple-300">
                ⚙️ Custom
              </span>
            )}
            {isApiData && (
              <span className="inline-block px-1 py-0.5 bg-green-900 bg-opacity-50 border border-green-700 rounded text-xs text-green-300">
                API
              </span>
            )}
          </div>
          {displayInfo.description && (
            <p className="text-xs text-gray-500 mb-1">
              {displayInfo.description}
            </p>
          )}
          <p className="text-xs text-gray-400 mb-2">
            {new Date(timestamp).toLocaleString()}
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="inline-block px-2 py-1 bg-blue-900 bg-opacity-50 border border-blue-700 rounded text-xs text-blue-300 font-semibold">
              ⌀ {(displayInfo.radius * 2).toFixed(1)} mm
            </span>
            <span className="inline-block px-2 py-1 bg-green-900 bg-opacity-50 border border-green-700 rounded text-xs text-green-300 font-semibold">
              ↕ {displayInfo.length.toFixed(1)} mm
            </span>
            {screw.viewports && (
              <span className="inline-block px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-400">
                {screw.viewports.length} views
              </span>
            )}
            {screw.transform_matrix && (
              <span className="inline-block px-2 py-0.5 bg-purple-900 bg-opacity-50 border border-purple-700 rounded text-xs text-purple-300">
                3D transform
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={() => onRestore(screw)}
            disabled={isRestoring}
            className="px-2 py-2 bg-blue-600 hover:bg-blue-700 text-white text-base rounded transition disabled:bg-gray-600 disabled:cursor-not-allowed"
            title={`Load "${displayInfo.label}"`}
          >
            {isRestoring ? '⏳' : '🔄'}
          </button>
          <button
            onClick={() => onDelete(screw)}
            className="px-2 py-2 bg-red-600 hover:bg-red-700 text-white text-base rounded transition"
            title={`Delete "${displayInfo.label}"`}
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
};

interface InvalidScrewCardProps {
  screw: any;
  error: Error;
  onDelete: (screw: any) => void;
}

export const InvalidScrewCard: React.FC<InvalidScrewCardProps> = ({
  screw,
  error,
  onDelete,
}) => {
  const screwId = screw.screw_id || screw.name || 'unknown';

  return (
    <div className="border border-red-700 rounded p-3 bg-red-900 bg-opacity-20">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">⚠️</span>
        <p className="font-medium text-sm text-red-300">
          Invalid Screw Data
        </p>
      </div>
      <p className="text-xs text-red-400 mb-2">
        {error.message || 'Missing required dimensions'}
      </p>
      <button
        onClick={() => onDelete(screw)}
        className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
      >
        🗑️ Remove Invalid Screw
      </button>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// Main Container
// ═══════════════════════════════════════════════════════

interface ScrewManagementContainerProps {
  children: React.ReactNode;
}

export const ScrewManagementContainer: React.FC<ScrewManagementContainerProps> = ({
  children,
}) => (
  <div className="p-4 space-y-4 h-full flex flex-col">
    {children}
  </div>
);

interface ScrewListContainerProps {
  children: React.ReactNode;
}

export const ScrewListContainer: React.FC<ScrewListContainerProps> = ({
  children,
}) => (
  <div className="flex-1 flex flex-col min-h-0">
    {children}
  </div>
);

interface ScrewListScrollAreaProps {
  children: React.ReactNode;
}

export const ScrewListScrollArea: React.FC<ScrewListScrollAreaProps> = ({
  children,
}) => (
  <div className="flex-1 overflow-y-auto space-y-2">
    {children}
  </div>
);

// ═══════════════════════════════════════════════════════
// Session State Dialog
// ═══════════════════════════════════════════════════════

interface SessionStateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  uiState: {
    screws: any[];
    sessionId: string | null;
    caseId: string | null;
    studyInstanceUID: string | null;
    seriesInstanceUID: string | null;
    surgeon: string;
  };
  backendSummary: any | null;
  isLoading: boolean;
  error: string | null;
}

export const SessionStateDialog: React.FC<SessionStateDialogProps> = ({
  isOpen,
  onClose,
  uiState,
  backendSummary,
  isLoading,
  error,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-5/6 max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-cyan-700 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">📋 Session Screw Rod State</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Left Side: UI State */}
            <div className="bg-gray-900 p-4 rounded-lg border border-blue-500">
              <h3 className="text-lg font-bold text-blue-400 mb-4">🖥️ Frontend UI State</h3>

              {/* Session Info */}
              <div className="mb-4 space-y-2">
                <div className="text-sm">
                  <span className="text-gray-400">Session ID:</span>{' '}
                  <span className="text-white font-mono text-xs">
                    {uiState.sessionId ? uiState.sessionId.substring(0, 16) + '...' : 'N/A'}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-400">Case ID:</span>{' '}
                  <span className="text-white">{uiState.caseId || 'N/A'}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-400">Surgeon:</span>{' '}
                  <span className="text-white">{uiState.surgeon}</span>
                </div>
              </div>

              {/* Screws */}
              <div className="mb-4">
                <h4 className="text-md font-semibold text-white mb-2">
                  🔩 Screws ({uiState.screws.length})
                </h4>
                <div className="max-h-80 overflow-y-auto space-y-2">
                  {uiState.screws.length === 0 ? (
                    <div className="text-gray-500 text-sm">No screws in UI</div>
                  ) : (
                    uiState.screws.map((screw, idx) => (
                      <div
                        key={idx}
                        className="bg-gray-800 p-3 rounded border border-gray-700"
                      >
                        <div className="text-white font-semibold text-sm mb-1">
                          {screw.screw_label || screw.name || `Screw ${idx + 1}`}
                        </div>
                        <div className="text-xs text-gray-400 space-y-1">
                          <div>ID: {screw.screw_id || screw.id || 'N/A'}</div>
                          <div>Radius: {screw.radius}mm</div>
                          <div>Length: {screw.length}mm</div>
                          <div>Level: {screw.vertebral_level || 'unknown'}</div>
                          <div>Side: {screw.side || 'unknown'}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Rods (placeholder) */}
              <div>
                <h4 className="text-md font-semibold text-white mb-2">
                  🦴 Rods (0)
                </h4>
                <div className="text-gray-500 text-sm">No rods in UI yet</div>
              </div>
            </div>

            {/* Right Side: Backend State */}
            <div className="bg-gray-900 p-4 rounded-lg border border-green-500">
              <h3 className="text-lg font-bold text-green-400 mb-4">⚙️ Backend Session Summary</h3>

              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin text-4xl mb-4">🔄</div>
                  <div className="text-white">Loading backend state...</div>
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <div className="text-red-400 text-lg mb-2">❌ Error</div>
                  <div className="text-gray-400 text-sm">{error}</div>
                </div>
              ) : backendSummary ? (
                <>
                  {/* Session Info */}
                  <div className="mb-4 space-y-2">
                    <div className="text-sm">
                      <span className="text-gray-400">Session ID:</span>{' '}
                      <span className="text-white font-mono text-xs">
                        {backendSummary.session_id ? backendSummary.session_id.substring(0, 16) + '...' : 'N/A'}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-400">Series UID:</span>{' '}
                      <span className="text-white font-mono text-xs">{backendSummary.series_uid || 'N/A'}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-400">Surgeon:</span>{' '}
                      <span className="text-white">{backendSummary.surgeon || 'N/A'}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-400">Created:</span>{' '}
                      <span className="text-white">{backendSummary.created_at || 'N/A'}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-400">Duration:</span>{' '}
                      <span className="text-white">{backendSummary.duration_minutes || 0} mins</span>
                    </div>
                  </div>

                  {/* Screws Summary */}
                  <div className="mb-4">
                    <h4 className="text-md font-semibold text-white mb-2">
                      🔩 Screws ({backendSummary.screws?.count || 0} / {backendSummary.screws?.max || 10})
                    </h4>
                    <div className="bg-gray-800 p-3 rounded border border-gray-700 space-y-2">
                      <div className="text-sm">
                        <span className="text-gray-400">Total:</span>{' '}
                        <span className="text-white font-bold">{backendSummary.screws?.count || 0}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-400">Remaining Capacity:</span>{' '}
                        <span className="text-white">{backendSummary.screws?.remaining_capacity || 0}</span>
                      </div>

                      {/* Screw Labels */}
                      {backendSummary.screws?.labels && backendSummary.screws.labels.length > 0 && (
                        <div className="mt-2">
                          <div className="text-xs text-gray-400 mb-1">Labels:</div>
                          <div className="flex flex-wrap gap-1">
                            {backendSummary.screws.labels.map((label: string, idx: number) => (
                              <span
                                key={idx}
                                className="bg-blue-600 text-white px-2 py-1 rounded text-xs"
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Screws by Level */}
                      {backendSummary.screws?.by_level && Object.keys(backendSummary.screws.by_level).length > 0 && (
                        <div className="mt-3">
                          <div className="text-xs text-gray-400 mb-2">By Level:</div>
                          <div className="space-y-1">
                            {Object.entries(backendSummary.screws.by_level).map(([level, counts]: [string, any]) => (
                              <div key={level} className="text-xs bg-gray-700 p-2 rounded">
                                <span className="text-white font-semibold">{level}:</span>{' '}
                                <span className="text-gray-300">
                                  L={counts.left} R={counts.right} (Total: {counts.total})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Dimensions Statistics */}
                      {backendSummary.screws?.dimensions && (
                        <div className="mt-3">
                          <div className="text-xs text-gray-400 mb-2">Dimensions:</div>
                          <div className="space-y-1">
                            {backendSummary.screws.dimensions.radius && (
                              <div className="text-xs bg-gray-700 p-2 rounded">
                                <span className="text-cyan-400 font-semibold">Radius:</span>{' '}
                                <span className="text-white">
                                  {backendSummary.screws.dimensions.radius.min}–{backendSummary.screws.dimensions.radius.max}mm
                                </span>
                                <span className="text-gray-400"> (avg: {backendSummary.screws.dimensions.radius.avg}mm)</span>
                              </div>
                            )}
                            {backendSummary.screws.dimensions.length && (
                              <div className="text-xs bg-gray-700 p-2 rounded">
                                <span className="text-cyan-400 font-semibold">Length:</span>{' '}
                                <span className="text-white">
                                  {backendSummary.screws.dimensions.length.min}–{backendSummary.screws.dimensions.length.max}mm
                                </span>
                                <span className="text-gray-400"> (avg: {backendSummary.screws.dimensions.length.avg}mm)</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Variant Types */}
                      {backendSummary.screws?.variant_types && Object.keys(backendSummary.screws.variant_types).length > 0 && (
                        <div className="mt-3">
                          <div className="text-xs text-gray-400 mb-2">Variant Types:</div>
                          <div className="space-y-1">
                            {Object.entries(backendSummary.screws.variant_types).map(([variant, count]: [string, any]) => (
                              <div key={variant} className="text-xs bg-gray-700 p-2 rounded flex justify-between items-center">
                                <span className="text-white truncate mr-2" title={variant}>
                                  {variant.length > 30 ? variant.substring(0, 30) + '...' : variant}
                                </span>
                                <span className="bg-purple-600 text-white px-2 py-0.5 rounded font-semibold">
                                  {count}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Detailed Screw List */}
                      {backendSummary.screws?.details && backendSummary.screws.details.length > 0 && (
                        <div className="mt-3">
                          <div className="text-xs text-gray-400 mb-2">Detailed List:</div>
                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {backendSummary.screws.details.map((detail: any, idx: number) => (
                              <div key={idx} className="text-xs bg-gray-700 p-2 rounded">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-white font-semibold">{detail.label}</span>
                                  {detail.has_transform && (
                                    <span className="text-green-400 text-[10px]" title="Has transform matrix">✓ Transform</span>
                                  )}
                                </div>
                                <div className="text-gray-300 space-y-0.5">
                                  <div>{detail.level} ({detail.side})</div>
                                  <div>R={detail.radius}mm, L={detail.length}mm</div>
                                  {detail.entry_point && (detail.entry_point.x || detail.entry_point.y || detail.entry_point.z) && (
                                    <div className="text-[10px] text-gray-400">
                                      Entry: ({detail.entry_point.x?.toFixed(1)}, {detail.entry_point.y?.toFixed(1)}, {detail.entry_point.z?.toFixed(1)})
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rods Summary */}
                  <div>
                    <h4 className="text-md font-semibold text-white mb-2">
                      🦴 Rods ({backendSummary.rods?.count || 0} / {backendSummary.rods?.max || 5})
                    </h4>
                    <div className="bg-gray-800 p-3 rounded border border-gray-700 space-y-2">
                      <div className="text-sm">
                        <span className="text-gray-400">Total:</span>{' '}
                        <span className="text-white font-bold">{backendSummary.rods?.count || 0}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-400">Remaining Capacity:</span>{' '}
                        <span className="text-white">{backendSummary.rods?.remaining_capacity || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Alignment Status */}
                  <div className="mt-4 p-3 rounded" style={{
                    backgroundColor: backendSummary.screws?.count === uiState.screws.length
                      ? 'rgba(34, 197, 94, 0.2)'
                      : 'rgba(239, 68, 68, 0.2)',
                    borderColor: backendSummary.screws?.count === uiState.screws.length
                      ? 'rgb(34, 197, 94)'
                      : 'rgb(239, 68, 68)',
                    borderWidth: '1px'
                  }}>
                    <div className="text-sm font-semibold" style={{
                      color: backendSummary.screws?.count === uiState.screws.length
                        ? 'rgb(134, 239, 172)'
                        : 'rgb(252, 165, 165)'
                    }}>
                      {backendSummary.screws?.count === uiState.screws.length
                        ? '✅ Frontend and Backend are in sync!'
                        : '⚠️ Frontend and Backend counts do not match!'}
                    </div>
                    {backendSummary.screws?.count !== uiState.screws.length && (
                      <div className="text-xs text-gray-400 mt-1">
                        UI: {uiState.screws.length} screws | Backend: {backendSummary.screws?.count || 0} screws
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-gray-500 text-sm">No backend summary available</div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-700 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
