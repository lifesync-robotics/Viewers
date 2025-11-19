/**
 * InstrumentSelector - Component for selecting multiple instruments
 * 
 * Fetches available instruments from Asset Management API and allows multi-selection
 * Also supports alternative ROM selection per instrument
 */

import React, { useState, useEffect } from 'react';

interface Instrument {
  instrument_id: string;
  name: string;
  instrument_type: string;
  model_file_path?: string;
  rom_file_path?: string;
  alternative_roms?: Array<{
    name: string;
    rom_file_path: string;
    description?: string;
  }>;
  marker_id?: string;
  description?: string;
}

interface InstrumentSelectorProps {
  selectedInstrumentIds: string[];
  alternativeRomSelections: { [instrumentId: string]: string };
  onInstrumentToggle: (instrumentId: string, enabled: boolean) => void;
  onAlternativeRomChange: (instrumentId: string, romName: string) => void;
  disabled?: boolean;
}

const InstrumentSelector: React.FC<InstrumentSelectorProps> = ({
  selectedInstrumentIds,
  alternativeRomSelections,
  onInstrumentToggle,
  onAlternativeRomChange,
  disabled = false,
}) => {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Get API base URL
  const getApiBase = () => {
    return window.location.port === '8081' ? '' : 'http://localhost:3001';
  };

  // Load instruments
  useEffect(() => {
    const loadInstruments = async () => {
      try {
        setLoading(true);
        setError(null);

        const apiBase = getApiBase();
        const response = await fetch(`${apiBase}/api/assets/instruments/search?limit=100`);
        
        if (!response.ok) {
          throw new Error(`Failed to load instruments: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
          setInstruments(result.instruments || []);
        } else {
          setError(result.error || 'Failed to load instruments');
        }
      } catch (err) {
        setError(`Failed to load instruments: ${err.message}`);
        console.error('Error loading instruments:', err);
      } finally {
        setLoading(false);
      }
    };

    loadInstruments();
  }, []);

  // Filter instruments by search term
  const filteredInstruments = instruments.filter(instrument =>
    instrument.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    instrument.instrument_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Check if instrument is selected
  const isSelected = (instrumentId: string) => {
    return selectedInstrumentIds.includes(instrumentId);
  };

  // Get available ROMs for instrument
  const getAvailableRoms = (instrument: Instrument) => {
    const roms = [{ name: 'default', description: 'Default ROM' }];
    if (instrument.alternative_roms) {
      roms.push(...instrument.alternative_roms.map(rom => ({
        name: rom.name,
        description: rom.description || rom.name,
      })));
    }
    return roms;
  };

  return (
    <div className="instrument-selector">
      {loading && <div className="loading-spinner">Loading instruments...</div>}
      
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
              placeholder="Search instruments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
              disabled={disabled}
            />
          </div>

          {/* Instrument List */}
          <div className="instrument-list">
            {filteredInstruments.map(instrument => {
              const selected = isSelected(instrument.instrument_id);
              const availableRoms = getAvailableRoms(instrument);
              const currentRom = alternativeRomSelections[instrument.instrument_id] || 'default';

              return (
                <div key={instrument.instrument_id} className="instrument-item">
                  {/* Checkbox and Name */}
                  <div className="instrument-header">
                    <label className="instrument-checkbox">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => onInstrumentToggle(instrument.instrument_id, e.target.checked)}
                        disabled={disabled}
                      />
                      <span className="instrument-name">{instrument.name}</span>
                      <span className="instrument-id">({instrument.instrument_id})</span>
                    </label>
                  </div>

                  {/* Details and ROM Selection (when selected) */}
                  {selected && (
                    <div className="instrument-details">
                      <div className="detail-row">
                        <span className="detail-label">Type:</span>
                        <span className="detail-value">{instrument.instrument_type}</span>
                      </div>
                      {instrument.description && (
                        <div className="detail-row">
                          <span className="detail-label">Description:</span>
                          <span className="detail-value">{instrument.description}</span>
                        </div>
                      )}
                      
                      {/* Alternative ROM Selection */}
                      {availableRoms.length > 1 && (
                        <div className="rom-selection">
                          <label htmlFor={`rom-${instrument.instrument_id}`}>ROM File:</label>
                          <select
                            id={`rom-${instrument.instrument_id}`}
                            value={currentRom}
                            onChange={(e) => onAlternativeRomChange(instrument.instrument_id, e.target.value)}
                            className="form-select"
                            disabled={disabled}
                          >
                            {availableRoms.map(rom => (
                              <option key={rom.name} value={rom.name}>
                                {rom.description}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Selection Summary */}
          {selectedInstrumentIds.length > 0 && (
            <div className="selection-summary">
              <strong>{selectedInstrumentIds.length}</strong> instrument(s) selected
            </div>
          )}

          {/* No instruments found */}
          {filteredInstruments.length === 0 && instruments.length > 0 && (
            <div className="no-results">
              No instruments found matching "{searchTerm}"
            </div>
          )}

          {/* No instruments available */}
          {instruments.length === 0 && (
            <div className="no-results">
              No instruments available. Please register instruments in Asset Management.
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InstrumentSelector;

