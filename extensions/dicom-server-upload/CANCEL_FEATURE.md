# Cancel Upload Feature

## Overview

The DICOM Server Upload extension now includes a **Cancel** button that allows users to abort ongoing uploads during the upload stage, following [react-uploady](https://github.com/rpldy/react-uploady)'s recommended patterns.

## Implementation Details

### React-Uploady Hooks Used

According to the [react-uploady documentation](https://github.com/rpldy/react-uploady), we use the following hooks for cancel functionality:

1. **`useAbortBatch()`** - Returns a function to abort an entire batch by ID
2. **`useBatchAbortListener()`** - Listens for when a batch is aborted

### Code Implementation

```typescript
import { 
  useItemProgressListener, 
  useItemFinishListener, 
  useItemErrorListener,
  useBatchAbortListener,
  useAbortBatch
} from '@rpldy/uploady';

// Get abort functionality
const abortBatch = useAbortBatch();
const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);

// Track batch ID during upload
useItemProgressListener((item) => {
  if (item.batchId && !currentBatchId) {
    setCurrentBatchId(item.batchId);
  }
});

// Handle cancellation
const handleCancelUpload = useCallback(() => {
  if (currentBatchId) {
    console.log('Cancelling upload, batch ID:', currentBatchId);
    abortBatch(currentBatchId);
  }
}, [currentBatchId, abortBatch]);

// Listen for abort events
useBatchAbortListener(() => {
  console.log('Upload cancelled by user');
  setErrorMessage('Upload cancelled');
  setStages((prev) =>
    prev.map((stage, idx) =>
      idx === currentStageIndex ? { ...stage, status: 'error' } : stage
    )
  );
  setIsUploading(false);
  setCurrentBatchId(null);
});
```

## UI Features

### Cancel Button

- **Visibility**: Only appears during the **Upload stage** (0-30%)
- **Color**: Red (#e53e3e) to indicate destructive action
- **Position**: Next to the upload button
- **Label**: "✕ Cancel"
- **Hover Effect**: Darkens to #c53030 on hover

### Upload Button States

#### Not Uploading
- Shows "📤 Select DICOM Files"
- Blue background (#3182ce)
- Clickable

#### Uploading
- Shows "⏳ Uploading..." in **white text** (#ffffff)
- Gray background (#4a5568)
- Not clickable (displayed as div, not button)

### Text Color Fix

All button text is now explicitly set to **white** (#ffffff) to ensure readability on dark backgrounds:

```typescript
<span style={{ color: '#ffffff' }}>⏳ Uploading...</span>
```

## User Flow

### Normal Upload Flow

```
1. Click "Select DICOM Files"
   ↓
2. Files selected
   ↓
3. Upload begins
   ├─ Button changes to "Uploading..."
   └─ Cancel button appears
   ↓
4. Upload completes
   └─ Cancel button disappears
```

### Cancelled Upload Flow

```
1. Upload in progress
   ↓
2. User clicks "Cancel"
   ↓
3. abortBatch() called with batch ID
   ↓
4. useBatchAbortListener triggered
   ↓
5. Progress bar shows error state
   ├─ Stage marked as 'error'
   ├─ Error message: "Upload cancelled"
   └─ Reset button appears
```

## Stage Restrictions

The cancel button **only appears during Stage 1 (Upload)** because:

- **Stage 1 (0-30%)**: Active network upload - can be cancelled
- **Stage 2 (30-80%)**: Server processing - cannot be cancelled (already on server)
- **Stage 3 (80-100%)**: Download results - cannot be cancelled (nearly complete)

```typescript
{isUploading && currentStageIndex === 0 && (
  <button onClick={handleCancelUpload}>
    ✕ Cancel
  </button>
)}
```

## Technical Details

### Batch ID Tracking

```typescript
const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);

// Capture batch ID from first progress event
useItemProgressListener((item) => {
  if (item.batchId && !currentBatchId) {
    setCurrentBatchId(item.batchId);
  }
});
```

### Abort Execution

```typescript
const handleCancelUpload = useCallback(() => {
  if (currentBatchId) {
    abortBatch(currentBatchId);
  }
}, [currentBatchId, abortBatch]);
```

### Cleanup on Abort

```typescript
useBatchAbortListener(() => {
  setErrorMessage('Upload cancelled');
  setIsUploading(false);
  setCurrentBatchId(null);
  // Update stage status to error
  setStages((prev) =>
    prev.map((stage, idx) =>
      idx === currentStageIndex ? { ...stage, status: 'error' } : stage
    )
  );
});
```

## Error Handling

When upload is cancelled:

1. **Progress Bar**: Current stage changes to error state (red ✗)
2. **Error Message**: "Upload cancelled" displayed
3. **Reset Button**: Appears to allow starting over
4. **Console Log**: "Upload cancelled by user"
5. **State Cleanup**: All upload-related state is reset

## Testing

### Test Cancel Functionality

1. Start the sample server:
```bash
cd examples
npm start
```

2. In OHIF:
   - Enter URL: `http://localhost:8080/upload`
   - Click "Select DICOM Files"
   - Choose a large file (so you have time to cancel)
   - Click "✕ Cancel" during upload

3. Expected behavior:
   - Upload stops immediately
   - Progress bar shows error state
   - Message shows "Upload cancelled"
   - Reset button appears

### Verify Visual Elements

✅ "Uploading..." text is **white** and readable
✅ Cancel button is **red** and prominent
✅ Cancel button only appears during upload stage
✅ Cancel button disappears after cancellation
✅ Error message is clear

## Browser Compatibility

The cancel feature works in all modern browsers:
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ✅ Opera

## References

- [react-uploady GitHub](https://github.com/rpldy/react-uploady) - Source repository
- [react-uploady Documentation](https://react-uploady.org) - Official docs
- [useAbortBatch Hook](https://react-uploady.org/docs/api/hooks/useAbortBatch/) - Abort API
- [useBatchAbortListener Hook](https://react-uploady.org/docs/api/hooks/useBatchAbortListener/) - Abort listener

## Visual Preview

### Before Upload
```
┌─────────────────────────────────┐
│  📤 Select DICOM Files          │
└─────────────────────────────────┘
```

### During Upload (with Cancel)
```
┌──────────────────────┬─────────┐
│  ⏳ Uploading...     │ ✕ Cancel│
└──────────────────────┴─────────┘
[████████░░░░░░░░░] 45%
```

### After Cancel
```
┌─────────────────────────────────┐
│  Error: Upload cancelled        │
│  [Reset Upload]                 │
└─────────────────────────────────┘
```

## Future Enhancements

Potential improvements:

1. **Pause/Resume**: Use TUS protocol for resumable uploads
2. **Confirm Dialog**: Ask "Are you sure?" before cancelling
3. **Cancel All**: If multiple files, cancel entire batch
4. **Keyboard Shortcut**: ESC key to cancel
5. **Cancel Progress**: Show "Cancelling..." state briefly

## Troubleshooting

### Cancel Button Not Appearing

**Check**: 
- Upload is in progress (`isUploading === true`)
- Currently in upload stage (`currentStageIndex === 0`)
- Batch ID is captured

**Fix**: Check browser console for batch ID logs

### Cancel Not Working

**Check**:
- Batch ID is valid
- `abortBatch()` is being called
- Network request is cancellable

**Fix**: Verify batch ID in console: `console.log('Batch ID:', currentBatchId)`

### Text Not White

**Check**: CSS specificity or overrides

**Fix**: Text color is explicitly set with inline styles - should override any CSS

---

**Feature Status**: ✅ Complete and tested
**react-uploady Version**: 1.13.0
**Last Updated**: December 23, 2025

