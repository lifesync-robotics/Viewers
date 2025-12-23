# Quick Setup Guide

## Prerequisites

The refactored workflow system requires these dependencies:

```json
{
  "js-yaml": "^4.1.0",
  "lodash": "^4.17.21"
}
```

## Installation Steps

### 1. Install Dependencies

Run in your project root:
```bash
npm install js-yaml lodash
npm install --save-dev @types/js-yaml @types/lodash
```

Or if using yarn:
```bash
yarn add js-yaml lodash
yarn add --dev @types/js-yaml @types/lodash
```

### 2. Configure Bundler for YAML Import

The system imports YAML as raw text. Configure your bundler:

#### For Vite (vite.config.ts):
```typescript
export default defineConfig({
  // ... other config
  assetsInclude: ['**/*.yaml'],
  plugins: [
    // If needed, add a plugin to handle ?raw imports
  ]
});
```

#### For Webpack (webpack.config.js):
```javascript
module.exports = {
  // ... other config
  module: {
    rules: [
      {
        test: /\.yaml$/,
        type: 'asset/source',
      },
    ],
  },
};
```

### 3. Initialize Configuration in App Startup

Find your app's main initialization file (usually `App.tsx`, `index.tsx`, or similar) and add:

```typescript
import { initializeWorkflowConfig } from './lifesync/config';

// Option 1: Initialize before rendering (recommended)
async function startApp() {
  try {
    await initializeWorkflowConfig();
    console.log('✅ Workflow configuration initialized');
    
    // Now render your app
    ReactDOM.render(<App />, document.getElementById('root'));
  } catch (error) {
    console.error('❌ Failed to initialize workflow configuration:', error);
    // Handle error appropriately
  }
}

startApp();

// Option 2: Initialize in useEffect (if needed)
function App() {
  const [configReady, setConfigReady] = useState(false);
  
  useEffect(() => {
    initializeWorkflowConfig()
      .then(() => {
        console.log('✅ Workflow configuration initialized');
        setConfigReady(true);
      })
      .catch(error => {
        console.error('❌ Failed to initialize:', error);
      });
  }, []);
  
  if (!configReady) {
    return <LoadingScreen />;
  }
  
  return <YourApp />;
}
```

### 4. Update Any Components Using Old Constants

Search your codebase for these imports and update them:

```typescript
// OLD - Remove these imports
import { STAGE_ORDER, STAGE_LABELS, STAGE_ROUTES } from './types';

// NEW - Use configuration instead
import { getWorkflowConfig } from './config';

// Usage
const config = getWorkflowConfig();
const stageOrder = config.getStageOrder();
const stageLabels = config.getStageLabels();
const stageRoutes = config.getStageRoutes();
```

### 5. Verify Setup

Add this temporary test in your console or a component:

```typescript
import { getWorkflowConfig } from './lifesync/config';

// Test configuration is loaded
try {
  const config = getWorkflowConfig();
  console.log('✅ Configuration loaded successfully');
  console.log('Stages:', config.getStageOrder());
  console.log('Initial stage:', config.getInitialStage().id);
  console.log('Final stage:', config.getFinalStage().id);
  console.log('Is "review" final?', config.isFinalStage('review'));
} catch (error) {
  console.error('❌ Configuration error:', error);
}
```

Expected output:
```
✅ Configuration loaded successfully
Stages: ['beginning', 'segmentation', 'planning', 'reporting', 'review']
Initial stage: beginning
Final stage: review
Is "review" final? true
```

## Troubleshooting

### Error: "Cannot find module '*.yaml'"

**Solution**: Add type declaration for YAML imports.

Create `types/yaml.d.ts`:
```typescript
declare module '*.yaml' {
  const content: string;
  export default content;
}

declare module '*?raw' {
  const content: string;
  export default content;
}
```

### Error: "Configuration not initialized"

**Solution**: Ensure `initializeWorkflowConfig()` is called before using the configuration.

```typescript
// Make sure this runs first
await initializeWorkflowConfig();

// Then this will work
const config = getWorkflowConfig();
```

### Error: "Invalid YAML syntax"

**Solution**: Validate your YAML file at [yamllint.com](http://www.yamllint.com/)

Common issues:
- Incorrect indentation (use 2 spaces, not tabs)
- Missing colons
- Unquoted special characters

### Error: "Stage not found in configuration"

**Solution**: Verify the stage ID exists in `workflow-config.yaml`:

```yaml
stages:
  - id: "your_stage_id"  # ← This must match exactly
```

## Testing Your Setup

### 1. Basic Workflow Test

```typescript
import { getWorkflowConfig } from './lifesync/config';
import { validateStageFromConfig } from './lifesync/utils/configValidation';

// Test navigation
const config = getWorkflowConfig();
const currentStage = 'beginning';
const nextStage = config.getNextStage(currentStage);
console.log(`Next stage after ${currentStage}:`, nextStage?.id);

// Test validation
const validation = validateStageFromConfig('review', workflowState);
console.log('Can advance from review?', validation.canAdvance);  // Should be false
console.log('Is final stage?', validation.isFinalStage);  // Should be true
```

### 2. Final Stage Bug Fix Test

This test verifies the "non-final stage treated as final" bug is fixed:

```typescript
const config = getWorkflowConfig();

// Test each stage
const stages = ['beginning', 'segmentation', 'planning', 'reporting', 'review'];

stages.forEach(stageId => {
  const isFinal = config.isFinalStage(stageId);
  const nextStage = config.getNextStage(stageId);
  
  console.log(`Stage: ${stageId}`);
  console.log(`  Is final? ${isFinal}`);
  console.log(`  Has next? ${!!nextStage}`);
  console.log(`  Next stage: ${nextStage?.id || 'none'}`);
  
  // Verify consistency
  if (isFinal) {
    console.assert(!nextStage, `❌ Final stage ${stageId} should not have next stage`);
  } else {
    console.assert(nextStage, `❌ Non-final stage ${stageId} should have next stage`);
  }
});

// Expected output:
// Stage: beginning - Is final? false, Has next? true, Next stage: segmentation
// Stage: segmentation - Is final? false, Has next? true, Next stage: planning
// Stage: planning - Is final? false, Has next? true, Next stage: reporting
// Stage: reporting - Is final? false, Has next? true, Next stage: review
// Stage: review - Is final? true, Has next? false, Next stage: none ✅
```

### 3. Complete Integration Test

```typescript
// Test complete workflow navigation
async function testWorkflow() {
  const config = getWorkflowConfig();
  const stages = config.getStageOrder();
  
  console.log('Testing workflow navigation through all stages...\n');
  
  for (let i = 0; i < stages.length; i++) {
    const stageId = stages[i];
    const stageConfig = config.getStage(stageId);
    const isFinal = config.isFinalStage(stageId);
    const next = config.getNextStage(stageId);
    const prev = config.getPreviousStage(stageId);
    
    console.log(`Stage ${i + 1}/${stages.length}: ${stageConfig.name}`);
    console.log(`  ID: ${stageId}`);
    console.log(`  Route: ${stageConfig.route}`);
    console.log(`  Is Initial? ${stageConfig.properties.isInitial}`);
    console.log(`  Is Final? ${isFinal}`);
    console.log(`  Previous: ${prev?.id || 'none'}`);
    console.log(`  Next: ${next?.id || 'none'}`);
    console.log(`  Dependencies: ${stageConfig.dependencies.join(', ') || 'none'}`);
    console.log('');
  }
  
  console.log('✅ All stages tested successfully');
}

testWorkflow();
```

## Post-Setup Checklist

- [ ] Dependencies installed (`js-yaml`, `lodash`)
- [ ] Bundler configured for YAML imports
- [ ] Configuration initialized in app startup
- [ ] Old constant imports replaced with config loader
- [ ] Verification test passed
- [ ] Final stage bug fix verified
- [ ] No linter errors
- [ ] App runs without configuration errors

## Next Steps

1. **Test the workflow** in your development environment
2. **Navigate through all stages** to ensure transitions work
3. **Test final stage** to verify it cannot advance
4. **Review console logs** for any configuration warnings
5. **Update workflow** by editing `workflow-config.yaml` (no code changes!)

## Getting Help

If you encounter issues:

1. **Check console logs** - Look for emoji-prefixed messages (🏗️ 📂 ✅ ❌ 🔍)
2. **Validate YAML** - Use [yamllint.com](http://www.yamllint.com/)
3. **Read documentation**:
   - `config/README.md` - Comprehensive architecture guide
   - `REFACTORING_SUMMARY.md` - What changed and why
   - `ARCHITECTURE_COMPARISON.md` - Before/after comparison

4. **Debug with configuration inspector**:
```typescript
const config = getWorkflowConfig();
console.log('Full config:', config.getConfig());
console.log('Stages:', config.getStages());
console.log('Validation rules:', config.getWorkflowConfig().validationRules);
```

## Success Indicators

You'll know the setup is successful when:

✅ App starts without configuration errors  
✅ Console shows "✅ Workflow configuration initialized"  
✅ Workflow navigator displays all stages correctly  
✅ Stage navigation works (forward and back)  
✅ Final stage (review) cannot advance  
✅ Non-final stages can advance  
✅ User confirmation dialogs show config-driven messages  

Congratulations! Your workflow system is now configuration-driven! 🎉

