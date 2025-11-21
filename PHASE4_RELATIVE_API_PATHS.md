# Phase 4: Relative API Paths Implementation
**Date**: 2025-11-20  
**Status**: ✅ Implemented

---

## 📋 Overview

Converted all hardcoded API URLs to use **relative paths** with **webpack dev server proxy** for proper API routing.

---

## 🎯 Problem

**Before**:
- Frontend components used hardcoded URLs: `http://localhost:3001/api/...`
- When running on `localhost:8081`, API calls to `:8081/api/...` failed with 400 errors
- Required manual logic: `window.location.port === '8081' ? '' : 'http://localhost:3001'`

**After**:
- All API calls use relative paths: `/api/tracking/connect`
- Webpack dev server proxy routes `/api/*` → `localhost:3001`
- Same code works in development and production

---

## ✅ Changes Made

### 1. Webpack Dev Server Proxy Configuration

**File**: `platform/app/.webpack/webpack.pwa.js`

**Added** (line 194-202):
```javascript
{
  // Proxy for SyncForge API (Phase 4)
  // Tracking, Planning, Registration, Case Management
  context: ['/api'],
  target: 'http://localhost:3001',
  changeOrigin: true,
  secure: false,
  ws: true,  // Enable WebSocket proxy for /ws/tracking
},
```

**Result**: 
- `localhost:8081/api/*` → proxied → `localhost:3001/api/*`
- `ws://localhost:8081/ws/tracking` → proxied → `ws://localhost:3001/ws/tracking`

---

### 2. Created Centralized API Config Utility

**File**: `extensions/lifesync/src/utils/apiConfig.ts`

**Purpose**: Single source of truth for API URL determination

**Functions**:
```typescript
// Get base URL (empty string for relative paths)
getApiBaseUrl(): string

// Construct API endpoint
getApiUrl(path: string): string  

// Construct WebSocket URL
getWsUrl(path: string): string
```

**Benefits**:
- Centralized configuration
- Easy to switch between relative/absolute URLs
- Can be configured via `window.config.syncforge.apiUrl` for production

---

### 3. Updated Services

#### TrackingService.ts
**Before**:
```typescript
const hostname = window.location.hostname;
const defaultApiUrl = `http://${hostname}:3001`;
this.apiUrl = config.apiUrl || syncforgeApiUrl || defaultApiUrl;
```

**After**:
```typescript
import { getApiBaseUrl } from '../utils/apiConfig';
this.apiUrl = config.apiUrl || getApiBaseUrl();  // Returns '' (relative)
```

---

### 4. Updated Components

All tracking components now use relative paths:

| Component | Change |
|-----------|--------|
| `TrackingPanel.tsx` | `/api/tracking/config`, `/api/tracking/mode`, etc. |
| `TrackingConfigDialog.tsx` | `getApiBase()` returns `''` |
| `ReferenceMarkerSelector.tsx` | `getApiBase()` returns `''` |
| `InstrumentSelector.tsx` | `getApiBase()` returns `''` |
| `ConfigurationManager.tsx` | `getApiBase()` returns `''` |
| `CaseSelector.tsx` | `/api/cases/${caseId}` |

**Removed**:
```typescript
// OLD (removed)
const apiBase = window.location.port === '8081' ? '' : 'http://localhost:3001';
```

**New**:
```typescript
// NEW (simple)
const response = await fetch('/api/tracking/config');
```

---

## 🔧 How It Works

### Development Mode (webpack dev server)

```
Frontend (React)
    ↓
localhost:8081/api/tracking/connect
    ↓
Webpack Proxy (configured in webpack.pwa.js)
    ↓
localhost:3001/api/tracking/connect
    ↓
SyncForge API (Node.js/Express)
```

###Production Mode (static build)

```
Frontend (React)
    ↓
/api/tracking/connect (relative to deployment URL)
    ↓
Nginx/Reverse Proxy
    ↓
SyncForge API (same origin or proxied)
```

---

## 🚀 Testing

### 1. Restart webpack dev server

```bash
cd /Users/ronaldtse/development/LifeSyncRobotics/Viewers/platform/app
yarn dev
```

### 2. Verify proxy is active

Console should show:
```
ℹ [HPM] Proxy created: ['/api']  ->  http://localhost:3001
```

### 3. Test in browser

```
http://localhost:8081
```

Open Dev Tools → Network tab:
- Look for `/api/tracking/connect`
- Should return 200 (not 400)
- No CORS errors

### 4. Test tracking connection

1. Navigate to a study
2. Open Tracking Panel
3. Click "Connect"
4. Should see: `📍 DR-VR04-A32` with full name

---

## 📝 Configuration

### Development

**No configuration needed!** Webpack proxy handles everything automatically.

### Production

Set API URL in `window.config`:

```javascript
// public/config/production.js
window.config = {
  syncforge: {
    apiUrl: 'https://api.your-domain.com'  // Optional, for different origin
  },
  // ... other config
};
```

**If not set**: Uses same-origin relative paths (recommended for reverse proxy setup)

---

## ✅ Benefits

1. **Simpler Code**: No more port checking logic
2. **Fewer Errors**: Proxy handles routing automatically
3. **Production Ready**: Same code works in dev and production
4. **Flexible**: Can configure absolute URLs if needed
5. **Standards Compliant**: Uses standard HTTP proxy patterns

---

## 🔍 Debugging

### Check webpack dev server is running

```bash
ps aux | grep webpack
```

### Check SyncForge API is running

```bash
curl http://localhost:3001/api/health
```

### Check proxy configuration

Look for this in webpack dev server output:
```
ℹ [HPM] Proxy created: ['/api']  ->  http://localhost:3001
```

### Browser DevTools

Network tab should show:
```
Request URL: http://localhost:8081/api/tracking/connect
Status: 200 OK (not 400)
```

---

## 🎯 Summary

| Aspect | Before | After |
|--------|--------|-------|
| API URL | `http://localhost:3001/api/...` | `/api/...` |
| URL Logic | `port === '8081' ? '' : 'http://...'` | Always `''` |
| Proxy | None | Webpack proxy configured |
| CORS | Potential issues | No issues (same origin) |
| Production | Needs special handling | Works out of the box |

**Result**: Clean, simple, production-ready API calls! ✅

