/**
 * ReferenceMarkerSelector - Component for selecting reference marker
 *
 * Fetches available markers from Asset Management API and allows user to select one
 */

import React, { useState, useEffect } from 'react';

interface Marker {
  marker_id: string;
  name: string;
  marker_type: string;
  rom_file_path?: string;
  marker_count?: number;
  description?: string;
}

interface ReferenceMarkerSelectorProps {
  selectedMarkerId?: string;
  onSelect: (markerId: string | undefined) => void;
  disabled?: boolean;
}

const ReferenceMarkerSelector: React.FC<ReferenceMarkerSelectorProps> = ({
  selectedMarkerId,
  onSelect,
  disabled = false,
}) => {
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Phase 4: Always use relative paths (webpack proxy handles routing)
  const getApiBase = () => {
    return '';
  };

  // Load markers
  useEffect(() => {
    const loadMarkers = async () => {
      try {
        setLoading(true);
        setError(null);

        const apiBase = getApiBase();
        const response = await fetch(`${apiBase}/api/assets/markers/search?limit=100`);

        if (!response.ok) {
          throw new Error(`Failed to load markers: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
          // Map markers to ensure consistent field names
          const mappedMarkers = (result.markers || []).map((marker: any) => ({
            ...marker,
            marker_id: marker.id || marker.marker_id, // Support both field names
          }));
          console.log('Loaded markers:', mappedMarkers);
          setMarkers(mappedMarkers);
        } else {
          setError(result.error || 'Failed to load markers');
        }
      } catch (err) {
        setError(`Failed to load markers: ${err.message}`);
        console.error('Error loading markers:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMarkers();
  }, []);

  // Filter markers by search term
  const filteredMarkers = markers.filter(marker =>
    marker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    marker.marker_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get selected marker details
  const selectedMarker = markers.find(m => m.marker_id === selectedMarkerId);

  return (
    <div className="reference-marker-selector">
      {loading && <div className="loading-spinner">Loading markers...</div>}

      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">⚠️</span>
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Search */}
          <div className="form-group">
            <input
              type="text"
              placeholder="Search markers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
              disabled={disabled}
            />
          </div>

          {/* Marker Selection */}
          <div className="form-group">
            <label htmlFor="marker-select">Select Reference Marker</label>
            <select
              id="marker-select"
              value={selectedMarkerId || ''}
              onChange={(e) => onSelect(e.target.value || undefined)}
              className="form-select"
              disabled={disabled}
            >
              <option value="">-- None --</option>
              {filteredMarkers.map(marker => (
                <option key={marker.marker_id} value={marker.marker_id}>
                  {marker.name} ({marker.marker_id})
                </option>
              ))}
            </select>
          </div>

          {/* Selected Marker Details */}
          {selectedMarker && (
            <div className="marker-details">
              <h4>Marker Details</h4>
              <div className="detail-row">
                <span className="detail-label">ID:</span>
                <span className="detail-value">{selectedMarker.marker_id}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Name:</span>
                <span className="detail-value">{selectedMarker.name}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Type:</span>
                <span className="detail-value">{selectedMarker.marker_type}</span>
              </div>
              {selectedMarker.rom_file_path && (
                <div className="detail-row">
                  <span className="detail-label">ROM File:</span>
                  <span className="detail-value">{selectedMarker.rom_file_path}</span>
                </div>
              )}
              {selectedMarker.marker_count && (
                <div className="detail-row">
                  <span className="detail-label">Marker Count:</span>
                  <span className="detail-value">{selectedMarker.marker_count}</span>
                </div>
              )}
              {selectedMarker.description && (
                <div className="detail-row">
                  <span className="detail-label">Description:</span>
                  <span className="detail-value">{selectedMarker.description}</span>
                </div>
              )}
            </div>
          )}

          {/* No markers found */}
          {filteredMarkers.length === 0 && markers.length > 0 && (
            <div className="no-results">
              No markers found matching "{searchTerm}"
            </div>
          )}

          {/* No markers available */}
          {markers.length === 0 && (
            <div className="no-results">
              No markers available. Please register markers in Asset Management.
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReferenceMarkerSelector;
