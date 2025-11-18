# 3D Model Server - Quick Start

Get your 3D models up and running in 5 minutes!

## 1. Install Dependencies

```bash
cd platform/app
yarn install
```

## 2. Add Models (Optional)

```bash
# Create directory if it doesn't exist
mkdir -p ../../models/server

# Copy your .obj files
cp /path/to/your/model.obj ../../models/server/
```

## 3. Start Server

```bash
# From project root
yarn run dev
```

That's it! ✅

## What Just Happened?

The `yarn run dev` command now starts:

1. **Model Server** (port 5001) - Serves your 3D models
2. **OHIF Viewer** (port 3000) - Your medical imaging viewer

Both servers work together seamlessly. The webpack dev server proxies requests to the model server, avoiding any browser security issues.

## Usage in Code

### List Available Models

```javascript
const models = await modelStateService.fetchAvailableModels();
console.log(models);
// [
//   { name: 'brain', url: '/models/server/brain.obj', type: 'server' },
//   { name: 'skull', url: '/models/server/skull.obj', type: 'server' }
// ]
```

### Load a Model

```javascript
await modelStateService.loadModelFromServer('/models/server/brain.obj', {
  viewportId: 'viewport-3d',
  color: [1, 0.5, 0.5],
  opacity: 0.8
});
```

### Upload and Load

```javascript
// File from input element
const file = document.querySelector('input[type="file"]').files[0];

await modelStateService.uploadAndLoadModel(file, {
  viewportId: 'viewport-3d'
});
```

## Endpoints Available

Once running, you can access:

- **List models**: `http://localhost:3000/api/models/list`
- **Upload model**: `POST http://localhost:3000/api/models/upload`
- **Access models**: `http://localhost:3000/models/server/brain.obj`

## Directory Structure

```
Viewers/
├── models/
│   ├── server/      # Put your default .obj files here
│   └── uploads/     # User uploads go here (auto-created)
└── platform/app/
    └── server/      # Server code (already created)
```

## Common Commands

```bash
# Start with model server (default)
yarn run dev

# Start without model server
yarn run dev:viewer

# Start only model server
yarn run dev:model-server
```

## Troubleshooting

### Port Already in Use

```bash
# Change model server port
export MODEL_SERVER_PORT=5002
yarn run dev
```

### Models Not Loading

1. Check both servers are running (look for startup messages)
2. Open `http://localhost:3000/api/models/list` in browser
3. Check console for errors

### Need Help?

See the full documentation: [MODEL_SERVER_SETUP.md](./MODEL_SERVER_SETUP.md)

## What's Next?

- Add your own models to `models/server/`
- Create a UI component to browse/load models
- Integrate with your existing OHIF extensions
- Deploy to production

Happy modeling! 🎨
