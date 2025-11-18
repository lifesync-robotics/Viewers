# 3D Model Server Setup Guide

## Overview

This guide explains how to set up and use the 3D Model Server for OHIF. The server allows you to:

1. **Serve models from a local directory** - Store default models that all users can access
2. **Upload models** - Users can upload their own 3D models through the UI
3. **Avoid browser security issues** - Proper CORS and proxy configuration

## Table of Contents

- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Directory Structure](#directory-structure)
- [Usage Examples](#usage-examples)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────┐
│  Browser (http://localhost:3000)                    │
│  ┌────────────────────────────────────────────┐    │
│  │  OHIF Viewer                                │    │
│  │  - modelStateService.fetchAvailableModels() │    │
│  │  - modelStateService.uploadModelToServer()  │    │
│  │  - modelStateService.loadModelFromServer()  │    │
│  └────────────────────────────────────────────┘    │
└──────────────────┬──────────────────────────────────┘
                   │ Proxied requests
                   ↓
┌─────────────────────────────────────────────────────┐
│  Webpack Dev Server (port 3000)                     │
│  - Proxies /api/models/* → localhost:5001           │
│  - Proxies /models/* → localhost:5001               │
└──────────────────┬──────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────┐
│  Model Server (port 5001)                           │
│  - Express server                                   │
│  - Serves static models                             │
│  - Handles uploads                                  │
│  - CORS enabled                                     │
└─────────────────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────┐
│  File System                                        │
│  models/                                            │
│  ├── server/    (default models)                    │
│  │   └── brain.obj                                  │
│  └── uploads/   (user uploads)                      │
│      └── 1699123456_custom.obj                      │
└─────────────────────────────────────────────────────┘
```

### Why This Approach?

1. **Avoids Browser Security Issues**
   - Browser File API has strict security restrictions
   - `file://` URLs are blocked by CORS policy
   - Proxying through webpack dev server provides seamless access

2. **Production Ready**
   - Same code works in development and production
   - Easy to deploy with Docker or cloud services
   - Environment variable configuration

3. **Developer Friendly**
   - Single `yarn run dev` command starts everything
   - Hot reload works normally
   - Separate concerns (viewer vs. file serving)

---

## Quick Start

### 1. Install Dependencies

```bash
cd platform/app
yarn install
```

This installs:
- `express` - Web server framework
- `multer` - File upload handling
- `cors` - Cross-origin resource sharing
- `concurrently` - Run multiple commands

### 2. Add Your Models

Place your `.obj` files in the `models/server/` directory:

```bash
# From project root
mkdir -p models/server
cp /path/to/your/model.obj models/server/
```

### 3. Start the Server

```bash
# From project root
yarn run dev
```

This starts:
- Model server on `http://localhost:5001`
- OHIF viewer on `http://localhost:3000`

You should see output like:

```
=================================================
3D Model Server Started
=================================================
Server running on: http://localhost:5001
Server models directory: C:\Users\...\models\server
User uploads directory: C:\Users\...\models\uploads

Available endpoints:
  GET  /api/models/list          - List all models
  POST /api/models/upload        - Upload new model
  DELETE /api/models/:filename   - Delete user model
  GET  /models/server/*          - Access server models
  GET  /models/uploads/*         - Access uploaded models
  GET  /api/health               - Health check
=================================================
```

---

## Directory Structure

```
Viewers/
├── models/                          # Models directory (auto-created)
│   ├── server/                      # Default models (shared)
│   │   ├── .gitkeep
│   │   ├── brain.obj               # Example server model
│   │   └── skull.obj               # Example server model
│   ├── uploads/                     # User-uploaded models
│   │   ├── .gitkeep
│   │   └── 1699123456_custom.obj   # Timestamped user upload
│   └── README.md
│
├── platform/app/
│   ├── server/                      # Model server code
│   │   ├── modelServer.js          # Express server
│   │   └── startModelServer.js     # Server entry point
│   ├── .webpack/
│   │   └── webpack.pwa.js          # Webpack config (with proxy)
│   └── package.json                # Updated with new scripts
│
└── extensions/cornerstone/src/
    └── modelStateService.ts         # Updated with API methods
```

---

## Usage Examples

### Example 1: List Available Models

```javascript
// In your component or service
const { servicesManager } = props;
const modelStateService = servicesManager.services.modelStateService;

// Fetch list of all models
const models = await modelStateService.fetchAvailableModels();

console.log(`Found ${models.length} models:`);
models.forEach(model => {
  console.log(`- ${model.name} (${model.type})`);
  console.log(`  URL: ${model.url}`);
  console.log(`  Size: ${(model.size / 1024 / 1024).toFixed(2)} MB`);
});

/*
Output:
Found 3 models:
- brain (server)
  URL: /models/server/brain.obj
  Size: 5.23 MB
- skull (server)
  URL: /models/server/skull.obj
  Size: 8.45 MB
- custom (user)
  URL: /models/uploads/1699123456_custom.obj
  Size: 3.12 MB
*/
```

### Example 2: Load a Server Model

```javascript
const modelStateService = servicesManager.services.modelStateService;

// Load a model from the server
await modelStateService.loadModelFromServer('/models/server/brain.obj', {
  viewportId: 'viewport-3d',
  color: [1, 0.5, 0.5],  // Pink color
  opacity: 0.8
});
```

### Example 3: Upload and Load a Model

```javascript
// Create file input
const input = document.createElement('input');
input.type = 'file';
input.accept = '.obj';

input.onchange = async (e) => {
  const file = e.target.files[0];

  if (file) {
    const modelStateService = servicesManager.services.modelStateService;

    // Upload and automatically load
    const loadedModel = await modelStateService.uploadAndLoadModel(file, {
      viewportId: 'viewport-3d',
      color: [0.5, 0.5, 1],  // Blue color
      opacity: 1.0
    });

    if (loadedModel) {
      console.log('Model loaded successfully!');
    }
  }
};

input.click();
```

### Example 4: Upload Only (Without Loading)

```javascript
const modelStateService = servicesManager.services.modelStateService;

// Just upload, don't load yet
const result = await modelStateService.uploadModelToServer(file);

if (result.success) {
  console.log('Uploaded to:', result.model.url);
  console.log('Model ID:', result.model.id);

  // Load later when needed
  await modelStateService.loadModelFromServer(result.model.url, {
    viewportId: 'viewport-3d'
  });
}
```

### Example 5: Create a Model Picker UI Component

```jsx
import React, { useState, useEffect } from 'react';

function ModelPicker({ servicesManager }) {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadModels() {
      const modelStateService = servicesManager.services.modelStateService;
      const availableModels = await modelStateService.fetchAvailableModels();
      setModels(availableModels);
      setLoading(false);
    }
    loadModels();
  }, []);

  const handleLoadModel = async (modelUrl) => {
    const modelStateService = servicesManager.services.modelStateService;
    await modelStateService.loadModelFromServer(modelUrl, {
      viewportId: 'viewport-3d'
    });
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const modelStateService = servicesManager.services.modelStateService;
      await modelStateService.uploadAndLoadModel(file, {
        viewportId: 'viewport-3d'
      });

      // Refresh model list
      const updatedModels = await modelStateService.fetchAvailableModels();
      setModels(updatedModels);
    }
  };

  if (loading) return <div>Loading models...</div>;

  return (
    <div>
      <h3>Available Models</h3>
      <ul>
        {models.map(model => (
          <li key={model.id}>
            <button onClick={() => handleLoadModel(model.url)}>
              {model.name}
            </button>
            <span>({model.type})</span>
          </li>
        ))}
      </ul>

      <h3>Upload New Model</h3>
      <input
        type="file"
        accept=".obj"
        onChange={handleUpload}
      />
    </div>
  );
}
```

---

## API Reference

### ModelStateService Methods

#### `fetchAvailableModels(): Promise<Array>`

Fetches list of all available models from the server.

**Returns:**
```typescript
[
  {
    id: string,           // Unique identifier
    name: string,         // Display name
    filename: string,     // Actual filename
    type: 'server' | 'user',
    url: string,          // URL to load model
    size: number,         // File size in bytes
    createdAt: Date,      // Upload/creation date
    format: 'obj'         // File format
  }
]
```

#### `uploadModelToServer(file: File): Promise<Object>`

Uploads a model file to the server.

**Parameters:**
- `file`: File object (must be .obj format)

**Returns:**
```typescript
{
  success: boolean,
  model?: {
    id: string,
    name: string,
    filename: string,
    type: 'user',
    url: string,
    size: number,
    format: 'obj',
    uploadedAt: Date
  },
  error?: string
}
```

#### `loadModelFromServer(modelUrl: string, options?: ModelLoadOptions): Promise<LoadedModel>`

Loads a model from the server into a viewport.

**Parameters:**
- `modelUrl`: URL of the model (e.g., '/models/server/brain.obj')
- `options`: Optional loading configuration
  - `viewportId`: ID of viewport to load into
  - `color`: RGB color array [r, g, b] (0-1 range)
  - `opacity`: Opacity value (0-1 range)

#### `uploadAndLoadModel(file: File, options?: ModelLoadOptions): Promise<LoadedModel>`

Convenience method that uploads and immediately loads a model.

**Parameters:**
- `file`: File object to upload
- `options`: Same as `loadModelFromServer`

### REST API Endpoints

All endpoints are proxied through the webpack dev server at `http://localhost:3000`

#### `GET /api/models/list`

List all available models.

**Response:**
```json
{
  "success": true,
  "count": 3,
  "models": [
    {
      "id": "server_brain.obj",
      "name": "brain",
      "filename": "brain.obj",
      "type": "server",
      "url": "/models/server/brain.obj",
      "size": 5480192,
      "createdAt": "2024-11-07T10:30:00.000Z",
      "format": "obj"
    }
  ]
}
```

#### `POST /api/models/upload`

Upload a new model file.

**Request:**
- Content-Type: `multipart/form-data`
- Body: FormData with 'model' field containing file

**Response:**
```json
{
  "success": true,
  "model": {
    "id": "user_1699356789_model.obj",
    "name": "model",
    "filename": "1699356789_model.obj",
    "type": "user",
    "url": "/models/uploads/1699356789_model.obj",
    "size": 3200000,
    "format": "obj",
    "uploadedAt": "2024-11-07T12:00:00.000Z"
  }
}
```

#### `DELETE /api/models/:filename`

Delete a user-uploaded model.

**Response:**
```json
{
  "success": true,
  "message": "Model deleted successfully"
}
```

#### `GET /models/server/:filename`

Direct access to server models (static file serving).

#### `GET /models/uploads/:filename`

Direct access to uploaded models (static file serving).

---

## Configuration

### Environment Variables

You can customize the model server with environment variables:

```bash
# Model server port (default: 5001)
export MODEL_SERVER_PORT=5001

# Start server
yarn run dev
```

### Production Deployment

For production, you'll want to:

1. **Use a proper web server** (nginx, Apache)
2. **Set proper CORS headers**
3. **Add authentication** for uploads
4. **Use cloud storage** (S3, GCS) for scalability

Example production config:

```javascript
// production.config.js
module.exports = {
  modelServer: {
    baseUrl: process.env.MODEL_SERVER_URL || 'https://models.yourapp.com',
    apiKey: process.env.MODEL_API_KEY
  }
};
```

---

## Troubleshooting

### Models Not Loading

**Problem:** Models list is empty or fails to load.

**Solutions:**
1. Check that both servers are running:
   ```bash
   # Should see both:
   # - Model server on port 5001
   # - Webpack dev server on port 3000
   ```

2. Check browser console for errors

3. Test the API directly:
   ```bash
   curl http://localhost:3000/api/models/list
   ```

4. Verify proxy configuration in `platform/app/.webpack/webpack.pwa.js`

### CORS Errors

**Problem:** CORS policy blocking requests.

**Solutions:**
1. Ensure webpack proxy is configured correctly
2. Check that model server has CORS enabled
3. Access viewer through `http://localhost:3000`, not `file://`

### Upload Fails

**Problem:** Model upload returns error.

**Solutions:**
1. Verify file is `.obj` format
2. Check file size (max 100MB)
3. Ensure `models/uploads/` directory exists and is writable
4. Check server logs for detailed error

### Model Server Won't Start

**Problem:** Port already in use or server crashes.

**Solutions:**
1. Check if port 5001 is already in use:
   ```bash
   # Windows
   netstat -ano | findstr :5001

   # Linux/Mac
   lsof -i :5001
   ```

2. Change port:
   ```bash
   export MODEL_SERVER_PORT=5002
   yarn run dev
   ```

3. Check dependencies are installed:
   ```bash
   cd platform/app
   yarn install
   ```

### Path Issues on Windows

**Problem:** File paths not working correctly.

**Solutions:**
1. Use forward slashes in code: `/models/server/brain.obj`
2. Server handles path conversion automatically
3. Check that `models/` directory is at project root

---

## Security Considerations

### Development

- Server allows all origins (CORS: `*`)
- No authentication required
- Suitable for local development only

### Production

Implement these security measures:

1. **Authentication**
   ```javascript
   // Add JWT or API key authentication
   app.use('/api/models/upload', authenticateUser);
   ```

2. **Rate Limiting**
   ```javascript
   const rateLimit = require('express-rate-limit');
   app.use('/api/models/upload', rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 10 // limit each IP to 10 uploads per windowMs
   }));
   ```

3. **File Validation**
   ```javascript
   // Validate OBJ file structure
   // Scan for malicious content
   // Limit file size
   ```

4. **Storage Limits**
   ```javascript
   // Implement per-user storage quotas
   // Auto-cleanup old files
   ```

---

## Advanced Usage

### Custom Model Server Location

If you want to run the model server separately:

```bash
# Terminal 1: Start model server
cd platform/app/server
node modelServer.js

# Terminal 2: Start OHIF
cd platform/app
yarn run dev:viewer  # Without model server
```

### Using with Docker

Create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  model-server:
    build: ./platform/app/server
    ports:
      - "5001:5001"
    volumes:
      - ./models:/app/models

  ohif-viewer:
    build: ./platform/app
    ports:
      - "3000:3000"
    environment:
      - MODEL_SERVER_URL=http://model-server:5001
    depends_on:
      - model-server
```

### Integration with Cloud Storage

Modify `modelServer.js` to use S3:

```javascript
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

app.post('/api/models/upload', upload.single('model'), async (req, res) => {
  // Upload to S3 instead of local disk
  await s3.upload({
    Bucket: 'your-models-bucket',
    Key: req.file.filename,
    Body: req.file.buffer
  }).promise();

  // Return S3 URL
  res.json({
    success: true,
    model: {
      url: `https://your-cdn.com/models/${req.file.filename}`
    }
  });
});
```

---

## Summary

You now have a complete 3D model serving solution:

✅ **Local directory serving** - Store default models
✅ **File uploads** - Users can upload their models
✅ **Browser security handled** - CORS and proxy configured
✅ **Easy integration** - Simple API methods
✅ **Production ready** - Scalable architecture

For questions or issues, check the troubleshooting section or consult the [OHIF documentation](https://docs.ohif.org).
