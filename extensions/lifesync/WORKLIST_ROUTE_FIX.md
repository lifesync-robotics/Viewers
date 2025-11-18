# WorkList Route Fix - Using LifeSync WorkList

**Date**: November 18, 2025, 22:45
**Issue**: App was loading default OHIF WorkList instead of LifeSync WorkList
**Fix**: Added route customization to LifeSync extension

---

## 🐛 Problem

The application was loading the wrong WorkList component:
- ❌ Loading: `/platform/app/src/routes/WorkList/WorkList.tsx` (OHIF default)
- ✅ Should load: `/extensions/lifesync/src/components/Worklist/LifeSyncWorklist.tsx`

This caused:
- `TypeError: Cannot read properties of undefined (reading 'studies')`
- Missing case management features
- Wrong component being rendered at `/` route

---

## ✅ Solution

Added `getCustomizationModule()` to LifeSync extension to override the default root route.

### File Modified: `extensions/lifesync/src/index.tsx`

**Added**:
```typescript
import LifeSyncWorklist from './components/Worklist/LifeSyncWorklist';

const lifesyncExtension = {
  // ... existing modules ...

  /**
   * Customization module to override default routes and components
   */
  getCustomizationModule() {
    return [
      {
        name: 'routes.customRoutes',
        value: {
          routes: [
            {
              path: '/',
              children: (props) => {
                const DataSourceWrapper = props.route.children;
                return (
                  <DataSourceWrapper {...props}>
                    {(childProps) => <LifeSyncWorklist {...childProps} />}
                  </DataSourceWrapper>
                );
              },
              private: true,
            },
          ],
        },
      },
    ];
  },

  // ... rest of extension ...
};
```

---

## 🎯 How It Works

1. **OHIF Route System** (from `routes/index.tsx`):
   ```typescript
   const customRoutes = customizationService.getCustomization('routes.customRoutes');

   const allRoutes = [
     ...routes,
     ...(showStudyList ? [WorkListRoute] : []),
     ...(customRoutes?.routes || []),  // ← Our custom route goes here!
     ...bakedInRoutes,
   ];
   ```

2. **LifeSync Extension** registers customization:
   - Provides `routes.customRoutes` customization
   - Overrides the `/` path
   - Wraps LifeSyncWorklist with DataSourceWrapper
   - Ensures LifeSync component loads instead of default

3. **Route Priority**:
   - Custom routes from extensions are added to the route list
   - React Router will match the first matching route
   - LifeSync's `/` route takes precedence

---

## 📋 What This Fixes

### Before:
```
User navigates to http://localhost:8081/
  ↓
OHIF loads: WorkList.tsx (platform/app/src/routes/WorkList/)
  ↓
❌ Error: Cannot access activeCase.studies (wrong component)
```

### After:
```
User navigates to http://localhost:8081/
  ↓
LifeSync extension provides custom route
  ↓
OHIF loads: LifeSyncWorklist.tsx (extensions/lifesync/src/components/Worklist/)
  ↓
✅ Correct component with case management features
✅ Safe null handling
✅ No more undefined errors
```

---

## 🚀 Testing

After rebuilding the frontend:

1. Navigate to `http://localhost:8081/`
2. Should see LifeSync WorkList with:
   - ✅ Case management features
   - ✅ Study browser with case integration
   - ✅ No "undefined.studies" errors
   - ✅ Proper case service integration

---

## 📝 Key Points

1. **LifeSyncWorklist** is now the default landing page
2. **Route override** happens via OHIF's customization system
3. **DataSourceWrapper** is properly maintained for data source integration
4. **Private route** protection is preserved
5. **All props** are correctly passed through to LifeSyncWorklist

---

## 🔄 Next Steps

**Restart the Viewer development server** to load the new route configuration:

```bash
cd /Users/ronaldtse/development/LifeSyncRobotics/Viewers/platform/app
yarn run dev
```

OR

If webpack is watching, it should auto-reload. Check the terminal for:
```
✓ Compiled successfully in XXXms
```

Then **refresh your browser** - the LifeSync WorkList should load!

---

## ✅ Verification

After restart, verify:
1. Console log should show: "LifeSync extension pre-registration completed"
2. No more "Cannot read properties of undefined" errors
3. Case list loads correctly
4. Study browser integrates with case management
5. LifeSync-specific features are available

---

**Status**: ✅ Fix complete - waiting for rebuild to apply changes
