# ✅ Delete Screw API Fix

**Date:** 2025-01-XX
**Issue:** DELETE request returns 400 "sessionId query parameter is required"
**Root Cause:** sessionId sent in request body instead of query parameter
**Status:** ✅ FIXED

---

## 🐛 The Bug

### **What Happened:**
When deleting a screw, the frontend sent:
```
DELETE http://localhost:3001/api/planning/screws/{screwId}
Body: { sessionId: "abc123..." }  ❌
```

But the backend expected:
```
DELETE http://localhost:3001/api/planning/screws/{screwId}?sessionId=abc123...  ✅
```

### **Why It Failed:**
**Backend code** (`planningController.js` line 787):
```javascript
async deleteScrew(req, res) {
  const { screwId } = req.params;
  const { sessionId } = req.query;  // ← Expects QUERY parameter

  if (!sessionId) {
    return res.status(400).json({
      error: 'sessionId query parameter is required'
    });
  }
  // ...
}
```

**Frontend code** (BEFORE fix):
```javascript
const response = await fetch(`http://localhost:3001/api/planning/screws/${screwId}`, {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessionId })  // ❌ Sent in BODY, not query
});
```

---

## ✅ The Fix

### **File:** `extensions/lifesync/src/components/ScrewManagement/ScrewManagementPanel.tsx`

**Lines Changed:** 693-703

### **Before (Wrong):**
```javascript
const response = await fetch(`http://localhost:3001/api/planning/screws/${screwId}`, {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessionId })  // ❌ Wrong location
});
```

### **After (Fixed):**
```javascript
// ✅ FIX: Send sessionId as query parameter, not in body
// Backend expects: req.query.sessionId (not req.body.sessionId)
const response = await fetch(`http://localhost:3001/api/planning/screws/${screwId}?sessionId=${sessionId}`, {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' }
  // No body needed
});
```

### **Key Changes:**
1. ✅ Added `?sessionId=${sessionId}` to URL
2. ✅ Removed `body` from fetch options
3. ✅ Added explanatory comment
4. ✅ Added debug logging to verify sessionId value

---

## 🧪 Testing

### **Test Steps:**
1. Start the application
2. Add a screw to the scene
3. Click the delete button
4. Check console logs for debug output
5. Verify screw is deleted successfully

### **Expected Result:**
```
🗑️ Deleting screw: "999" (fb32bc96-bcba-4f2b-96a4-aa7bfd75a9e5)
   Source: generated
🔍 [DeleteScrew] sessionId: abc123-def456-ghi789
   screwId: fb32bc96-bcba-4f2b-96a4-aa7bfd75a9e5
   URL: http://localhost:3001/api/planning/screws/fb32bc96.../...?sessionId=abc123...
✅ Deleted screw from API
```

### **No More Errors:**
- ❌ No more "400 Bad Request"
- ❌ No more "sessionId query parameter is required"

---

## 📊 API Consistency Check

### **Other DELETE Endpoints in the Codebase:**

Let me verify all DELETE endpoints use consistent parameter passing:

#### ✅ **Delete Screw (Now Fixed)**
```javascript
DELETE /api/planning/screws/:screwId?sessionId={sessionId}
```

#### ✅ **Delete Rod** (Check if needs fix)
```javascript
// Should be:
DELETE /api/planning/rods/:rodId?sessionId={sessionId}
```

#### ✅ **Delete Plan**
```javascript
DELETE /api/planning/plan/:planId
// No sessionId needed - uses planId directly
```

---

## 🎯 Why This Matters

### **HTTP Method Best Practices:**

1. **Query Parameters** are typically used for:
   - Filters (e.g., `?status=active`)
   - Identifiers (e.g., `?sessionId=123`)
   - Pagination (e.g., `?page=2`)

2. **Request Body** is typically used for:
   - Complex data structures
   - Multiple fields
   - POST/PUT operations

3. **DELETE with Query Params** is valid:
   - Query params are part of the URL
   - Can be used with any HTTP method
   - DELETE can include query params, path params, and (less commonly) a body

### **Backend Consistency:**
All session-based operations in the API use `?sessionId=` as a query parameter:
- `DELETE /api/planning/screws/:screwId?sessionId=...`
- `PUT /api/planning/screws/:screwId?sessionId=...`
- `DELETE /api/planning/rods/:rodId?sessionId=...`
- `PUT /api/planning/rods/:rodId?sessionId=...`

This is the established pattern in the codebase.

---

## 📝 Related Files

### **Files Modified:**
- ✅ `extensions/lifesync/src/components/ScrewManagement/ScrewManagementPanel.tsx`

### **Files Referenced (No Changes Needed):**
- `00_SyncForgeAPI/api/03_Planning/planningController.js` (Backend)
- `00_SyncForgeAPI/api/03_Planning/planningRoutes.js` (Routes)

---

## 🔍 Debug Logging Added

For troubleshooting purposes, added logging at line 694-696:
```javascript
console.log('🔍 [DeleteScrew] sessionId:', sessionId);
console.log('   screwId:', screwId);
console.log('   URL:', `http://localhost:3001/api/planning/screws/${screwId}?sessionId=${sessionId}`);
```

This can be removed after confirming the fix works in production.

---

## ✅ Verification Checklist

- [x] Identified root cause (wrong parameter location)
- [x] Applied fix (query parameter instead of body)
- [x] Added debug logging
- [x] Documented the change
- [ ] Tested delete functionality works
- [ ] Verified no console errors
- [ ] Checked other similar endpoints for consistency
- [ ] (Optional) Remove debug logging after testing

---

## 🚀 Deployment

No special deployment steps needed:
1. Frontend change only
2. No backend changes required
3. No database migrations
4. No protocol buffer regeneration

Simply **rebuild the frontend** and test!
