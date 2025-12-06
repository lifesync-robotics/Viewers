# Screw Management Panel Not Showing - Troubleshooting Guide

## Issue
The screw management panel is added to the left panel configuration but is not visible.

## Root Cause Analysis

### ✅ **FIXED: Missing Extension Dependency**

**Problem**: The `@ohif/extension-lifesync` extension was not explicitly declared in the navigation mode's `extensionDependencies`.

**Solution Applied**: Added explicit dependency:
```typescript
export const extensionDependencies = {
  ...basicDependencies,
  '@ohif/extension-measurement-tracking': '^3.0.0',
  '@ohif/extension-lifesync': '^3.12.0-beta.56',  // ✅ Added
};
```

**Why This Matters**: Even though `basicDependencies` includes lifesync, explicitly declaring it ensures:
- The extension is loaded before the mode initializes
- The panel modules are registered and available
- No race conditions during initialization

---

## How Multiple Left Panels Work

When you have multiple panels in `leftPanels` array:
```typescript
leftPanels: [tracked.thumbnailList, tracked.screwManagement]
```

OHIF creates **tabs** in the left panel:
- **Tab 0**: Thumbnail List (series list) - **Shown by default**
- **Tab 1**: Screw Management - **Requires clicking the tab to view**

### ⚠️ **Important**: The screw management panel is there, but you need to **click the tab** to see it!

---

## Verification Steps

### 1. Check Browser Console
Open browser DevTools (F12) and check for errors:
```javascript
// Look for these errors:
- "Panel not found: @ohif/extension-lifesync.panelModule.screw-management"
- "Extension not loaded: @ohif/extension-lifesync"
- Any React rendering errors
```

### 2. Verify Extension is Loaded
In browser console, run:
```javascript
// Check if extension is registered
window.extensionManager?.registeredExtensionIds
// Should include: "@ohif/extension-lifesync"

// Check if panel is registered
window.extensionManager?.getModuleEntry('@ohif/extension-lifesync.panelModule.screw-management')
// Should return the panel component, not undefined
```

### 3. Check Panel Service
```javascript
// Get left panels
window.servicesManager?.services?.panelService?.getPanels('left')
// Should show array with both panels
```

### 4. Visual Check
1. **Look for tabs** in the left panel
2. You should see **two tabs** at the top of the left panel:
   - First tab: Series/Thumbnail list (active by default)
   - Second tab: Screw Management (click to activate)
3. **Click the second tab** to see the screw management panel

---

## Common Issues & Solutions

### Issue 1: Only One Tab Visible
**Symptom**: Only the thumbnail list tab is visible, no second tab.

**Possible Causes**:
1. Extension not loaded → **FIXED** (added explicit dependency)
2. Panel not registered → Check console for registration errors
3. Panel reference incorrect → Verify the reference string

**Solution**:
- Rebuild the mode: `yarn build` (from navigation directory)
- Hard refresh browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Check browser console for errors

### Issue 2: Tab Visible But Panel Empty/Error
**Symptom**: Tab exists but panel shows error or is empty.

**Possible Causes**:
1. Panel component has errors
2. Required services not available
3. Missing props

**Solution**:
- Check browser console for React errors
- Verify all required services are initialized
- Check if `ScrewManagementPanel` component has any console errors

### Issue 3: Panel Reference Not Found
**Symptom**: Console shows "Panel not found" error.

**Check**:
1. Panel name in extension: `'screw-management'` ✅
2. Extension ID: `'@ohif/extension-lifesync'` ✅
3. Full reference: `'@ohif/extension-lifesync.panelModule.screw-management'` ✅

**Solution**:
- Verify extension is in `pluginConfig.json`
- Rebuild and restart the viewer
- Check `extensions/lifesync/src/panels/getPanelModule.tsx` - panel should be registered

---

## Current Configuration

### Navigation Mode (`src/index.ts`)
```typescript
leftPanels: [tracked.thumbnailList, tracked.screwManagement]
// tracked.thumbnailList = '@ohif/extension-measurement-tracking.panelModule.seriesList'
// tracked.screwManagement = '@ohif/extension-lifesync.panelModule.screw-management'
```

### Extension Registration (`extensions/lifesync/src/panels/getPanelModule.tsx`)
```typescript
{
  name: 'screw-management',  // ✅ Matches reference
  label: 'Screw Management',
  iconName: 'tool-more-menu',
  component: (props) => <ScrewManagementPanel {...props} />
}
```

### Extension Dependencies
```typescript
extensionDependencies = {
  ...basicDependencies,
  '@ohif/extension-measurement-tracking': '^3.0.0',
  '@ohif/extension-lifesync': '^3.12.0-beta.56',  // ✅ Now explicitly included
}
```

---

## Testing Checklist

After applying the fix:

- [ ] Rebuild the navigation mode: `cd Viewers/modes/navigation && yarn build`
- [ ] Restart the viewer/development server
- [ ] Hard refresh browser (Ctrl+Shift+R)
- [ ] Navigate to `/navigation` route
- [ ] Check left panel for **two tabs**
- [ ] Click the second tab (Screw Management)
- [ ] Verify screw management panel loads
- [ ] Check browser console for errors
- [ ] Test placing a screw (should work if panel loads)

---

## Expected Behavior

### Left Panel Layout:
```
┌─────────────────────────┐
│ [Series] [Screw Mgmt]   │ ← Tabs (click to switch)
├─────────────────────────┤
│                         │
│  Panel Content          │ ← Active panel content
│  (changes based on tab)  │
│                         │
└─────────────────────────┘
```

### Tab 0 (Series/Thumbnail List):
- Shows study series thumbnails
- Default active tab
- From: `@ohif/extension-measurement-tracking.panelModule.seriesList`

### Tab 1 (Screw Management):
- Shows screw planning interface
- Click tab to activate
- From: `@ohif/extension-lifesync.panelModule.screw-management`
- Should show:
  - Screw list
  - Add/Remove screw buttons
  - Save/Load plan buttons
  - Screw parameters (radius, length)

---

## If Still Not Working

### Debug Commands (Browser Console)

```javascript
// 1. Check extension registration
console.log('Extensions:', window.extensionManager?.registeredExtensionIds);

// 2. Check panel registration
const panel = window.extensionManager?.getModuleEntry('@ohif/extension-lifesync.panelModule.screw-management');
console.log('Screw Panel:', panel);

// 3. Check panel service
const leftPanels = window.servicesManager?.services?.panelService?.getPanels('left');
console.log('Left Panels:', leftPanels);

// 4. Check for errors
console.log('Panel Service State:', window.servicesManager?.services?.panelService);
```

### Manual Panel Activation (if needed)
```javascript
// Force activate screw management panel
window.servicesManager?.services?.panelService?.activatePanel(
  '@ohif/extension-lifesync.panelModule.screw-management',
  true  // force active
);
```

---

## Summary

✅ **Fixed**: Added explicit `@ohif/extension-lifesync` dependency

⚠️ **Remember**: Multiple panels create **tabs** - you need to **click the tab** to see the screw management panel!

The panel should now be visible as the second tab in the left panel. If you still don't see it:
1. Rebuild the mode
2. Hard refresh browser
3. Check browser console for errors
4. Verify tabs are visible (not just one panel)

---

**Last Updated**: After adding explicit lifesync dependency
**Status**: ✅ Should be working - verify tabs are visible

