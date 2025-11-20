const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// ============================================
// WebSocket Configuration
// ============================================

let io = null;

/**
 * Initialize WebSocket server
 */
function initializeWebSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
      credentials: true
    }
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`WebSocket: User ${socket.username} connected (${socket.id})`);

    // Join user-specific room
    socket.join(`user:${socket.userId}`);

    // Join project rooms
    socket.on('join-project', (projectId) => {
      socket.join(`project:${projectId}`);
      console.log(`User ${socket.username} joined project ${projectId}`);
    });

    // Leave project rooms
    socket.on('leave-project', (projectId) => {
      socket.leave(`project:${projectId}`);
      console.log(`User ${socket.username} left project ${projectId}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`WebSocket: User ${socket.username} disconnected`);
    });
  });

  console.log('✓ WebSocket server initialized');
  return io;
}

/**
 * Get WebSocket instance
 */
function getIO() {
  if (!io) {
    throw new Error('WebSocket not initialized');
  }
  return io;
}

/**
 * Emit event to specific project
 */
function emitToProject(projectId, event, data) {
  if (io) {
    io.to(`project:${projectId}`).emit(event, data);
  }
}

/**
 * Emit event to specific user
 */
function emitToUser(userId, event, data) {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

/**
 * Emit event to all connected clients
 */
function emitToAll(event, data) {
  if (io) {
    io.emit(event, data);
  }
}

module.exports = {
  initializeWebSocket,
  getIO,
  emitToProject,
  emitToUser,
  emitToAll
};
