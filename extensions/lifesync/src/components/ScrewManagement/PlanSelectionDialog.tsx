/**
 * PlanSelectionDialog Component
 *
 * Dialog for selecting and loading saved surgical plans
 */

import React, { useState, useEffect } from 'react';

interface Plan {
  plan_id: string;
  name: string;
  case_id: string;
  series_instance_uid: string;
  surgeon: string;
  status: string;
  screw_count: number;
  rod_count: number;
  created_at: string;
}

interface PlanSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan: (planId: string) => void;
  caseId?: string;
  seriesInstanceUID?: string;
}

export default function PlanSelectionDialog({
  isOpen,
  onClose,
  onSelectPlan,
  caseId,
  seriesInstanceUID
}: PlanSelectionDialogProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterBy, setFilterBy] = useState<'case' | 'series'>('series');

  useEffect(() => {
    if (isOpen) {
      loadPlans();
    }
  }, [isOpen, filterBy, caseId, seriesInstanceUID]);

  const loadPlans = async () => {
    setIsLoading(true);
    setError(null);

    try {
      let url = '';

      if (filterBy === 'case' && caseId) {
        url = `/api/planning/plan/${caseId}/list`;
      } else if (filterBy === 'series' && seriesInstanceUID) {
        url = `/api/planning/plan/by-series/${seriesInstanceUID}`;
      } else {
        throw new Error('Missing case ID or series UID');
      }

      console.log('📥 Loading plans from:', url);

      const response = await fetch(url, {
        credentials: 'include'
      });
      const data = await response.json();

      if (data.success) {
        setPlans(data.plans || []);
        console.log(`✅ Loaded ${data.plans?.length || 0} plans`);
      } else {
        throw new Error(data.error || 'Failed to load plans');
      }
    } catch (err) {
      console.error('❌ Error loading plans:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPlan = (planId: string) => {
    onSelectPlan(planId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">📋 Load Surgical Plan</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Filter Options */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex gap-2">
            <button
              onClick={() => setFilterBy('series')}
              className={`px-3 py-2 rounded text-sm font-medium ${
                filterBy === 'series'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              📊 By DICOM Series
            </button>
            <button
              onClick={() => setFilterBy('case')}
              className={`px-3 py-2 rounded text-sm font-medium ${
                filterBy === 'case'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              disabled={!caseId}
            >
              📁 By Case ID
            </button>
          </div>
          {filterBy === 'series' && seriesInstanceUID && (
            <p className="text-xs text-gray-400 mt-2">
              Series: {seriesInstanceUID.substring(0, 30)}...
            </p>
          )}
          {filterBy === 'case' && caseId && (
            <p className="text-xs text-gray-400 mt-2">
              Case: {caseId}
            </p>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin text-4xl mb-2">🔄</div>
              <p className="text-gray-400">Loading plans...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-900 bg-opacity-30 border border-red-600 rounded text-red-300">
              <p className="font-bold mb-1">❌ Error</p>
              <p className="text-sm">{error}</p>
              <button
                onClick={loadPlans}
                className="mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
              >
                🔄 Retry
              </button>
            </div>
          )}

          {!isLoading && !error && plans.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <p className="text-4xl mb-2">📭</p>
              <p>No saved plans found</p>
              <p className="text-sm mt-1">
                {filterBy === 'series' ? 'for this DICOM series' : 'for this case'}
              </p>
            </div>
          )}

          {!isLoading && !error && plans.length > 0 && (
            <div className="space-y-2">
              {plans.map((plan) => (
                <div
                  key={plan.plan_id}
                  className="p-4 bg-gray-700 hover:bg-gray-600 rounded cursor-pointer border border-gray-600 hover:border-blue-500 transition-colors"
                  onClick={() => handleSelectPlan(plan.plan_id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-white mb-1">{plan.name}</h3>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
                        <div>
                          <span className="text-gray-400">Plan ID:</span>{' '}
                          {plan.plan_id.substring(0, 20)}...
                        </div>
                        <div>
                          <span className="text-gray-400">Status:</span>{' '}
                          <span className={`font-medium ${
                            plan.status === 'final' ? 'text-green-400' :
                            plan.status === 'saved' ? 'text-blue-400' :
                            'text-yellow-400'
                          }`}>
                            {plan.status}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Surgeon:</span> {plan.surgeon}
                        </div>
                        <div>
                          <span className="text-gray-400">Created:</span>{' '}
                          {new Date(plan.created_at).toLocaleString()}
                        </div>
                        <div>
                          <span className="text-gray-400">Screws:</span>{' '}
                          <span className="font-bold text-blue-400">{plan.screw_count}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Rods:</span>{' '}
                          <span className="font-bold text-purple-400">{plan.rod_count}</span>
                        </div>
                      </div>
                    </div>
                    <div className="ml-4 text-2xl">📋</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}


