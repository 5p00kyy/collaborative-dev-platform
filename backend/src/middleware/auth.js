const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

// ============================================
// Authentication Middleware
// ============================================

/**
 * Verify JWT token and attach user info to request
 * Usage: app.get('/protected', authenticateToken, (req, res) => {...})
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Optionally verify user still exists in database
    const result = await pool.query(
      'SELECT user_id, username, email, display_name FROM users WHERE user_id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      email: decoded.email,
      displayName: result.rows[0].display_name
    };

    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

// ============================================
// Optional Authentication Middleware
// ============================================

/**
 * Same as authenticateToken but doesn't fail if token is missing
 * Useful for routes that work differently for authenticated users
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without user info
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await pool.query(
      'SELECT user_id, username, email, display_name FROM users WHERE user_id = $1',
      [decoded.userId]
    );

    if (result.rows.length > 0) {
      req.user = {
        userId: decoded.userId,
        username: decoded.username,
        email: decoded.email,
        displayName: result.rows[0].display_name
      };
    }

    next();

  } catch (error) {
    // Silently continue without user info if token is invalid
    next();
  }
};

// ============================================
// Role-Based Authorization
// ============================================

/**
 * Check if user has required role for a project
 * Usage: app.get('/project/:id', authenticateToken, requireProjectRole(['owner', 'editor']), ...)
 */
const requireProjectRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      const projectId = req.params.projectId || req.params.id;
      const userId = req.user.userId;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          message: 'Project ID required'
        });
      }

      // Check user's role in the project
      const result = await pool.query(
        `SELECT role FROM project_collaborators 
         WHERE project_id = $1 AND user_id = $2 AND accepted_at IS NOT NULL`,
        [projectId, userId]
      );

      // Also check if user is the project owner
      const ownerCheck = await pool.query(
        'SELECT owner_id FROM projects WHERE project_id = $1',
        [projectId]
      );

      if (ownerCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      const isOwner = ownerCheck.rows[0].owner_id === userId;
      const userRole = result.rows.length > 0 ? result.rows[0].role : (isOwner ? 'owner' : null);

      if (!userRole || !allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions for this project'
        });
      }

      req.projectRole = userRole;
      next();

    } catch (error) {
      console.error('Authorization error:', error);
      res.status(500).json({
        success: false,
        message: 'Authorization check failed'
      });
    }
  };
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireProjectRole
};
