# Services Directory

This directory contains service modules that handle backend communication and data synchronization for the LifeSync extension.

## 📁 Files

### `planningBackendService.ts`
**Main backend API service** - Handles all communication with the Python planning server.

**Key Features:**
- ✅ Session management (start/end sessions)
- ✅ Screw CRUD operations (add, list, get, update, delete)
- ✅ Model queries (query models by dimensions)
- ✅ Plan operations (save, load, restore, list, delete)
- ✅ Backend health checks
- ✅ Full TypeScript types for all operations
- ✅ Consistent error handling and logging

**Base URL:** `http://localhost:3001/api/planning`

### `PLANNING_BACKEND_SERVICE_USAGE.md`
Complete usage guide with examples for all service methods.

### `REFACTORING_EXAMPLE.tsx`
Side-by-side comparison showing how to refactor existing code to use the backend service.

### `index.ts`
Centralized exports for easy importing.

## 🚀 Quick Start

### Import the service

```typescript
import { planningBackendService } from '../services';
```

### Basic usage

```typescript
// Start a session
const session = await planningBackendService.startSession({
  studyInstanceUID: '1.2.3.4.5',
  seriesInstanceUID: '1.2.3.4.5.6',
  surgeon: 'Dr. Smith'
});

// Add a screw
const result = await planningBackendService.addScrew({
  sessionId: session.session_id,
  screw: {
    // ... screw data
  }
});

// List screws
const screws = await planningBackendService.listScrews(session.session_id);

// Save plan
const plan = await planningBackendService.savePlan({
  sessionId: session.session_id,
  caseId: 'CASE-001',
  studyInstanceUID: '1.2.3.4.5',
  seriesInstanceUID: '1.2.3.4.5.6',
  planData: {
    name: 'My Plan',
    surgeon: 'Dr. Smith'
  }
});
```

## 📚 Documentation

- **Usage Guide:** See `PLANNING_BACKEND_SERVICE_USAGE.md`
- **Refactoring Examples:** See `REFACTORING_EXAMPLE.tsx`
- **API Reference:** See inline JSDoc comments in `planningBackendService.ts`

## 🔧 Configuration

### Default configuration
The service uses `http://localhost:3001/api/planning` as the base URL.

### Custom configuration
Create a custom instance with a different URL:

```typescript
import PlanningBackendService from '../services/planningBackendService';

const customService = new PlanningBackendService('http://custom-server:8080/api/planning');
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│  React Components                           │
│  (ScrewManagementPanel, etc.)              │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────┐
│  planningBackendService                     │
│  - Type-safe API methods                    │
│  - Error handling                           │
│  - Logging                                  │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────┐
│  HTTP/REST API                              │
│  (SyncForge API → Planning Service)        │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────┐
│  Python Backend                             │
│  - Planning server (port 6000)              │
│  - Database (PostgreSQL)                    │
└─────────────────────────────────────────────┘
```

## 🧪 Testing

### Check backend availability

```typescript
const isAvailable = await planningBackendService.isAvailable();
if (!isAvailable) {
  console.warn('Backend not available - falling back to localStorage');
}
```

### Get backend status

```typescript
const status = await planningBackendService.getStatus();
console.log('Backend version:', status.version);
console.log('Uptime:', status.uptime);
```

## 🔄 Migration Path

To migrate existing code to use the backend service:

1. **Replace direct fetch calls** with service methods
2. **Update error handling** to use consistent pattern
3. **Add type safety** by using exported TypeScript types
4. **Remove duplicate code** by reusing service methods

See `REFACTORING_EXAMPLE.tsx` for detailed before/after examples.

## 📝 TODO

- [ ] Add request retry logic for failed operations
- [ ] Implement request caching for frequently accessed data
- [ ] Add request cancellation support
- [ ] Create unit tests for all service methods
- [ ] Add request/response interceptors for global error handling
- [ ] Implement offline mode with localStorage fallback
- [ ] Add request debouncing for rapid operations

## 🤝 Contributing

When adding new API endpoints:

1. Add types to the service file (request/response interfaces)
2. Add the method to the `PlanningBackendService` class
3. Add usage examples to `PLANNING_BACKEND_SERVICE_USAGE.md`
4. Export new types in `index.ts`
5. Update this README if needed

## 📞 Support

For issues or questions:
- Check the usage guide first
- Review the refactoring examples
- Check browser console for detailed logs
- Verify backend is running (`isAvailable()` method)
