# Sample Server Examples

This directory contains example server implementations for the DICOM Server Upload extension.

## Quick Start

### Install Dependencies

```bash
npm install
```

### Run the Server

```bash
npm start
```

Or with auto-reload:

```bash
npm run dev
```

The server will start on `http://localhost:8080`

## Testing the Server

### 1. Health Check

```bash
curl http://localhost:8080/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-12-23T...",
  "uptime": 123.45,
  "sessions": 0
}
```

### 2. Upload Files

```bash
curl -X POST \
  -F "files=@/path/to/file.dcm" \
  http://localhost:8080/upload
```

Expected response:
```json
{
  "success": true,
  "message": "Successfully uploaded 1 file(s)",
  "data": {
    "sessionId": "session-1234567890-abcdef",
    "processedFiles": 1,
    "totalSize": 1048576,
    "files": [...]
  }
}
```

### 3. Check Processing Status

```bash
curl http://localhost:8080/status/session-1234567890-abcdef
```

### 4. Get Results

```bash
curl http://localhost:8080/results/session-1234567890-abcdef
```

### 5. Download Processed File

```bash
curl -O http://localhost:8080/download/session-1234567890-abcdef
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload` | Upload DICOM files |
| GET | `/status/:sessionId` | Check processing status |
| GET | `/results/:sessionId` | Get processing results |
| GET | `/download/:sessionId` | Download processed file |
| GET | `/sessions` | List all sessions |
| DELETE | `/sessions/:sessionId` | Delete session |
| GET | `/health` | Health check |

## Configuration

### Change Port

```bash
PORT=9000 npm start
```

### File Size Limit

Edit `sample-server.js`:

```javascript
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB
  },
});
```

### Upload Directory

By default, files are saved to `./uploads`. To change:

```javascript
const uploadDir = path.join(__dirname, 'your-directory');
```

## CORS Configuration

The server allows CORS from:
- `http://localhost:3000` (default OHIF)
- `http://localhost:3001`

To add more origins:

```javascript
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://your-domain.com', // Add your domain
  ],
}));
```

## Using with OHIF

1. Start this server: `npm start`
2. Start OHIF viewer: `cd platform/app && yarn dev`
3. In OHIF, open the DICOM Upload panel
4. Set server URL to: `http://localhost:8080/upload`
5. Select and upload DICOM files

## Production Considerations

This is a **development/example server**. For production:

1. **Security**:
   - Add authentication (JWT, API keys)
   - Validate file contents (not just extension)
   - Add rate limiting
   - Use HTTPS

2. **Storage**:
   - Use cloud storage (S3, Azure Blob)
   - Implement file cleanup
   - Add database for session tracking

3. **Processing**:
   - Use job queues (Bull, RabbitMQ)
   - Implement real DICOM processing
   - Add error recovery

4. **Monitoring**:
   - Add logging (Winston, Bunyan)
   - Add metrics (Prometheus)
   - Add error tracking (Sentry)

## Extending the Server

### Add Custom Processing

```javascript
app.post('/upload', upload.array('files', 50), async (req, res) => {
  // Your custom DICOM processing logic
  const processedData = await processDicomFiles(req.files);
  
  res.json({
    success: true,
    data: processedData,
  });
});
```

### Add Database Integration

```javascript
const { Pool } = require('pg');
const pool = new Pool({ /* config */ });

app.post('/upload', upload.array('files', 50), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Store session in database
    await client.query(
      'INSERT INTO upload_sessions(session_id, files) VALUES($1, $2)',
      [sessionId, JSON.stringify(uploadInfo.files)]
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  // ...
});
```

### Add Authentication

```javascript
const jwt = require('jsonwebtoken');

// Middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

app.post('/upload', authenticate, upload.array('files'), (req, res) => {
  // Upload logic with authenticated user
  console.log('User:', req.user);
  // ...
});
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 8080
lsof -ti:8080 | xargs kill -9

# Or use a different port
PORT=9000 npm start
```

### CORS Errors

Check that your OHIF origin is in the CORS whitelist:

```javascript
app.use(cors({
  origin: ['http://localhost:3000'], // Add your OHIF URL
}));
```

### Files Not Uploading

1. Check upload directory exists and is writable
2. Verify file size is under limit
3. Check server logs for errors
4. Test with curl first

## Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [Multer Documentation](https://github.com/expressjs/multer)
- [CORS Documentation](https://github.com/expressjs/cors)

