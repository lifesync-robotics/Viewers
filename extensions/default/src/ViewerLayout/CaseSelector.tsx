/**
 * CaseSelector Component
 * Dropdown in header for selecting active surgical case
 * Filters WorkList studies when case is selected
 */

import React, { useState, useEffect } from 'react';
import { Button, Icons, useModal } from '@ohif/ui-next';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@ohif/ui-next';
import type { CaseSummary } from '../services/CaseService';

interface CaseSelectorProps {
  servicesManager: any;
}

function CaseSelector({ servicesManager }: CaseSelectorProps) {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { show, hide } = useModal();

  // Get CaseService
  const caseService = servicesManager?.services?.caseService;

  useEffect(() => {
    if (!caseService) {
      console.warn('CaseService not available');
      return;
    }

    // Load initial data
    loadCases();
    const initialCaseId = caseService.getActiveCaseId();
    setActiveCaseId(initialCaseId);

    // Subscribe to case changes
    const subscriptions = [
      caseService.subscribe(caseService.constructor.EVENTS.CASE_CREATED, () => {
        loadCases();
      }),
      caseService.subscribe(caseService.constructor.EVENTS.CASE_DELETED, () => {
        loadCases();
      }),
      caseService.subscribe(caseService.constructor.EVENTS.ACTIVE_CASE_CHANGED, ({ caseId }) => {
        setActiveCaseId(caseId);
      }),
    ];

    return () => {
      subscriptions.forEach(unsub => unsub());
    };
  }, [caseService]);

  const loadCases = async () => {
    if (!caseService) {
      return;
    }

    setIsLoading(true);
    try {
      const fetchedCases = await caseService.getCases();
      setCases(fetchedCases);
    } catch (error) {
      console.error('Failed to load cases:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCaseChange = async (caseId: string) => {
    if (!caseService) {
      return;
    }

    if (caseId === 'none') {
      await caseService.setActiveCaseId(null);
    } else if (caseId === 'create') {
      showCreateCaseDialog();
    } else {
      await caseService.setActiveCaseId(caseId);
    }
  };

  const showCreateCaseDialog = () => {
    show({
      title: 'Create New Case',
      content: CreateCaseDialog,
      contentProps: {
        caseService,
        onClose: hide,
        onCreated: newCase => {
          setCases(prev => {
            const exists = prev.some(c => c.caseId === newCase.caseId);
            return exists
              ? prev.map(c => (c.caseId === newCase.caseId ? newCase : c))
              : [...prev, newCase];
          });
          loadCases();
          caseService.setActiveCaseId(newCase.caseId);
          hide();
        },
      },
      containerClassName: 'max-w-md',
    });
  };

  // Find active case
  const activeCase = cases.find(c => c.caseId === activeCaseId);

  return (
    <div className="flex items-center gap-2">
      <span className="text-primary-light text-sm font-medium">Case:</span>
      <Select
        value={activeCaseId || 'none'}
        onValueChange={handleCaseChange}
        disabled={isLoading}
      >
        <SelectTrigger className="bg-primary-dark hover:bg-primary text-primary-active border-primary-light min-w-[200px]">
          <SelectValue>
            {isLoading ? (
              'Loading...'
            ) : activeCase ? (
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs">{activeCase.caseId}</span>
                <span className="text-primary-light">•</span>
                <span className="max-w-[120px] truncate">
                  {activeCase.patientInfo.name || activeCase.patientInfo.mrn}
                </span>
              </div>
            ) : (
              'No Case Selected'
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-primary-dark border-primary-light">
          <SelectItem
            value="none"
            className="hover:bg-primary"
          >
            <span className="text-primary-light italic">No Case Selected (View All)</span>
          </SelectItem>
          <div className="border-primary-light my-1 border-t" />
          {cases.map(caseItem => (
            <SelectItem
              key={caseItem.caseId}
              value={caseItem.caseId}
              className="hover:bg-primary"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-primary-active font-mono text-xs">{caseItem.caseId}</span>
                  <span className="text-primary-light text-xs">
                    {caseItem.patientInfo.name || caseItem.patientInfo.mrn}
                  </span>
                </div>
                <span className="text-primary-light text-xs">
                  {caseItem.studyCount} {caseItem.studyCount === 1 ? 'study' : 'studies'}
                </span>
              </div>
            </SelectItem>
          ))}
          <div className="border-primary-light my-1 border-t" />
          <SelectItem
            value="create"
            className="hover:bg-primary"
          >
            <div className="flex items-center gap-2 text-blue-400">
              <Icons.Plus className="h-4 w-4" />
              <span>Create New Case</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      {activeCase && (
        <div className="text-primary-light flex items-center gap-1 text-xs">
          <span>•</span>
          <span>{activeCase.studyCount} studies</span>
          {activeCase.primaryReference && (
            <>
              <span>•</span>
              <span className="font-medium">{activeCase.primaryReference.modality} Reference</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Create Case Dialog Component
 */
function CreateCaseDialog({ caseService, onClose, onCreated }) {
  const [mrn, setMrn] = useState('');
  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!mrn.trim()) {
      setError('Patient MRN is required');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const newCase = await caseService.createCase({
        mrn: mrn.trim(),
        name: name.trim() || undefined,
        dateOfBirth: dateOfBirth.trim() || undefined,
      });

      onCreated(newCase);
    } catch (err) {
      setError(err.message || 'Failed to create case');
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {error && (
        <div className="rounded border border-red-500 bg-red-900/20 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label className="text-primary-light text-sm font-medium">
          Patient MRN <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={mrn}
          onChange={e => setMrn(e.target.value)}
          placeholder="Enter patient MRN"
          className="bg-primary-dark border-primary-light text-primary-active rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isCreating}
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-primary-light text-sm font-medium">Patient Name (Optional)</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Smith^John"
          className="bg-primary-dark border-primary-light text-primary-active rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isCreating}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-primary-light text-sm font-medium">Date of Birth (Optional)</label>
        <input
          type="date"
          value={dateOfBirth}
          onChange={e => setDateOfBirth(e.target.value)}
          className="bg-primary-dark border-primary-light text-primary-active rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isCreating}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button
          variant="ghost"
          onClick={onClose}
          disabled={isCreating}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleCreate}
          disabled={isCreating || !mrn.trim()}
        >
          {isCreating ? 'Creating...' : 'Create Case'}
        </Button>
      </div>
    </div>
  );
}

export default CaseSelector;
