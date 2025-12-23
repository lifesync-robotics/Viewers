# Webpack Configuration Update for Workflow Config

## Problem

The workflow configuration YAML file was causing webpack build errors:
```
Module parse failed: Unexpected character ' ' (1:1)
You may need an appropriate loader to handle this file type
```

## Solution

Updated `Viewers/platform/app/.webpack/webpack.pwa.js` to:

1. **Add YAML loader** - Load YAML files as raw text strings
2. **Exclude from HMR** - Prevent hot module replacement for workflow config (it doesn't change often)

## Changes Made

### 1. YAML Module Rule

Added webpack rule to handle YAML files:

```javascript
mergedConfig.module.rules.push({
  test: /\.yaml$/,
  type: 'asset/source',  // Load as raw text string
});
```

This tells webpack to load `.yaml` files as raw text strings that can be imported in TypeScript/JavaScript.

### 2. Exclude from Hot Module Replacement

Updated `watchOptions` to exclude the workflow config:

```javascript
mergedConfig.watchOptions = {
  ignored: [
    /node_modules\/@cornerstonejs/,
    /lifesync\/config\/workflow-config\.yaml$/,  // Exclude workflow config from HMR
  ],
};
```

**Benefits**:
- ✅ Faster rebuilds (YAML file not watched)
- ✅ No unnecessary reloads (config rarely changes)
- ✅ Simpler than embedding YAML as string constant
- ✅ Keeps YAML file separate and editable

## How It Works

### Import Syntax

The import statement in `initializeWorkflowConfig.ts`:

```typescript
import workflowConfigYaml from './workflow-config.yaml?raw';
```

The `?raw` suffix isn't strictly necessary with `asset/source` type, but can be kept for clarity. The webpack rule handles loading the file as raw text.

### Processing Flow

1. **Build Time**: Webpack sees `import ... from '*.yaml'`
2. **Loader Applied**: The `asset/source` rule loads the file content as a string
3. **Result**: The YAML content is available as a string constant in JavaScript
4. **Runtime**: `WorkflowConfigLoader` parses the YAML string

### File Watching

- **Development**: Webpack watches all source files for changes
- **Excluded**: `workflow-config.yaml` is excluded from watch (doesn't trigger HMR)
- **Manual Reload**: If you edit the YAML, you'll need to manually refresh the browser (or restart webpack)

## When to Manually Reload

Since the YAML is excluded from HMR, you need to manually reload when you:

1. **Edit workflow stages** in `workflow-config.yaml`
2. **Change validation rules**
3. **Update stage dependencies**
4. **Modify UI configuration**

Simply refresh the browser (F5) or restart the webpack dev server.

## Alternative Approach (If Needed)

If you need the YAML to hot reload:

**Remove from ignored list**:
```javascript
mergedConfig.watchOptions = {
  ignored: [
    /node_modules\/@cornerstonejs/,
    // Remove: /lifesync\/config\/workflow-config\.yaml$/,
  ],
};
```

This will cause webpack to reload when the YAML changes, but may slow down development.

## Verification

Test that the configuration works:

```bash
# Start dev server
yarn dev

# Should build without errors
# Check console for:
# ✅ Workflow configuration initialized successfully
```

## Troubleshooting

### Error: "Cannot find module '*.yaml'"

**Cause**: TypeScript doesn't know about YAML imports  
**Solution**: The `yaml.d.ts` type declaration is already in `src/lifesync/types/`

### Error: Still getting "Module parse failed"

**Cause**: Webpack cache might be stale  
**Solution**:
```bash
# Clear webpack cache
rm -rf Viewers/platform/app/.webpack/cache

# Restart dev server
yarn dev
```

### YAML changes not reflecting

**Cause**: File is excluded from HMR  
**Solution**: 
1. Manually refresh browser (F5)
2. Or restart webpack dev server

## Benefits Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Build** | ❌ Error | ✅ Success |
| **YAML Location** | Embedded in .ts | ✅ Separate .yaml file |
| **Edit Workflow** | Edit TypeScript constant | ✅ Edit YAML directly |
| **Hot Reload** | N/A | Manual refresh |
| **Build Speed** | N/A | ✅ Faster (file excluded) |
| **Maintainability** | Mixed concerns | ✅ Clean separation |

## Related Files

- **Webpack Config**: `Viewers/platform/app/.webpack/webpack.pwa.js`
- **YAML File**: `Viewers/platform/app/src/lifesync/config/workflow-config.yaml`
- **Loader**: `Viewers/platform/app/src/lifesync/config/initializeWorkflowConfig.ts`
- **Type Declaration**: `Viewers/platform/app/src/lifesync/types/yaml.d.ts`

## Summary

The webpack configuration now properly handles YAML files by:
1. Loading them as raw text using `asset/source`
2. Excluding the workflow config from hot reload (since it rarely changes)
3. Keeping the YAML file separate and editable

This provides a clean, maintainable solution that solves the webpack build error while keeping configuration and implementation properly separated. 🎉

