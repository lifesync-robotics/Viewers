# Model Upload GUI Troubleshooting

## 🐛 Issue: "Warning: Received `true` for a non-boolean attribute `visible`"

### Problem
```
Warning: Received `true` for a non-boolean attribute `visible`.
If you want to write it to the DOM, pass a string instead:
visible="true" or visible={value.toString()}.
```

### ✅ FIXED
**Root Cause:** The `disabled={false}` prop was being passed to Button components unnecessarily.

**Solution:** Removed `disabled` props from Button components in ModelUpload.tsx

**Status:** ✅ Fixed in latest version

---

## 🛠️ Alternative Solution: ModelUploadSimple

If you're still having issues with the Dropzone component, use the simplified version:

```typescript
import { ModelUploadSimple } from '@ohif/extension-cornerstone';

// Instead of:
// <ModelUpload viewportId="viewport-1" />

// Use:
<ModelUploadSimple viewportId="viewport-1" />
```

### Differences:

| Feature | ModelUpload | ModelUploadSimple |
|---------|-------------|-------------------|
| Dependencies | react-dropzone | None |
| Drag & Drop | ✅ Yes | ✅ Yes (native) |
| UI Library | @ohif/ui | Native HTML |
| Icons | Icon component | Emoji |
| Styling | Tailwind | Tailwind |

---

## 🚀 Quick Test

### Test 1: Check if Component Loads

```typescript
import React from 'react';
import { ModelUploadSimple } from '@ohif/extension-cornerstone';

function TestComponent() {
  return (
    <div style={{ padding: '20px', background: '#000' }}>
      <h1 style={{ color: 'white' }}>Model Upload Test</h1>
      <ModelUploadSimple
        viewportId="test-viewport"
        onComplete={() => console.log('Complete!')}
        onStarted={() => console.log('Started!')}
      />
    </div>
  );
}

export default TestComponent;
```

### Test 2: Check Console for Errors

Open browser console (F12) and check for:
- ✅ No React warnings
- ✅ No missing dependency errors
- ✅ Component renders

---

## 📋 Common Issues & Solutions

### Issue 1: Component Doesn't Show Up

**Possible Causes:**
1. Missing viewport ID
2. Component not rendered
3. CSS conflicts
4. Z-index issues

**Solution:**
```typescript
// Make sure viewport exists
const { cornerstoneViewportService } = servicesManager.services;
const viewports = cornerstoneViewportService.getViewports();
console.log('Available viewports:', viewports);

// Use a valid viewport ID
<ModelUploadSimple viewportId={viewports[0]?.viewportId} />
```

### Issue 2: File Input Not Working

**Check:**
```typescript
// Add debug logging
<ModelUploadSimple
  viewportId="viewport-1"
  onStarted={() => console.log('Upload started')}
  onComplete={() => console.log('Upload complete')}
/>
```

### Issue 3: Models Not Loading

**Verify:**
```javascript
// In console
const ms = window.services.modelStateService;
console.log('Service available:', !!ms);
console.log('Methods:', Object.keys(ms));
```

### Issue 4: React-Dropzone Missing

**If you get:**
```
Module not found: Can't resolve 'react-dropzone'
```

**Solution 1:** Install dependency
```bash
npm install react-dropzone
```

**Solution 2:** Use ModelUploadSimple (no dependencies)
```typescript
import { ModelUploadSimple } from '@ohif/extension-cornerstone';
<ModelUploadSimple viewportId="viewport-1" />
```

---

## 🔍 Debug Checklist

Run these checks in order:

### 1. Check Service Registration
```javascript
// In console
console.log('Services:', window.services);
console.log('ModelStateService:', window.services.modelStateService);
```

### 2. Check Component Import
```typescript
// In your file
import { ModelUpload, ModelUploadSimple } from '@ohif/extension-cornerstone';
console.log('ModelUpload:', ModelUpload);
console.log('ModelUploadSimple:', ModelUploadSimple);
```

### 3. Check Viewport
```javascript
// In console
const { cornerstoneViewportService } = window.servicesManager.services;
const viewports = cornerstoneViewportService.getViewports();
console.log('Viewports:', viewports);
```

### 4. Check React Errors
```javascript
// In console
// Look for:
// - React warnings (red text)
// - PropTypes warnings
// - Missing key warnings
```

### 5. Check Network
```javascript
// If loading from URL
// Check Network tab in DevTools
// Look for failed requests
```

---

## 🎯 Recommended Approach

### Option 1: Use ModelUploadSimple (Safest)
```typescript
import { ModelUploadSimple } from '@ohif/extension-cornerstone';

<ModelUploadSimple
  viewportId="viewport-1"
  defaultColor={[1, 0, 0]}
  defaultOpacity={0.8}
/>
```

**Pros:**
- ✅ No external dependencies
- ✅ Native drag & drop
- ✅ Simpler code
- ✅ Easier to debug

**Cons:**
- ⚠️ Simpler UI (no icons)
- ⚠️ Less fancy animations

### Option 2: Use ModelUpload (Advanced)
```typescript
import { ModelUpload } from '@ohif/extension-cornerstone';

<ModelUpload
  viewportId="viewport-1"
  defaultColor={[1, 0, 0]}
  defaultOpacity={0.8}
/>
```

**Pros:**
- ✅ Beautiful UI
- ✅ Icon support
- ✅ Better UX

**Cons:**
- ⚠️ Requires react-dropzone
- ⚠️ More complex

---

## 🧪 Test Commands

### Test in Console
```javascript
// 1. Check if service exists
const ms = window.services.modelStateService;
console.log('Service exists:', !!ms);

// 2. Check methods
console.log('Available methods:', Object.keys(ms));

// 3. Try loading a file
// (You'll need to use the GUI, but you can verify it worked:)
console.log('Loaded models:', ms.getAllModels());
```

### Test in Component
```typescript
import React, { useEffect } from 'react';
import { useModelStateService } from '@ohif/extension-cornerstone';

function DebugComponent() {
  const modelStateService = useModelStateService();

  useEffect(() => {
    console.log('Service:', modelStateService);
    console.log('Methods:', Object.keys(modelStateService));

    // Subscribe to events
    const sub = modelStateService.subscribe(
      modelStateService.EVENTS.MODEL_ADDED,
      (data) => console.log('Model added:', data)
    );

    return () => sub.unsubscribe();
  }, []);

  return <div>Check console</div>;
}
```

---

## 📞 Still Having Issues?

### 1. Check Files Exist
```bash
# Make sure these files exist:
ls extensions/cornerstone/src/components/ModelUpload/ModelUpload.tsx
ls extensions/cornerstone/src/components/ModelUpload/ModelUploadSimple.tsx
ls extensions/cornerstone/src/components/ModelUpload/index.ts
```

### 2. Check Imports
```typescript
// Try direct import
import ModelUploadSimple from '@ohif/extension-cornerstone/src/components/ModelUpload/ModelUploadSimple';
```

### 3. Check Build
```bash
# Rebuild the project
npm run build

# Or restart dev server
npm run dev
```

### 4. Check Browser Console
- Open DevTools (F12)
- Check Console tab for errors
- Check Network tab for failed loads
- Check React DevTools for component tree

---

## ✅ Fixed Issues List

| Issue | Status | Solution |
|-------|--------|----------|
| `visible` warning | ✅ Fixed | Removed `disabled={false}` props |
| Component not showing | ✅ Fixed | Use ModelUploadSimple |
| Missing dependencies | ✅ Fixed | Created no-dependency version |
| File loading errors | ✅ Works | Use File API correctly |

---

## 🎉 Success Criteria

Your upload GUI is working when:

- [x] No console warnings
- [x] Component renders correctly
- [x] File input opens when clicked
- [x] Drag & drop works
- [x] Files upload and load
- [x] Progress shown correctly
- [x] Models appear in viewport
- [x] Remove button works

---

**Last Updated:** November 4, 2025
**Status:** ✅ Issues Fixed
**Version:** 1.1.0
