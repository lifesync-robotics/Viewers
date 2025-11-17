/**
 * ScrewManagementUI Components
 *
 * Presentational components for the Screw Management Panel
 * Separated for better maintainability and testability
 */

import React from 'react';

// ═══════════════════════════════════════════════════════
// Header Components
// ═══════════════════════════════════════════════════════

interface HeaderProps {
  sessionId: string | null;
  onTestCrosshair: () => void;
  onLoadPlan: () => void;
  onSavePlan: () => void;
  onClearAll: () => void;
  isSavingPlan: boolean;
  hasScrews: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  sessionId,
  onTestCrosshair,
  onLoadPlan,
  onSavePlan,
  onClearAll,
  isSavingPlan,
  hasScrews,
}) => (
  <div className="flex items-center justify-between">
    <h2 className="text-xl font-bold text-white">
      🔩 Screw Management
      {sessionId && <span className="text-sm font-normal text-green-400 ml-2">(API Connected)</span>}
    </h2>
    <div className="flex gap-1">
      <button
        onClick={onTestCrosshair}
        className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-base"
        title="Test Crosshair Detection"
      >
        🧪
      </button>
      <button
        onClick={onLoadPlan}
        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-base"
        title="Load Plan"
      >
        📂
      </button>
      {hasScrews && (
        <>
          <button
            onClick={onSavePlan}
            disabled={isSavingPlan}
            className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-base disabled:opacity-50 disabled:cursor-not-allowed"
            title="Save Plan"
          >
            {isSavingPlan ? '⏳' : '💾'}
          </button>
          <button
            onClick={onClearAll}
            className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-base"
            title="Clear All Screws"
          >
            🧹
          </button>
        </>
      )}
    </div>
  </div>
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
// Save Screw Section
// ═══════════════════════════════════════════════════════

interface SaveScrewButtonProps {
  remainingSlots: number;
  maxScrews: number;
  onOpenDialog: () => void;
}

export const SaveScrewButton: React.FC<SaveScrewButtonProps> = ({
  remainingSlots,
  maxScrews,
  onOpenDialog,
}) => (
  <div className="space-y-2 border border-blue-600 rounded p-3 bg-blue-900 bg-opacity-20">
    <div className="flex items-center justify-between">
      <h3 className="font-bold text-white text-sm">💾 Screw Placement</h3>
      <span className="text-xs text-gray-400">
        {remainingSlots} / {maxScrews} slots remaining
      </span>
    </div>

    <button
      onClick={onOpenDialog}
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
      💡 Opens screw selection dialog to choose from catalog or create custom screw
    </p>
  </div>
);

// ═══════════════════════════════════════════════════════
// Screw List Components
// ═══════════════════════════════════════════════════════

interface ScrewListHeaderProps {
  screwCount: number;
  maxScrews: number;
}

export const ScrewListHeader: React.FC<ScrewListHeaderProps> = ({
  screwCount,
  maxScrews,
}) => (
  <h3 className="font-bold text-white text-sm mb-2">
    📋 Saved Screws ({screwCount} / {maxScrews})
  </h3>
);

export const EmptyScrewList: React.FC = () => (
  <div className="text-center py-8">
    <p className="text-gray-500 text-sm">No screws saved yet</p>
    <p className="text-gray-600 text-xs mt-2">
      Enter radius and length, then click "Save Screw Placement"
    </p>
  </div>
);

// ═══════════════════════════════════════════════════════
// Individual Screw Card Components
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
        {/* Screw Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-lg">🔩</span>
            <p className="font-medium text-sm text-white truncate" title={displayInfo.label}>
              {displayInfo.label}
            </p>

            {/* Source Badge */}
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

          {/* Manufacturer/Description */}
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

        {/* Action Buttons */}
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
