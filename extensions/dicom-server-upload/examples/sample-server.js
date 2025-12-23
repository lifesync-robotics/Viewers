/**
 * Sample Express.js server for DICOM file upload
 * 
 * This is a basic example server that accepts DICOM file uploads
 * and demonstrates the expected API contract.
 * 
 * Prerequisites:
 * npm install express multer cors body-parser
 * 
 * Usage:
 * node sample-server.js
 */

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

// Configure CORS to allow requests from OHIF viewer
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'], // OHIF dev server
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.dcm';
    cb(null, `dicom-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept DICOM files
    const allowedMimes = ['application/dicom', 'application/octet-stream'];
    const allowedExts = ['.dcm', '.dicom', ''];
    
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeOk = allowedMimes.includes(file.mimetype);
    const extOk = allowedExts.includes(ext);
    
    if (mimeOk || extOk) {
      cb(null, true);
    } else {
      cb(new Error('Only DICOM files are allowed'));
    }
  },
});

// Store upload sessions for progress tracking
const uploadSessions = new Map();

/**
 * Main upload endpoint
 * Accepts multipart/form-data with DICOM files
 */
app.post('/upload', upload.array('files', 50), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded',
      });
    }

    console.log(`✅ Received ${req.files.length} file(s)`);
    
    // Generate session ID
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Store upload info
    const uploadInfo = {
      sessionId,
      files: req.files.map(f => ({
        filename: f.filename,
        originalname: f.originalname,
        size: f.size,
        path: f.path,
      })),
      uploadedAt: new Date().toISOString(),
      status: 'uploaded',
    };
    
    uploadSessions.set(sessionId, uploadInfo);
    
    // Log file details
    req.files.forEach((file, index) => {
      console.log(`  [${index + 1}] ${file.originalname} (${formatBytes(file.size)})`);
    });
    
    // Respond with success
    res.json({
      success: true,
      message: `Successfully uploaded ${req.files.length} file(s)`,
      data: {
        sessionId,
        processedFiles: req.files.length,
        totalSize: req.files.reduce((sum, f) => sum + f.size, 0),
        files: uploadInfo.files.map(f => ({
          filename: f.filename,
          originalname: f.originalname,
          size: f.size,
        })),
      },
    });
    
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Upload failed',
    });
  }
});

/**
 * Get upload session status
 * Used for tracking processing progress
 */
app.get('/status/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  const session = uploadSessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found',
    });
  }
  
  // Simulate processing progress
  const progress = Math.min(100, Math.floor(Math.random() * 100));
  
  res.json({
    success: true,
    data: {
      sessionId,
      status: progress < 100 ? 'processing' : 'completed',
      progress,
      filesProcessed: session.files.length,
    },
  });
});

/**
 * Get processed results
 * Downloads processed DICOM or results file
 */
app.get('/results/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  const session = uploadSessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found',
    });
  }
  
  // In a real implementation, return processed file
  res.json({
    success: true,
    data: {
      sessionId,
      results: {
        message: 'Processing completed',
        outputFiles: session.files.map(f => f.filename),
        downloadUrl: `/download/${sessionId}`,
      },
    },
  });
});

/**
 * Download processed file
 */
app.get('/download/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  const session = uploadSessions.get(sessionId);
  
  if (!session || !session.files[0]) {
    return res.status(404).json({
      success: false,
      message: 'No files found for this session',
    });
  }
  
  const file = session.files[0];
  
  if (fs.existsSync(file.path)) {
    res.download(file.path, file.originalname);
  } else {
    res.status(404).json({
      success: false,
      message: 'File not found on server',
    });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    sessions: uploadSessions.size,
  });
});

/**
 * List all upload sessions (debug)
 */
app.get('/sessions', (req, res) => {
  const sessions = Array.from(uploadSessions.entries()).map(([id, info]) => ({
    sessionId: id,
    fileCount: info.files.length,
    uploadedAt: info.uploadedAt,
    status: info.status,
  }));
  
  res.json({
    success: true,
    count: sessions.length,
    sessions,
  });
});

/**
 * Delete session (cleanup)
 */
app.delete('/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  const session = uploadSessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found',
    });
  }
  
  // Delete files
  session.files.forEach(file => {
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
      console.log(`🗑️  Deleted: ${file.filename}`);
    }
  });
  
  uploadSessions.delete(sessionId);
  
  res.json({
    success: true,
    message: 'Session deleted',
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large (max 100MB)',
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`,
    });
  }
  
  res.status(500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
  });
});

// Utility function
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Start server
app.listen(PORT, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 DICOM Upload Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`📤 Upload endpoint:   http://localhost:${PORT}/upload`);
  console.log(`❤️  Health check:     http://localhost:${PORT}/health`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n✅ Ready to accept DICOM file uploads!');
  console.log('\n📝 Available endpoints:');
  console.log('   POST   /upload              - Upload DICOM files');
  console.log('   GET    /status/:sessionId   - Check processing status');
  console.log('   GET    /results/:sessionId  - Get processed results');
  console.log('   GET    /download/:sessionId - Download processed file');
  console.log('   GET    /sessions            - List all sessions');
  console.log('   DELETE /sessions/:sessionId - Delete session');
  console.log('   GET    /health              - Health check');
  console.log('\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});

