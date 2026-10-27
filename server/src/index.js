const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getDb } = require('./db/connection');
const { connectMongo, getMongoStatus } = require('./db/mongoConnection');

// Import routes
const authRoutes = require('./routes/authRoutes');
const assetRoutes = require('./routes/assetRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const statsRoutes = require('./routes/statsRoutes');

const app = express();
const PORT = process.env.PORT || 5001;

// Middlewares
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[${req.method}] ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const mongoStatus = getMongoStatus();
  res.json({
    status: 'healthy',
    product: 'GearFlow Enterprise Asset Lending Platform',
    databaseEngine: mongoStatus.isConnected ? 'MongoDB (Mongoose)' : 'SQLite (better-sqlite3)',
    mongoConnected: mongoStatus.isConnected,
    timestamp: new Date().toISOString()
  });
});

// Mount modular API routes
app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/stats', statsRoutes);

// Serve static client assets in production
const clientDistPath = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  // SPA fallback for client routing
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(clientDistPath, 'index.html'));
    }
    next();
  });
}

// Global 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ error: `Endpoint not found: ${req.method} ${req.originalUrl}` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  res.status(500).json({
    error: 'Internal server error occurred',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Initialize database engines
async function startServer() {
  if (process.env.MONGODB_URI && process.env.MONGODB_URI.trim()) {
    console.log('📡 MONGODB_URI detected. Initializing MongoDB connection...');
    await connectMongo(process.env.MONGODB_URI);
  }
  getDb();

  if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
      console.log(`🚀 GearFlow API Server active on http://localhost:${PORT}`);
      const mongoStatus = getMongoStatus();
      console.log(`💾 Active Database Engine: ${mongoStatus.isConnected ? 'MongoDB (Atlas/Mongoose)' : 'SQLite WAL (local)'}`);
      console.log(`📡 Ready for reservations, custody workflows, and quarantine management.`);
    });
  }
}

startServer();

module.exports = app;
