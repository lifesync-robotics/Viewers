/**
 * CrosshairBookmarks Component (Vertebral Labels)
 *
 * Manages crosshair position labels for vertebral body navigation
 * - Save current crosshair position with vertebral body label
 * - Select label to navigate to saved position
 * - Option to place bilateral screws (L/R) after adding a label
 * - Delete labels
 */

import React, { useState } from 'react';

// ═══════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════

export interface CrosshairBookmark {
  id: string;
  label: string;
  position: [number, number, number];
  createdAt: number;
}

// Screw placement request with position offset
export interface ScrewPlacementRequest {
  label: string;  // e.g., "L4-L" or "L4-R"
  position: [number, number, number];  // World coordinates
  side: 'left' | 'right';
}

interface CrosshairBookmarksProps {
  bookmarks: CrosshairBookmark[];
  selectedBookmarkId: string | null;
  onAddBookmark: (label: string) => CrosshairBookmark | null;  // Returns the created bookmark
  onSelectBookmark: (bookmark: CrosshairBookmark) => void;
  onUpdateBookmark: (bookmarkId: string) => void;
  onDeleteBookmark: (bookmarkId: string) => void;
  onPlaceScrews?: (requests: ScrewPlacementRequest[]) => void;
}

// ═══════════════════════════════════════════════════════
// Vertebral Body Options
// ═══════════════════════════════════════════════════════

const VERTEBRAL_LEVELS = [
  // Cervical
  'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7',
  // Thoracic
  'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12',
  // Lumbar
  'L1', 'L2', 'L3', 'L4', 'L5',
  // Sacral
  'S1', 'S2',
];

// Lateral offset for screw placement (mm)
const SCREW_LATERAL_OFFSET_MM = 15;

// ═══════════════════════════════════════════════════════
// Add Label Dialog
// ═══════════════════════════════════════════════════════

interface AddLabelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (label: string) => void;
  existingLabels: string[];
}

const AddLabelDialog: React.FC<AddLabelDialogProps> = ({
  isOpen,
  onClose,
  onAdd,
  existingLabels,
}) => {
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [customLabel, setCustomLabel] = useState('');
  const [useCustom, setUseCustom] = useState(false);

  if (!isOpen) return null;

  const handleAdd = () => {
    const label = useCustom ? customLabel.trim() : selectedLevel;
    if (!label) {
      alert('Please select or enter a vertebral level');
      return;
    }
    if (existingLabels.includes(label)) {
      alert(`A label for "${label}" already exists`);
      return;
    }
    onAdd(label);
    setSelectedLevel('');
    setCustomLabel('');
    setUseCustom(false);
    onClose();
  };

  const handleClose = () => {
    setSelectedLevel('');
    setCustomLabel('');
    setUseCustom(false);
    onClose();
  };

  // Filter out already labeled levels
  const availableLevels = VERTEBRAL_LEVELS.filter(level => !existingLabels.includes(level));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-96 overflow-hidden">
        {/* Header */}
        <div className="bg-teal-700 p-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">🏷️ Add Vertebral Label</h3>
          <button
            onClick={handleClose}
            className="text-white hover:text-gray-200 text-xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-300">
            Save the current crosshair position with a vertebral body label.
          </p>

          {/* Toggle between preset and custom */}
          <div className="flex gap-2">
            <button
              onClick={() => setUseCustom(false)}
              className={`flex-1 px-3 py-2 rounded text-sm font-medium transition ${
                !useCustom
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Preset Levels
            </button>
            <button
              onClick={() => setUseCustom(true)}
              className={`flex-1 px-3 py-2 rounded text-sm font-medium transition ${
                useCustom
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Custom Label
            </button>
          </div>

          {!useCustom ? (
            /* Preset Level Selection */
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Select Vertebral Level:</label>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-teal-500 focus:outline-none"
              >
                <option value="">-- Select Level --</option>
                <optgroup label="Cervical">
                  {availableLevels.filter(l => l.startsWith('C')).map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </optgroup>
                <optgroup label="Thoracic">
                  {availableLevels.filter(l => l.startsWith('T')).map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </optgroup>
                <optgroup label="Lumbar">
                  {availableLevels.filter(l => l.startsWith('L')).map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </optgroup>
                <optgroup label="Sacral">
                  {availableLevels.filter(l => l.startsWith('S')).map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          ) : (
            /* Custom Label Input */
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Enter Custom Label:</label>
              <input
                type="text"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="e.g., L4-L5 Disc, Custom Point"
                className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-teal-500 focus:outline-none"
              />
            </div>
          )}

          <p className="text-xs text-gray-500">
            💡 The current crosshair position will be saved with this label.
          </p>
        </div>

        {/* Footer */}
        <div className="bg-gray-700 p-4 flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={useCustom ? !customLabel.trim() : !selectedLevel}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🏷️ Save Label
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// Place Screws Confirmation Dialog
// ═══════════════════════════════════════════════════════

interface PlaceScrewsDialogProps {
  isOpen: boolean;
  label: string;
  position: [number, number, number];
  onClose: () => void;
  onConfirm: (placeBoth: boolean, placeLeft: boolean, placeRight: boolean) => void;
}

const PlaceScrewsDialog: React.FC<PlaceScrewsDialogProps> = ({
  isOpen,
  label,
  position,
  onClose,
  onConfirm,
}) => {
  const [placeLeft, setPlaceLeft] = useState(true);
  const [placeRight, setPlaceRight] = useState(true);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!placeLeft && !placeRight) {
      onClose();
      return;
    }
    onConfirm(placeLeft && placeRight, placeLeft, placeRight);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-96 overflow-hidden">
        {/* Header */}
        <div className="bg-green-700 p-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">🔩 Place Pedicle Screws?</h3>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-300">
            Vertebral label <span className="text-teal-400 font-bold">{label}</span> has been saved.
          </p>
          <p className="text-sm text-gray-300">
            Would you like to place pedicle screws at this level?
          </p>

          {/* Screw placement options */}
          <div className="bg-gray-700 rounded p-3 space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="placeLeft"
                checked={placeLeft}
                onChange={(e) => setPlaceLeft(e.target.checked)}
                className="w-4 h-4 accent-green-500"
              />
              <label htmlFor="placeLeft" className="text-white text-sm flex-1">
                <span className="font-medium">{label}-L</span>
                <span className="text-gray-400 ml-2">(Left, 15mm lateral)</span>
              </label>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="placeRight"
                checked={placeRight}
                onChange={(e) => setPlaceRight(e.target.checked)}
                className="w-4 h-4 accent-green-500"
              />
              <label htmlFor="placeRight" className="text-white text-sm flex-1">
                <span className="font-medium">{label}-R</span>
                <span className="text-gray-400 ml-2">(Right, 15mm lateral)</span>
              </label>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            💡 Screws will be placed {SCREW_LATERAL_OFFSET_MM}mm to the left/right of the vertebral center on the axial plane.
          </p>
        </div>

        {/* Footer */}
        <div className="bg-gray-700 p-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm"
          >
            Skip
          </button>
          <button
            onClick={handleConfirm}
            disabled={!placeLeft && !placeRight}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🔩 Place Screws
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════

export const CrosshairBookmarks: React.FC<CrosshairBookmarksProps> = ({
  bookmarks,
  selectedBookmarkId,
  onAddBookmark,
  onSelectBookmark,
  onUpdateBookmark,
  onDeleteBookmark,
  onPlaceScrews,
}) => {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [pendingScrewPlacement, setPendingScrewPlacement] = useState<{
    label: string;
    position: [number, number, number];
  } | null>(null);

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const bookmarkId = e.target.value;
    if (bookmarkId) {
      const bookmark = bookmarks.find(b => b.id === bookmarkId);
      if (bookmark) {
        onSelectBookmark(bookmark);
      }
    }
  };

  const handleDelete = (bookmarkId: string) => {
    onDeleteBookmark(bookmarkId);
    setShowDeleteConfirm(null);
  };

  // Handle label added - show screw placement dialog
  const handleLabelAdded = (label: string) => {
    // Add the bookmark and get the created bookmark with position
    const newBookmark = onAddBookmark(label);

    // If bookmark was created successfully and screw placement is available, show dialog
    if (newBookmark && onPlaceScrews) {
      setPendingScrewPlacement({
        label: newBookmark.label,
        position: newBookmark.position,
      });
    }
  };

  // Handle screw placement confirmation
  const handlePlaceScrewsConfirm = (placeBoth: boolean, placeLeft: boolean, placeRight: boolean) => {
    if (!pendingScrewPlacement || !onPlaceScrews) {
      setPendingScrewPlacement(null);
      return;
    }

    const { label, position } = pendingScrewPlacement;
    const requests: ScrewPlacementRequest[] = [];

    // Calculate positions on axial plane (X is left/right in patient coordinates)
    // Left side: negative X offset (patient's left)
    // Right side: positive X offset (patient's right)
    if (placeLeft) {
      requests.push({
        label: `${label}-L`,
        position: [
          position[0] - SCREW_LATERAL_OFFSET_MM,  // Left = negative X
          position[1],
          position[2],
        ],
        side: 'left',
      });
    }

    if (placeRight) {
      requests.push({
        label: `${label}-R`,
        position: [
          position[0] + SCREW_LATERAL_OFFSET_MM,  // Right = positive X
          position[1],
          position[2],
        ],
        side: 'right',
      });
    }

    console.log(`🔩 [VertebralLabel] Placing screws:`, requests);
    onPlaceScrews(requests);
    setPendingScrewPlacement(null);
  };

  const selectedBookmark = bookmarks.find(b => b.id === selectedBookmarkId);

  return (
    <div className="space-y-2 border border-teal-600 rounded p-3 bg-teal-900 bg-opacity-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white text-sm">🏷️ Vertebral Labels</h3>
        <span className="text-xs text-gray-400">
          {bookmarks.length} label{bookmarks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Label Selection Row */}
      <div className="flex gap-2 items-center">
        {/* Dropdown */}
        <div className="flex-1">
          <select
            value={selectedBookmarkId || ''}
            onChange={handleSelect}
            className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-teal-500 focus:outline-none text-sm"
          >
            <option value="">-- Select Label --</option>
            {bookmarks.map(bookmark => (
              <option key={bookmark.id} value={bookmark.id}>
                {bookmark.label}
              </option>
            ))}
          </select>
        </div>

        {/* Add Button */}
        <button
          onClick={() => setShowAddDialog(true)}
          className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded text-sm font-medium transition flex items-center gap-1"
          title="Add new vertebral label"
        >
          <span>➕</span>
          <span>Add</span>
        </button>

        {/* Update Button - Only visible when label selected */}
        {selectedBookmarkId && (
          <button
            onClick={() => onUpdateBookmark(selectedBookmarkId)}
            className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm font-medium transition"
            title="Update label with current crosshair position"
          >
            🔄
          </button>
        )}

        {/* Delete Button - Only visible when label selected */}
        {selectedBookmarkId && (
          <button
            onClick={() => setShowDeleteConfirm(selectedBookmarkId)}
            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition"
            title="Delete selected label"
          >
            🗑️
          </button>
        )}
      </div>

      {/* Selected Label Info */}
      {selectedBookmark && (
        <div className="bg-gray-800 bg-opacity-50 rounded p-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-teal-300 font-medium">
              🏷️ {selectedBookmark.label}
            </span>
            <span className="text-gray-500">
              {new Date(selectedBookmark.createdAt).toLocaleTimeString()}
            </span>
          </div>
          <div className="text-gray-400 mt-1 font-mono">
            Position: [{selectedBookmark.position.map(v => v.toFixed(1)).join(', ')}]
          </div>
        </div>
      )}

      {/* Help Text */}
      <p className="text-xs text-gray-400">
        💡 Position crosshairs at vertebral body center, then click "Add" to create label.
      </p>

      {/* Add Label Dialog */}
      <AddLabelDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={handleLabelAdded}
        existingLabels={bookmarks.map(b => b.label)}
      />

      {/* Place Screws Dialog */}
      {pendingScrewPlacement && (
        <PlaceScrewsDialog
          isOpen={true}
          label={pendingScrewPlacement.label}
          position={pendingScrewPlacement.position}
          onClose={() => setPendingScrewPlacement(null)}
          onConfirm={handlePlaceScrewsConfirm}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-xl w-80 p-4">
            <h4 className="text-white font-bold mb-2">🗑️ Delete Label?</h4>
            <p className="text-gray-300 text-sm mb-4">
              Are you sure you want to delete the label "
              {bookmarks.find(b => b.id === showDeleteConfirm)?.label}"?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrosshairBookmarks;
