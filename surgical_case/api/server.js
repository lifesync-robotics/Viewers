#!/usr/bin/env node

/**
 * Simple Express Server for OHIF Surgical Case CSV Storage
 *
 * This server provides an API endpoint to save measurement CSV files
 * to the surgical_case directory structure.
 *
 * Usage:
 *   node surgical_case/api/server.js
 *
 * Or with environment variables:
 *   OHIF_WORKSPACE_ROOT=/path/to/Viewers PORT=3001 node surgical_case/api/server.js
 */

const express = require('express');
const path = require('path');
const {
  saveMeasurementCSVRoute,
  listMeasurementCSV,
  getMeasurementCSV
} = require('./saveMeasurementCSV');

const app = express();
const PORT = process.env.PORT || 3001;
const WORKSPACE_ROOT = process.env.OHIF_WORKSPACE_ROOT || path.join(__dirname, '..', '..');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration (adjust as needed for your setup)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    workspaceRoot: WORKSPACE_ROOT,
    surgicalCaseDir: path.join(WORKSPACE_ROOT, 'surgical_case'),
  });
});

// Surgical case CSV endpoints
app.post('/api/surgical-cases/save-csv', saveMeasurementCSVRoute);
app.get('/api/surgical-cases/list-csv', listMeasurementCSV);
app.get('/api/surgical-cases/get-csv', getMeasurementCSV);

// Start server
app.listen(PORT, () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🚀 OHIF Surgical Case CSV Storage Server');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`📁 Workspace root: ${WORKSPACE_ROOT}`);
  console.log(`💾 Surgical case dir: ${path.join(WORKSPACE_ROOT, 'surgical_case')}`);
  console.log(`📋 CSV endpoint: POST http://localhost:${PORT}/api/surgical-cases/save-csv`);
  console.log('═══════════════════════════════════════════════════════');
});

// Handle errors
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

module.exports = app;
