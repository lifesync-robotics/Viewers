import React from 'react';
import { Icons, Button as ButtonNext } from '@ohif/ui-next';

/**
 * Edit Case Dialog Component
 *
 * LifeSync-specific component for editing surgical case information
 *
 * Usage:
 * import EditCaseDialog from '@lifesync/components/CaseManagement/EditCaseDialog';
 *
 * <EditCaseDialog
 *   isOpen={isEditDialogOpen}
 *   caseData={selectedCase}
 *   onClose={() => setIsEditDialogOpen(false)}
 *   onUpdate={(updates) => handleUpdateCase(selectedCase.caseId, updates)}
 * />
 */

interface EditCaseDialogProps {
  isOpen: boolean;
  caseData: {
    caseId: string;
    patientInfo: {
      mrn: string;
      name?: string;
      dateOfBirth?: string;
    };
    status?: string;
  };
  onClose: () => void;
  onUpdate: (updates: any) => Promise<void>;
}

const EditCaseDialog: React.FC<EditCaseDialogProps> = ({
  isOpen,
  caseData,
  onClose,
  onUpdate,
}) => {
  const [formData, setFormData] = React.useState({
    patientMRN: '',
    patientName: '',
    dateOfBirth: '',
    status: '',
  });
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Initialize form when dialog opens or caseData changes
  React.useEffect(() => {
    if (isOpen && caseData) {
      setFormData({
        patientMRN: caseData.patientInfo?.mrn || '',
        patientName: caseData.patientInfo?.name || '',
        dateOfBirth: caseData.patientInfo?.dateOfBirth || '',
        status: caseData.status || 'created',
      });
      setError(null);
    } else if (!isOpen) {
      // Reset form when dialog closes
      setFormData({
        patientMRN: '',
        patientName: '',
        dateOfBirth: '',
        status: 'created',
      });
      setError(null);
    }
  }, [isOpen, caseData?.caseId, caseData?.patientInfo?.mrn, caseData?.patientInfo?.name, caseData?.patientInfo?.dateOfBirth, caseData?.status]);

  const handleUpdate = async () => {
    setIsUpdating(true);
    setError(null);

    try {
      const updates: any = {};

      // Only include changed fields
      if (formData.patientMRN !== caseData.patientInfo?.mrn) {
        updates.patientInfo = updates.patientInfo || {};
        updates.patientInfo.mrn = formData.patientMRN;
      }

      if (formData.patientName !== caseData.patientInfo?.name) {
        updates.patientInfo = updates.patientInfo || {};
        updates.patientInfo.name = formData.patientName;
      }

      if (formData.dateOfBirth !== caseData.patientInfo?.dateOfBirth) {
        updates.patientInfo = updates.patientInfo || {};
        updates.patientInfo.dateOfBirth = formData.dateOfBirth;
      }

      if (formData.status !== caseData.status) {
        updates.status = formData.status;
      }

      // Check if any fields changed
      if (Object.keys(updates).length === 0) {
        setError('No changes to save');
        return;
      }

      await onUpdate(updates);

      // Close dialog on success
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update case');
    } finally {
      setIsUpdating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-secondary-dark border-secondary-light w-full max-w-md rounded-lg border p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Edit Case</h2>
          <button
            onClick={onClose}
            className="text-primary-light hover:text-white transition-colors"
            disabled={isUpdating}
          >
            <Icons.Close className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded bg-red-500 bg-opacity-20 border border-red-500 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mb-4 rounded bg-blue-500 bg-opacity-20 border border-blue-500/30 p-3 text-sm text-blue-300">
          <div className="font-medium mb-1">ℹ️ Editing Case: {caseData.caseId}</div>
          <div className="text-xs">Only modified fields will be updated</div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-primary-light mb-1 block text-sm font-medium">
              Patient MRN
            </label>
            <input
              type="text"
              value={formData.patientMRN}
              onChange={(e) => setFormData({ ...formData, patientMRN: e.target.value })}
              placeholder="e.g., MRN-12345"
              className="bg-primary-dark text-primary-light border-primary-light w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isUpdating}
            />
          </div>

          <div>
            <label className="text-primary-light mb-1 block text-sm font-medium">
              Patient Name
            </label>
            <input
              type="text"
              value={formData.patientName}
              onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
              placeholder="e.g., John Doe"
              className="bg-primary-dark text-primary-light border-primary-light w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isUpdating}
            />
          </div>

          <div>
            <label className="text-primary-light mb-1 block text-sm font-medium">
              Date of Birth
            </label>
            <input
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
              className="bg-primary-dark text-primary-light border-primary-light w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isUpdating}
            />
          </div>

          <div>
            <label className="text-primary-light mb-1 block text-sm font-medium">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="bg-primary-dark text-primary-light border-primary-light w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isUpdating}
            >
              <option value="created">Created</option>
              <option value="planned">Planned</option>
              <option value="registered">Registered</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <ButtonNext
            variant="ghost"
            onClick={onClose}
            disabled={isUpdating}
          >
            Cancel
          </ButtonNext>
          <ButtonNext
            onClick={handleUpdate}
            disabled={isUpdating}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isUpdating ? 'Updating...' : 'Update Case'}
          </ButtonNext>
        </div>
      </div>
    </div>
  );
};

export default EditCaseDialog;
