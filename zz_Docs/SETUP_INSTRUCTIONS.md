# 🚀 Setup Instructions - 3D Model Server

## You're Almost Ready!

The 3D Model Server has been implemented and integrated into your OHIF viewer. Follow these simple steps to get started.

---

## Step 1: Install New Dependencies

The implementation added several new packages. Install them now:

```bash
cd platform/app
yarn install
```

**New packages installed:**
- `express` - Web server for serving models
- `multer` - File upload handling
- `cors` - Cross-origin resource sharing
- `concurrently` - Run multiple servers

---

## Step 2: Add Your Models (Optional)

If you have 3D models to serve, place them in the `models/server/` directory:

```bash
# From project root (Viewers/)
mkdir -p models/server

# Copy your .obj files
cp /path/to/your/brain.obj models/server/
cp /path/to/your/skull.obj models/server/
```

**Note:** This step is optional. You can start without models and upload them later through the UI.

---

## Step 3: Start the Server

Start both the model server and OHIF viewer with one command:

```bash
# From project root (Viewers/)
yarn run dev
```

**What happens:**
1. Model server starts on port 5001
2. OHIF viewer starts on port 3000
3. Webpack proxies model requests automatically

**Expected output:**

```
=================================================
3D Model Server Started
=================================================
Server running on: http://localhost:5001
Server models directory: C:\Users\hp\tableTop\mvisioner\Viewers\models\server
User uploads directory: C:\Users\hp\tableTop\mvisioner\Viewers\models\uploads

Available endpoints:
  GET  /api/models/list          - List all models
  POST /api/models/upload        - Upload new model
  ...
=================================================

[webpack-dev-server] Starting on port 3000
```

---

## Step 4: Verify Installation

Open your browser and test:

### Test 1: Health Check
Navigate to: `http://localhost:3000/api/health`

**Expected response:**
```json
{
  "status": "ok",
  "serverTime": "2024-11-07T...",
  "modelsDir": "C:\\Users\\hp\\tableTop\\mvisioner\\Viewers\\models"
}
```

### Test 2: List Models
Navigate to: `http://localhost:3000/api/models/list`

**Expected response:**
```json
{
  "success": true,
  "count": 2,
  "models": [...]
}
```

### Test 3: Browser Console
Open browser console and run:

```javascript
const modelService = window.ohif?.app?.servicesManager?.services?.modelStateService;
if (modelService) {
  const models = await modelService.fetchAvailableModels();
  console.log('Available models:', models);
}
```

---

## Step 5: Use in Your Code

### List Available Models

```javascript
const { servicesManager } = props;
const modelStateService = servicesManager.services.modelStateService;

const models = await modelStateService.fetchAvailableModels();
console.log(`Found ${models.length} models`);
```

### Load a Model

```javascript
await modelStateService.loadModelFromServer('/models/server/brain.obj', {
  viewportId: 'viewport-3d',
  color: [1, 0.5, 0.5],  // Pink
  opacity: 0.8
});
```

### Upload and Load

```javascript
const file = document.querySelector('input[type="file"]').files[0];

await modelStateService.uploadAndLoadModel(file, {
  viewportId: 'viewport-3d'
});
```

---

## Directory Structure

After setup, your directory structure will be:

```
Viewers/
├── models/                          # ✨ NEW
│   ├── server/                      # Default models
│   │   └── *.obj
│   ├── uploads/                     # User uploads
│   └── README.md
│
├── platform/app/
│   ├── server/                      # ✨ NEW - Model server code
│   │   ├── modelServer.js
│   │   └── startModelServer.js
│   ├── .webpack/
│   │   └── webpack.pwa.js          # ✨ UPDATED - Proxy config
│   └── package.json                 # ✨ UPDATED - Scripts & deps
│
└── extensions/cornerstone/src/
    └── modelStateService.ts         # ✨ UPDATED - API methods
```

---

## Common Issues & Solutions

### Issue: "Port 5001 already in use"

**Solution:** Change the port:
```bash
export MODEL_SERVER_PORT=5002
yarn run dev
```

### Issue: "Module not found: express"

**Solution:** Install dependencies:
```bash
cd platform/app
yarn install
```

### Issue: Models list is empty

**Solutions:**
1. Add models to `models/server/` directory
2. Or upload models through the UI
3. Check server logs for errors

### Issue: CORS errors in browser

**Solutions:**
1. Make sure you access via `http://localhost:3000`
2. Don't use `file://` protocol
3. Check webpack proxy configuration

---

## What's Next?

### Option 1: Create UI Components

Build a model picker component:
- List available models
- Upload new models
- Load models into viewports

See `EXAMPLE_MODEL_USAGE.js` for 9 complete examples.

### Option 2: Integrate with Existing UI

Add model loading to:
- Toolbar buttons
- Side panels
- Context menus

### Option 3: Add More Models

Download free OBJ models from:
- [Thingiverse](https://www.thingiverse.com/)
- [Free3D](https://free3d.com/)
- [TurboSquid](https://www.turbosquid.com/Search/3D-Models/free)

---

## Documentation

For more detailed information, see:

1. **[MODEL_SERVER_QUICK_START.md](./MODEL_SERVER_QUICK_START.md)**
   - Quick 5-minute guide
   - Essential commands
   - Basic usage

2. **[MODEL_SERVER_SETUP.md](./MODEL_SERVER_SETUP.md)**
   - Complete setup guide
   - Architecture details
   - API reference
   - Troubleshooting

3. **[EXAMPLE_MODEL_USAGE.js](./EXAMPLE_MODEL_USAGE.js)**
   - 9 practical examples
   - React components
   - Integration patterns

4. **[MODEL_SERVER_IMPLEMENTATION_SUMMARY.md](./MODEL_SERVER_IMPLEMENTATION_SUMMARY.md)**
   - Technical details
   - Code changes
   - Architecture diagram

---

## Quick Reference

### Start Commands

```bash
# Start both servers (recommended)
yarn run dev

# Start only OHIF viewer
yarn run dev:viewer

# Start only model server
yarn run dev:model-server
```

### API Methods

```javascript
// Fetch models
await modelStateService.fetchAvailableModels()

// Upload model
await modelStateService.uploadModelToServer(file)

// Load from server
await modelStateService.loadModelFromServer(url, options)

// Upload and load
await modelStateService.uploadAndLoadModel(file, options)
```

### Endpoints

```
GET  http://localhost:3000/api/models/list
POST http://localhost:3000/api/models/upload
GET  http://localhost:3000/models/server/brain.obj
GET  http://localhost:3000/models/uploads/custom.obj
```

---

## Summary

✅ **Express server created** - Serves models via HTTP
✅ **CORS handled** - No browser security issues
✅ **Proxy configured** - Seamless integration
✅ **API methods added** - Easy to use in code
✅ **Upload capability** - Users can add models
✅ **Documentation complete** - Guides and examples

---

## Need Help?

1. Check the troubleshooting sections in documentation
2. Review the example code in `EXAMPLE_MODEL_USAGE.js`
3. Test the API endpoints directly with curl
4. Check browser console for error messages

---

## Enjoy Your 3D Models! 🎨

You can now:
- ✅ Serve models from local directory
- ✅ Upload models through UI
- ✅ Load models into viewports
- ✅ No browser security issues!

**Start coding and have fun!** 🚀
