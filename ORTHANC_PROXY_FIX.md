# Orthanc Proxy Configuration Fix

## Issue

When running `yarn run dev:orthanc`, the model server API endpoints (`/api/models/list`, `/api/health`) were not accessible, returning blank screens instead of JSON responses.

## Root Cause

The webpack configuration in `platform/app/.webpack/webpack.pwa.js` had a bug where it **replaced** the entire proxy array when Orthanc environment variables were set, removing the model server proxy configuration.

### Before (Broken Code)

```javascript
if (hasProxy) {
  mergedConfig.devServer.proxy = [  // ❌ REPLACES entire array
    {
      context: ['/pacs/dicom-web', '/pacs/wado'],
      target: 'http://localhost:8042',
      changeOrigin: true,
      pathRewrite: {
        '^/pacs/dicom-web': '/dicom-web',
        '^/pacs/wado': '/wado',
      },
    },
  ];
}
```

**Problem:** This replaced the model server proxies that were configured earlier, breaking access to:
- `/api/models/*`
- `/api/health`
- `/models/*`

## Solution

Changed the code to **append** to the proxy array instead of replacing it:

### After (Fixed Code)

```javascript
if (hasProxy) {
  // Add Orthanc proxy to existing proxies (don't replace them)
  mergedConfig.devServer.proxy.push({  // ✅ ADDS to existing array
    context: ['/pacs/dicom-web', '/pacs/wado'],
    target: 'http://localhost:8042',
    changeOrigin: true,
    pathRewrite: {
      '^/pacs/dicom-web': '/dicom-web',
      '^/pacs/wado': '/wado',
    },
  });
}
```

## Final Proxy Configuration

Now when running `yarn run dev:orthanc`, the proxy array contains ALL proxies:

```javascript
proxy: [
  // 1. DICOMweb proxy
  {
    '/dicomweb': 'http://localhost:5000'
  },

  // 2. Model server API endpoints
  {
    context: ['/api/models', '/api/health'],
    target: 'http://localhost:5001',
    changeOrigin: true,
    secure: false,
  },

  // 3. Model server static files
  {
    context: ['/models'],
    target: 'http://localhost:5001',
    changeOrigin: true,
    secure: false,
  },

  // 4. Orthanc PACS (added when running dev:orthanc)
  {
    context: ['/pacs/dicom-web', '/pacs/wado'],
    target: 'http://localhost:8042',
    changeOrigin: true,
    pathRewrite: {
      '^/pacs/dicom-web': '/dicom-web',
      '^/pacs/wado': '/wado',
    },
  }
]
```

## How to Test

### 1. Test Regular Dev Mode

```bash
yarn run dev
```

**Test endpoints:**
- ✅ `http://localhost:3000/api/health` → JSON response
- ✅ `http://localhost:3000/api/models/list` → JSON response
- ✅ `http://localhost:3000/models/server/model.obj` → Model file

### 2. Test Orthanc Mode

```bash
yarn run dev:orthanc
```

**Test endpoints:**
- ✅ `http://localhost:3000/api/health` → JSON response (model server)
- ✅ `http://localhost:3000/api/models/list` → JSON response (model server)
- ✅ `http://localhost:3000/pacs/dicom-web/*` → Orthanc PACS
- ✅ `http://localhost:3000/models/server/model.obj` → Model file

### 3. Verify Both Servers Running

```bash
netstat -ano | findstr ":3000 :5001 :8042"
```

Expected output:
- Port 3000: Webpack dev server
- Port 5001: Model server
- Port 8042: Orthanc (when using dev:orthanc)

## Additional Fixes Applied

### Health Endpoint Added

The initial proxy configuration only covered `/api/models`, but the health check endpoint is at `/api/health`. Updated to include both:

```javascript
{
  context: ['/api/models', '/api/health'],  // Both endpoints now proxied
  target: 'http://localhost:5001',
  changeOrigin: true,
  secure: false,
}
```

## Commands Summary

All these commands now work correctly:

```bash
# Standard development (DICOM + Model Server)
yarn run dev

# Orthanc PACS + Model Server
yarn run dev:orthanc

# DCM4CHEE PACS + Model Server
yarn run dev:dcm4chee

# Static files + Model Server
yarn run dev:static

# Just the model server
yarn run dev:model-server
```

## Files Modified

1. **platform/app/.webpack/webpack.pwa.js**
   - Line 176: Added `/api/health` to proxy context
   - Line 214-223: Changed from replacing to appending Orthanc proxy

## Impact

- ✅ **No breaking changes** - All existing functionality preserved
- ✅ **Backward compatible** - Works with all dev modes
- ✅ **Model server accessible** - Works in all configurations
- ✅ **Orthanc integration** - PACS proxy works correctly

## Verification Checklist

After updating, verify:

- [ ] `yarn run dev` starts both servers
- [ ] `http://localhost:3000/api/health` returns JSON
- [ ] `http://localhost:3000/api/models/list` returns JSON
- [ ] `yarn run dev:orthanc` starts all three services
- [ ] Orthanc endpoints accessible at `/pacs/dicom-web/*`
- [ ] Model server still accessible with Orthanc running
- [ ] No console errors in browser
- [ ] Models can be uploaded and loaded

## Related Documentation

- [MODEL_SERVER_SETUP.md](./MODEL_SERVER_SETUP.md) - Complete setup guide
- [SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md) - Quick setup
- [MODEL_SERVER_IMPLEMENTATION_SUMMARY.md](./MODEL_SERVER_IMPLEMENTATION_SUMMARY.md) - Technical details

## Date

Fixed: November 7, 2024

## Status

✅ **RESOLVED** - All dev modes now work correctly with model server
