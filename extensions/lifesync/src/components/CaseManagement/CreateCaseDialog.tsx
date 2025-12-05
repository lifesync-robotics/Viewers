import React from 'react';
import { Icons, Button as ButtonNext, Calendar, Popover, PopoverContent, PopoverTrigger } from '@ohif/ui-next';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format, parse, isValid } from 'date-fns';

/**
 * Create Case Dialog Component
 *
 * LifeSync-specific component for creating new surgical cases
 *
 * Usage:
 * import { CreateCaseDialog } from '@lifesync/components/CaseManagement';
 *
 * <CreateCaseDialog
 *   isOpen={isCreateDialogOpen}
 *   onClose={() => setIsCreateDialogOpen(false)}
 *   onCreateCase={(patientInfo) => handleCreateCase(patientInfo)}
 *   servicesManager={servicesManager}
 * />
 */

interface CreateCaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateCase: (patientInfo: any) => Promise<any>;
  servicesManager?: any;
}

const CreateCaseDialog: React.FC<CreateCaseDialogProps> = ({
  isOpen,
  onClose,
  onCreateCase,
  servicesManager,
}) => {
  const [formData, setFormData] = React.useState({
    patientName: '',
    patientMRN: '',
    dateOfBirth: '',
  });
  const [isCreating, setIsCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const autoCloseTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false);

  // Reset form when dialog opens/closes
  React.useEffect(() => {
    if (!isOpen) {
      setFormData({
        patientName: '',
        patientMRN: '',
        dateOfBirth: '',
      });
      setError(null);
      setSuccess(null);
      // Clear auto-close timer if dialog is closed
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    }
  }, [isOpen]);

  // Auto-close dialog after successful case creation
  React.useEffect(() => {
    if (success) {
      // Clear any existing timer
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
      
      // Set new timer to auto-close after 200ms
      autoCloseTimerRef.current = setTimeout(() => {
        setFormData({
          patientName: '',
          patientMRN: '',
          dateOfBirth: '',
        });
        setSuccess(null);
        onClose();
        autoCloseTimerRef.current = null;
      }, 200);
    }

    // Cleanup timer on unmount or when success changes
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    };
  }, [success, onClose]);


  const handleCreate = async () => {
    // All fields are optional with new API!
    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      // Auto-generate MRN if not provided: LSR-{timestamp}
      const mrn = formData.patientMRN.trim() || `LSR-${Date.now()}`;

      // Pass patient info
      const patientInfo = {
        mrn: mrn,
        name: formData.patientName || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
      };

      const newCase = await onCreateCase(patientInfo);

      // Show success message
      setSuccess(`Case created successfully! ID: ${newCase.caseId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create case');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-secondary-dark border-secondary-light w-full max-w-md rounded-lg border p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Create New Case</h2>
          <button
            onClick={onClose}
            className="text-primary-light hover:text-white transition-colors"
            disabled={isCreating}
          >
            <Icons.Close className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500 bg-opacity-20 border-2 border-red-500 p-4 text-sm text-red-200 shadow-lg">
            <div className="flex items-start gap-2">
              <span className="text-lg">❌</span>
              <div>
                <div className="font-semibold mb-1">Error</div>
                <div>{error}</div>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg bg-green-500 bg-opacity-20 border-2 border-green-500 p-4 text-sm text-green-200 shadow-lg animate-pulse">
            <div className="flex items-start gap-2">
              <span className="text-lg">✅</span>
              <div>
                <div className="font-semibold mb-1">Success!</div>
                <div>{success}</div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4 rounded bg-blue-500 bg-opacity-20 border border-blue-500/30 p-3 text-sm text-blue-300">
          <div className="font-medium mb-1">✨ Auto-Generation:</div>
          <div className="text-xs">• Case ID: Snowflake ID (numeric)</div>
          <div className="text-xs">• MRN: LSR-{'{'}timestamp{'}'} (if not provided)</div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-primary-light mb-1 block text-sm font-medium">
              Patient MRN <span className="text-xs text-gray-400">(Auto-generated if empty)</span>
            </label>
            <input
              type="text"
              value={formData.patientMRN}
              onChange={(e) => setFormData({ ...formData, patientMRN: e.target.value })}
              placeholder="Leave empty for LSR-{timestamp}"
              className="bg-primary-dark text-primary-light border-primary-light w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isCreating}
            />
          </div>

          <div>
            <label className="text-primary-light mb-1 block text-sm font-medium">
              Patient Name <span className="text-xs text-gray-400">(Optional)</span>
            </label>
            <input
              type="text"
              value={formData.patientName}
              onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
              placeholder="e.g., John Doe"
              className="bg-primary-dark text-primary-light border-primary-light w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isCreating}
            />
          </div>

          <div>
            <label className="text-primary-light mb-1 block text-sm font-medium">
              Date of Birth <span className="text-xs text-gray-400">(Optional)</span>
            </label>
            <div className="flex gap-2">
              {/* Manual input field */}
              <input
                type="date"
                lang="en"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                className="bg-primary-dark text-primary-light border-primary-light flex-1 rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isCreating}
              />
              {/* Calendar picker button */}
              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                    disabled={isCreating}
                    className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 border border-blue-500 rounded px-2 py-2 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-secondary-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg hover:shadow-xl w-8 h-8"
                    title="Select Date"
                  >
                    <CalendarIcon className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-auto p-0 bg-secondary-dark border-secondary-light"
                  align="end"
                >
                  <Calendar
                    mode="single"
                    selected={formData.dateOfBirth && isValid(parse(formData.dateOfBirth, 'yyyy-MM-dd', new Date()))
                      ? parse(formData.dateOfBirth, 'yyyy-MM-dd', new Date())
                      : undefined}
                    onSelect={(date) => {
                      if (date) {
                        setFormData({ 
                          ...formData, 
                          dateOfBirth: format(date, 'yyyy-MM-dd') 
                        });
                        setIsDatePickerOpen(false);
                      }
                    }}
                    defaultMonth={formData.dateOfBirth && isValid(parse(formData.dateOfBirth, 'yyyy-MM-dd', new Date()))
                      ? parse(formData.dateOfBirth, 'yyyy-MM-dd', new Date())
                      : new Date()}
                    className="rounded-md border-0"
                    formatters={{
                      formatMonthCaption: (month, options) => {
                        return String(month.getMonth() + 1).padStart(2, '0');
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          {success ? (
            <ButtonNext
              onClick={() => {
                // Clear auto-close timer if user manually closes
                if (autoCloseTimerRef.current) {
                  clearTimeout(autoCloseTimerRef.current);
                  autoCloseTimerRef.current = null;
                }
                setFormData({
                  patientName: '',
                  patientMRN: '',
                  dateOfBirth: '',
                });
                setSuccess(null);
                onClose();
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              Close
            </ButtonNext>
          ) : (
            <>
              <ButtonNext
                variant="ghost"
                onClick={onClose}
                disabled={isCreating}
              >
                Cancel
              </ButtonNext>
              <ButtonNext
                onClick={handleCreate}
                disabled={isCreating}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isCreating ? 'Creating...' : 'Create Case'}
              </ButtonNext>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateCaseDialog;
