require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const setupSocketServer = require('./socket');
const apiRoutes = require('./routes/api');

const app = express();
const port = process.env.PORT || 4000;
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

// Middleware
app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    system: 'Real-Time Multi-Tenant Collaborative Kanban Server',
  });
});

// API Routes
app.use('/api', apiRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  res.status(err.status || 500).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred.',
  });
});

// Create HTTP and WebSocket Server
const httpServer = http.createServer(app);
const io = setupSocketServer(httpServer, clientUrl);

// Attach io instance to app for controller access
app.set('io', io);

// Start Server
if (require.main === module) {
  httpServer.listen(port, () => {
    console.log(`🚀 Kanban Multi-Tenant Server running on http://localhost:${port}`);
    console.log(`📡 WebSocket server initialized with tenant-scoped presence channels`);
  });
}

module.exports = { app, httpServer, io };
