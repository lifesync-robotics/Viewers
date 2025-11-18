# Planning Backend Service Usage Guide

This document explains how to use the `planningBackendService` to interact with the Python planning server.

## Overview

The `planningBackendService` provides a centralized, type-safe interface for all backend operations:

- ✅ Session management
- ✅ Screw CRUD operations
- ✅ Model queries
- ✅ Plan save/load operations
- ✅ Backend health checks

## Import

```typescript
import { planningBackendService } from '../services/planningBackendService';
```

## Usage Examples

### 1. Session Management

#### Start a new session

```typescript
const sessionResponse = await planningBackendService.startSession({
  studyInstanceUID: '1.2.3.4.5',
  seriesInstanceUID: '1.2.3.4.5.6',
  surgeon: 'Dr. Smith',
  caseId: 'CASE-001' // Optional
});

if (sessionResponse.success) {
  console.log('Session ID:', sessionResponse.session_id);
} else {
  console.error('Error:', sessionResponse.error);
}
```

#### End a session

```typescript
const endResponse = await planningBackendService.endSession(sessionId);
```

### 2. Screw Operations

#### Add a screw

```typescript
const addResponse = await planningBackendService.addScrew({
  sessionId: sessionId,
  screw: {
    caseId: 'CASE-001',
    radius: 3.5,
    length: 45,
    screwLabel: 'L3-R1',
    screwVariantId: 'medtronic-cd-3.5-45',
    vertebralLevel: 'L3',
    side: 'Right',
    entryPoint: {
      x: 10.5,
      y: 20.3,
      z: 30.7
    },
    trajectory: {
      direction: [0.0, 1.0, 0.0],
      insertionDepth: 45,
      convergenceAngle: 5.0,
      cephaladAngle: 15.0
    },
    notes: 'Initial placement',
    transformMatrix: transform, // 16-element array
    viewportStatesJson: JSON.stringify(viewportStates),
    placedAt: new Date().toISOString()
  }
});

if (addResponse.success) {
  console.log('Screw ID:', addResponse.screw_id);
}
```

#### List all screws

```typescript
const listResponse = await planningBackendService.listScrews(sessionId);

if (listResponse.success) {
  const screws = listResponse.screws || [];
  screws.forEach(screw => {
    console.log(`Screw: ${screw.screw_label} (${screw.radius}mm x ${screw.length}mm)`);
  });
}
```

#### Get a specific screw

```typescript
const screwResponse = await planningBackendService.getScrew(screwId, sessionId);

if (screwResponse.success) {
  const screw = screwResponse.screw;
  console.log('Screw data:', screw);
}
```

#### Update a screw

```typescript
const updateResponse = await planningBackendService.updateScrew(
  screwId,
  sessionId,
  {
    screwLabel: 'L3-R1-Updated',
    notes: 'Adjusted trajectory'
  }
);
```

#### Delete a screw

```typescript
const deleteResponse = await planningBackendService.deleteScrew(screwId, sessionId);

if (deleteResponse.success) {
  console.log('Screw deleted successfully');
}
```

### 3. Model Operations

#### Query for a model

```typescript
const modelResponse = await planningBackendService.queryModel(3.5, 45);

if (modelResponse.success && modelResponse.model) {
  console.log('Model ID:', modelResponse.model.model_id);
  console.log('Source:', modelResponse.model.source); // 'generated' or 'catalog'

  // Get the OBJ file URL
  const modelUrl = planningBackendService.getModelUrl(modelResponse.model.model_id);
  console.log('Model URL:', modelUrl);
}
```

### 4. Plan Operations

#### Save a plan

```typescript
const savePlanResponse = await planningBackendService.savePlan({
  sessionId: sessionId,
  caseId: 'CASE-001',
  studyInstanceUID: '1.2.3.4.5',
  seriesInstanceUID: '1.2.3.4.5.6',
  planData: {
    name: 'L3-L5 Fusion Plan',
    description: 'Bilateral pedicle screw fixation',
    surgeon: 'Dr. Smith'
  }
});

if (savePlanResponse.success) {
  console.log('Plan saved with ID:', savePlanResponse.plan_id);
}
```

#### List plans

```typescript
// List all plans
const allPlans = await planningBackendService.listPlans();

// List plans for a specific case
const casePlans = await planningBackendService.listPlans({
  caseId: 'CASE-001'
});

// List plans for a specific series
const seriesPlans = await planningBackendService.listPlans({
  seriesInstanceUID: '1.2.3.4.5.6'
});
```

#### Load a plan

```typescript
const loadResponse = await planningBackendService.loadPlan(planId);

if (loadResponse.success && loadResponse.plan) {
  const plan = loadResponse.plan;
  console.log('Plan:', plan.name);
  console.log('Screws:', plan.screws.length);

  // Restore 3D models for each screw
  for (const screw of plan.screws) {
    await loadScrewModel(screw.radius, screw.length, screw.transform_matrix, screw.screw_label);
  }
}
```

#### Restore session from plan

```typescript
const restoreResponse = await planningBackendService.restoreSessionFromPlan(planId);

if (restoreResponse.success) {
  console.log('New session ID:', restoreResponse.session_id);
  console.log('Restored screws:', restoreResponse.screws_count);

  // Update UI with restored session
  setSessionId(restoreResponse.session_id);
  await loadScrews(restoreResponse.session_id);
}
```

#### Delete a plan

```typescript
const deleteResponse = await planningBackendService.deletePlan(planId);
```

### 5. Utility Methods

#### Check backend availability

```typescript
const isAvailable = await planningBackendService.isAvailable();

if (!isAvailable) {
  console.warn('Planning backend is not available');
  // Fall back to localStorage or show warning to user
}
```

#### Get backend status

```typescript
const status = await planningBackendService.getStatus();

if (status.success) {
  console.log('Backend version:', status.version);
  console.log('Uptime:', status.uptime, 'seconds');
}
```

## Integration with Existing Code

### Refactoring ScrewManagementPanel.tsx

Replace direct fetch calls with service methods:

**Before:**
```typescript
const response = await fetch('http://localhost:3001/api/planning/session/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ... })
});
const data = await response.json();
```

**After:**
```typescript
const data = await planningBackendService.startSession({
  studyInstanceUID: newStudyUID,
  seriesInstanceUID: newSeriesUID,
  surgeon: newSurgeon
});
```

### Benefits

1. **Type Safety**: Full TypeScript types for requests and responses
2. **Centralized Logic**: All API calls in one place
3. **Error Handling**: Consistent error handling across all operations
4. **Logging**: Built-in logging for debugging
5. **Maintainability**: Easy to update API endpoints or add new features
6. **Testability**: Easy to mock for unit tests

## Configuration

To use a different backend URL:

```typescript
import PlanningBackendService from '../services/planningBackendService';

const customBackend = new PlanningBackendService('http://custom-server:8080/api/planning');
```

## Error Handling Pattern

All methods return a response object with `success` field:

```typescript
const response = await planningBackendService.someMethod(...);

if (response.success) {
  // Operation succeeded
  const result = response.someField;
} else {
  // Operation failed
  console.error('Error:', response.error);
  alert(`Operation failed: ${response.error}`);
}
```

## Next Steps

1. Refactor `ScrewManagementPanel.tsx` to use this service
2. Update `modelStateService.ts` to use model query methods
3. Create integration tests for the service
4. Add retry logic for failed requests
5. Implement request caching for frequently accessed data
