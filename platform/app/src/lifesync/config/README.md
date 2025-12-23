# Workflow Configuration System

## Overview

The workflow system has been refactored to **separate configuration from mechanics**. This makes the workflow easier to understand, debug, and update.

## Architecture

### 1. Configuration Layer (`workflow-config.yaml`)
**Purpose**: Define workflow stages, dependencies, validation rules, and UI settings.

**Key Benefits**:
- Easy to read and understand the complete workflow at a glance
- No code changes needed to modify workflow structure
- Clear dependency chains and validation rules
- Version-controlled configuration

**Location**: `Viewers/platform/app/src/lifesync/config/workflow-config.yaml`

### 2. Configuration Loader (`WorkflowConfigLoader.ts`)
**Purpose**: Parse and provide typed access to workflow configuration.

**Responsibilities**:
- Load and parse YAML configuration
- Validate configuration structure
- Provide helper methods to access configuration data
- Cache configuration for performance

**Key Methods**:
```typescript
const config = getWorkflowConfig();

// Get stages
config.getStages()              // All stages in order
config.getStage('planning')     // Specific stage
config.getInitialStage()        // First stage
config.getFinalStage()          // Last stage

// Navigation
config.getNextStage('planning')      // Stage after planning
config.getPreviousStage('planning')  // Stage before planning
config.isFinalStage('review')        // Check if final stage

// Labels and routes
config.getStageLabels()         // { beginning: 'Basic Viewer', ... }
config.getStageRoutes()         // { beginning: '/basic', ... }
```

### 3. Validation Engine (`configValidation.ts`)
**Purpose**: Execute validation rules defined in configuration.

**Validation Types**:
1. **Auto-validation**: System checks automatically
   - Data checks (exists, not_empty, equals, greater_than)
   - Service checks (call service methods)
   - Custom rules (special logic)

2. **User confirmation**: Explicit user approval required

**Example**:
```yaml
validation:
  auto:
    - rule: "segmentation_exists"
      message: "At least one segmentation must be created"
  userConfirmation:
    enabled: true
    message: "Have you completed all required segmentations?"
```

### 4. Workflow Service (Refactored)
**Purpose**: Manage workflow state and transitions using configuration.

**Changes**:
- Loads stage definitions from configuration (not hardcoded)
- Uses config-driven validation
- Respects navigation rules from configuration
- **Explicitly marks final stage** to prevent "non-final treated as final" bug

### 5. Workflow Navigator (Refactored)
**Purpose**: UI component for workflow navigation.

**Changes**:
- Loads stage labels/order from configuration
- Uses config-driven confirmation messages
- Dynamic stage rendering based on configuration

## Key Fix: Final Stage Handling

### The Problem
Previously, the code was confused about which stage was final, causing non-final stages to be treated as final stages.

### The Solution
The configuration explicitly defines the final stage:

```yaml
stages:
  - id: "review"
    name: "Review & Approval"
    properties:
      isFinal: true  # ← EXPLICIT MARKER
    
    validation:
      finalStage:
        canAdvance: false  # ← Cannot advance beyond
        reason: "This is the final stage of the workflow"
```

The validation includes an `isFinalStage` flag:

```typescript
export interface WorkflowValidation {
  canAdvance: boolean;
  reason?: string;
  isFinalStage?: boolean;  // ← Explicit flag
}
```

## Configuration File Structure

### Top-Level Sections

1. **`workflow.metadata`**: Default workflow settings
2. **`workflow.stages`**: Stage definitions with validation and dependencies
3. **`workflow.validationRules`**: Rule definitions referenced by stages
4. **`workflow.navigation`**: Navigation behavior settings
5. **`ui`**: UI appearance and behavior

### Stage Definition

```yaml
- id: "planning"                    # Stage identifier
  name: "Surgical Planning"         # Display name
  description: "..."                # Stage description
  route: "/planner"                 # URL route
  order: 3                          # Position in workflow
  
  properties:
    isInitial: false                # First stage?
    isFinal: false                  # Last stage?
    canSkip: false                  # Can be skipped?
    requiresCompletion: true        # Must be completed?
  
  validation:
    auto:                           # Automatic checks
      - rule: "plan_exists"
        message: "A surgical plan must be created"
    userConfirmation:               # User approval
      enabled: true
      message: "Have you completed the surgical plan?"
  
  dependencies:                     # Required previous stages
    - "beginning"
    - "segmentation"
  
  dataSchema:                       # Required data fields
    required:
      - "sessionId"
      - "planId"
  
  actions:                          # Event handlers
    onEnter: [...]
    onExit: [...]
```

### Validation Rule Definition

```yaml
validationRules:
  plan_exists:
    type: "service_check"           # Check type
    service: "planning"             # Service to check
    method: "hasPlan"               # Method to call
  
  screws_placed:
    type: "data_check"              # Data validation
    path: "stages.planning.screwCount"
    condition: "greater_than"
    value: 0
```

## Usage

### Initialization

The configuration must be initialized during application startup:

```typescript
import { initializeWorkflowConfig } from './config';

// During app initialization
await initializeWorkflowConfig();
```

### Using Configuration in Code

```typescript
import { getWorkflowConfig } from './config';

const config = getWorkflowConfig();

// Get stage information
const planningStage = config.getStage('planning');
console.log(planningStage.name);  // "Surgical Planning"

// Check if final stage
if (config.isFinalStage(currentStage)) {
  console.log('Cannot advance - final stage');
}

// Get navigation info
const nextStage = config.getNextStage(currentStage);
const route = config.getStageRoute(nextStage.id);
```

### Using Validation

```typescript
import { validateStageFromConfig, getUserConfirmationMessage } from '../utils/configValidation';

// Validate a stage
const validation = validateStageFromConfig('planning', workflowState, services);

if (validation.isFinalStage) {
  console.log('This is the final stage');
}

if (!validation.canAdvance) {
  console.log(`Cannot advance: ${validation.reason}`);
}

// Get user confirmation message
const message = getUserConfirmationMessage('planning');
if (message) {
  const confirmed = window.confirm(message);
}
```

## Debugging Workflow Issues

### 1. Check Configuration
Open `workflow-config.yaml` and verify:
- Stage order is correct
- Dependencies are properly set
- Final stage is marked with `isFinal: true`
- Validation rules are defined

### 2. Check Stage Properties
```typescript
const config = getWorkflowConfig();
const stage = config.getStage('stageName');

console.log('Is final?', stage.properties.isFinal);
console.log('Dependencies:', stage.dependencies);
console.log('Validation rules:', stage.validation.auto);
```

### 3. Check Validation State
```typescript
const validation = workflowService.validateStage('stageName');

console.log('Can advance?', validation.canAdvance);
console.log('Is final stage?', validation.isFinalStage);
console.log('Reason:', validation.reason);
```

### 4. Enable Debug Logging
All configuration and validation functions log to console with emoji prefixes:
- 🏗️ Initialization
- 📂 Loading
- ✅ Success
- ❌ Error
- 🔍 Validation
- ➡️ Navigation

## Modifying the Workflow

### Adding a New Stage

1. **Update `workflow-config.yaml`**:
```yaml
- id: "new_stage"
  name: "New Stage"
  route: "/new"
  order: 6  # After existing stages
  
  properties:
    isInitial: false
    isFinal: false
    canSkip: false
    requiresCompletion: true
  
  validation:
    auto: []
    userConfirmation:
      enabled: true
      message: "Complete this stage?"
  
  dependencies:
    - "previous_stage"
  
  dataSchema:
    required: []
  
  actions:
    onEnter: []
    onExit: []
```

2. **Add validation rules** (if needed):
```yaml
validationRules:
  new_stage_check:
    type: "data_check"
    path: "stages.new_stage.someField"
    condition: "exists"
```

3. **Update stage data interface** (if custom data):
```typescript
// In workflow.types.ts
export interface NewStageData extends WorkflowStageData {
  someField?: string;
}
```

That's it! No other code changes needed.

### Changing Stage Order

Simply update the `order` field in the YAML:
```yaml
- id: "planning"
  order: 3  # Change this number
```

### Modifying Validation Rules

Update the validation section in the stage definition:
```yaml
validation:
  auto:
    - rule: "new_rule"
      message: "New requirement"
  userConfirmation:
    message: "Updated confirmation message"
```

## Migration Guide

### Old Way (Hardcoded)
```typescript
// Hardcoded stage order
const STAGE_ORDER = ['beginning', 'segmentation', ...];

// Hardcoded labels
const STAGE_LABELS = {
  beginning: 'Basic Viewer',
  ...
};

// Hardcoded validation
if (stage === 'review') {
  return { canAdvance: false };
}
```

### New Way (Configuration-Driven)
```typescript
// Load from configuration
const config = getWorkflowConfig();
const stageOrder = config.getStageOrder();
const stageLabels = config.getStageLabels();

// Config-driven validation
const validation = validateStageFromConfig(stage, state, services);
if (validation.isFinalStage) {
  return { canAdvance: false, reason: validation.reason };
}
```

## Benefits Summary

✅ **Separation of Concerns**: Configuration vs. implementation  
✅ **Easy to Debug**: View entire workflow in one YAML file  
✅ **Easy to Update**: Change configuration without code changes  
✅ **Type Safety**: TypeScript types for all configuration  
✅ **Explicit Final Stage**: No more confusion about which stage is final  
✅ **Validation Engine**: Flexible, configuration-driven validation  
✅ **Documentation**: YAML serves as workflow documentation  

## Troubleshooting

### "Configuration not initialized" error
**Solution**: Call `initializeWorkflowConfig()` during app startup.

### "Stage not found in configuration" error
**Solution**: Check that the stage ID exists in `workflow-config.yaml`.

### Validation not working
**Solutions**:
1. Check that validation rules are defined in `validationRules` section
2. Verify rule names match between stage and rule definition
3. Check console logs for validation errors (look for ❌ emoji)

### Final stage allowing advancement
**Solution**: Verify in YAML:
```yaml
properties:
  isFinal: true
validation:
  finalStage:
    canAdvance: false
```

## Future Enhancements

Possible future improvements:
- Load configuration from backend API
- Support multiple workflow configurations
- Visual workflow editor
- Workflow versioning
- A/B testing different workflows
- Runtime workflow modification

## Support

For issues or questions:
1. Check console logs for debug information
2. Validate YAML syntax at [yamllint.com](http://www.yamllint.com/)
3. Review this documentation
4. Check the configuration with `config.getConfig()` in browser console

