/**
 * Vertebral Labels Panel Component
 *
 * Manages vertebral body labels for navigation in segmentation mode.
 * This component was moved from ScrewManagementPanel to segmentation mode.
 */

import React, { useState, useEffect } from 'react';
import { crosshairsHandler } from '../../utils/crosshairsHandler';
import { jumpToPosition } from '../Registration/utils/fiducialUtils';
import { CrosshairBookmarks } from '../ScrewManagement/CrosshairBookmarks';
import type { CrosshairBookmark } from '../ScrewManagement/CrosshairBookmarks';

interface VertebralLabelsPanelProps {
  servicesManager: any;
  commandsManager: any;
  extensionManager: any;
}

export const VertebralLabelsPanel: React.FC<VertebralLabelsPanelProps> = ({
  servicesManager,
  commandsManager,
  extensionManager,
}) => {
  // Crosshair Bookmark state
  const [crosshairBookmarks, setCrosshairBookmarks] = useState<CrosshairBookmark[]>([]);
  const [selectedBookmarkId, setSelectedBookmarkId] = useState<string | null>(null);

  // ═══════════════════════════════════════════════════════════════════
  // Crosshair Bookmark Handlers
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Add a new crosshair bookmark at the current crosshair position
   * Returns the newly created bookmark for potential follow-up actions
   */
  const addCrosshairBookmark = (label: string): CrosshairBookmark | null => {
    try {
      console.log(`🏷️ [VertebralLabel] Attempting to save label: ${label}`);

      // Get current crosshair position using fresh read (bypasses cache)
      const position = crosshairsHandler.getFreshCrosshairCenter();

      console.log(`🏷️ [VertebralLabel] Position from getFreshCrosshairCenter:`, position);

      if (!position) {
        alert('⚠️ Could not detect crosshair position.\n\nPlease ensure:\n1. A CT scan is loaded\n2. Crosshairs tool is active\n3. Navigate to the desired vertebral body');
        return null;
      }

      // Validate position values
      if (position.some(v => isNaN(v) || !isFinite(v))) {
        console.error('❌ [VertebralLabel] Invalid position values:', position);
        alert('⚠️ Invalid crosshair position detected. Please try again.');
        return null;
      }

      // Create new bookmark
      const newBookmark: CrosshairBookmark = {
        id: `bookmark-${Date.now()}`,
        label,
        position: [...position] as [number, number, number],
        createdAt: Date.now(),
      };

      setCrosshairBookmarks(prev => [...prev, newBookmark]);
      setSelectedBookmarkId(newBookmark.id);

      console.log(`✅ [VertebralLabel] Saved: ${label} at [${position.map(v => v.toFixed(2)).join(', ')}]`);
      return newBookmark;
    } catch (error) {
      console.error('❌ Error adding vertebral label:', error);
      alert('Failed to add vertebral label. Check console for details.');
      return null;
    }
  };

  /**
   * Navigate to a saved crosshair bookmark position
   */
  const selectCrosshairBookmark = (bookmark: CrosshairBookmark) => {
    try {
      console.log(`📍 Navigating to bookmark: ${bookmark.label}`);
      console.log(`   Position: [${bookmark.position.map(v => v.toFixed(1)).join(', ')}]`);

      // Log orientation if available (PCA-based, shortest axis as axialNormal)
      if (bookmark.orientation) {
        console.log(`   ✅ Orientation data available (PCA-based):`);
        if (bookmark.orientation.axialNormal) {
          console.log(`      Axial Normal (shortest axis): [${bookmark.orientation.axialNormal.map(v => v.toFixed(3)).join(', ')}]`);
        }
        if (bookmark.orientation.sagittalNormal) {
          console.log(`      Sagittal Normal: [${bookmark.orientation.sagittalNormal.map(v => v.toFixed(3)).join(', ')}]`);
        }
        if (bookmark.orientation.coronalNormal) {
          console.log(`      Coronal Normal: [${bookmark.orientation.coronalNormal.map(v => v.toFixed(3)).join(', ')}]`);
        }
      } else {
        console.log(`   ℹ️ No orientation data (using default coordinate system)`);
      }

      // Jump to the bookmarked position
      const success = jumpToPosition(bookmark.position, servicesManager);

      if (success) {
        setSelectedBookmarkId(bookmark.id);
        console.log(`✅ Successfully navigated to ${bookmark.label}`);
      } else {
        console.warn(`⚠️ Navigation to ${bookmark.label} may not have completed fully`);
        setSelectedBookmarkId(bookmark.id);
      }
    } catch (error) {
      console.error('❌ Error navigating to bookmark:', error);
      alert('Failed to navigate to bookmark. Check console for details.');
    }
  };

  /**
   * Update an existing crosshair bookmark with current crosshair position
   */
  const updateCrosshairBookmark = (bookmarkId: string) => {
    try {
      const bookmark = crosshairBookmarks.find(b => b.id === bookmarkId);
      if (!bookmark) {
        console.warn(`⚠️ Bookmark not found: ${bookmarkId}`);
        return;
      }

      console.log(`🔄 [Bookmark] Updating bookmark: ${bookmark.label}`);

      // Get current crosshair position using fresh read
      const position = crosshairsHandler.getFreshCrosshairCenter();

      console.log(`🔄 [Bookmark] New position:`, position);

      if (!position) {
        alert('⚠️ Could not detect crosshair position.\n\nPlease ensure:\n1. A CT scan is loaded\n2. Crosshairs tool is active');
        return;
      }

      // Validate position values
      if (position.some(v => isNaN(v) || !isFinite(v))) {
        console.error('❌ [Bookmark] Invalid position values:', position);
        alert('⚠️ Invalid crosshair position detected. Please try again.');
        return;
      }

      // Update the bookmark
      setCrosshairBookmarks(prev => prev.map(b =>
        b.id === bookmarkId
          ? { ...b, position: [...position] as [number, number, number], createdAt: Date.now() }
          : b
      ));

      console.log(`✅ [Bookmark] Updated: ${bookmark.label} to [${position.map(v => v.toFixed(2)).join(', ')}]`);
    } catch (error) {
      console.error('❌ Error updating crosshair bookmark:', error);
      alert('Failed to update crosshair bookmark. Check console for details.');
    }
  };

  /**
   * Delete a crosshair bookmark
   */
  const deleteCrosshairBookmark = (bookmarkId: string) => {
    const bookmark = crosshairBookmarks.find(b => b.id === bookmarkId);
    if (bookmark) {
      console.log(`🗑️ Deleting bookmark: ${bookmark.label}`);
    }

    setCrosshairBookmarks(prev => prev.filter(b => b.id !== bookmarkId));

    // Clear selection if the deleted bookmark was selected
    if (selectedBookmarkId === bookmarkId) {
      setSelectedBookmarkId(null);
    }
  };

  /**
   * Import crosshair bookmarks from segmentation JSON
   * Used for batch-importing vertebral body labels from generate_vertebrae_crosshairs.py output
   */
  const importCrosshairBookmarks = (importedBookmarks: CrosshairBookmark[]) => {
    if (!importedBookmarks || importedBookmarks.length === 0) {
      console.warn('⚠️ [ImportBookmarks] No bookmarks to import');
      return;
    }

    // Get existing labels to avoid duplicates
    const existingLabels = new Set(crosshairBookmarks.map(b => b.label));

    // Filter out duplicates and add unique timestamp offsets
    const baseTimestamp = Date.now();
    const newBookmarks = importedBookmarks
      .filter(b => !existingLabels.has(b.label))
      .map((b, index) => ({
        ...b,
        id: `imported_${b.label}_${baseTimestamp}`,  // Ensure unique ID
        createdAt: baseTimestamp + index,
      }));

    if (newBookmarks.length === 0) {
      console.warn('⚠️ [ImportBookmarks] All bookmarks already exist');
      return;
    }

    console.log(`📥 [ImportBookmarks] Importing ${newBookmarks.length} vertebral labels:`,
      newBookmarks.map(b => b.label).join(', ')
    );

    // Log orientation data if available
    const withOrientation = newBookmarks.filter(b => b.orientation?.axialNormal).length;
    if (withOrientation > 0) {
      console.log(`   ✅ ${withOrientation} bookmarks include orientation data (PCA-based, shortest axis as axial plane normal)`);
      newBookmarks.forEach(b => {
        if (b.orientation?.axialNormal) {
          console.log(`      ${b.label}:`);
          console.log(`         Axial Normal (shortest axis): [${b.orientation.axialNormal.map(v => v.toFixed(3)).join(', ')}]`);
          if (b.orientation.sagittalNormal) {
            console.log(`         Sagittal Normal: [${b.orientation.sagittalNormal.map(v => v.toFixed(3)).join(', ')}]`);
          }
          if (b.orientation.coronalNormal) {
            console.log(`         Coronal Normal: [${b.orientation.coronalNormal.map(v => v.toFixed(3)).join(', ')}]`);
          }
        }
      });
    } else {
      console.log(`   ℹ️ No orientation data found in imported bookmarks`);
    }

    setCrosshairBookmarks(prev => [...prev, ...newBookmarks]);

    // Select the first imported bookmark
    if (newBookmarks.length > 0) {
      setSelectedBookmarkId(newBookmarks[0].id);
      // Jump to the first imported position
      selectCrosshairBookmark(newBookmarks[0]);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white mb-4">🏷️ Vertebral Labels</h2>

        <CrosshairBookmarks
          bookmarks={crosshairBookmarks}
          selectedBookmarkId={selectedBookmarkId}
          onAddBookmark={addCrosshairBookmark}
          onSelectBookmark={selectCrosshairBookmark}
          onUpdateBookmark={updateCrosshairBookmark}
          onDeleteBookmark={deleteCrosshairBookmark}
          onImportBookmarks={importCrosshairBookmarks}
          // Note: onPlaceScrews is not provided here since this is in segmentation mode, not planning mode
        />
      </div>
    </div>
  );
};

export default VertebralLabelsPanel;
