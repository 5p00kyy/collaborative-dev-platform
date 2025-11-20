const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { body, validationResult, param } = require('express-validator');

const { pool } = require('../../config/database');
const { authenticateToken, requireProjectRole } = require('../../middleware/auth');

const router = express.Router();

// ============================================
// Configuration
// ============================================

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../../uploads');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024; // 100MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/json',
  'application/zip',
  'application/x-tar',
  'application/gzip'
];

// Ensure upload directory exists
(async () => {
  try {
    await fs.access(UPLOAD_DIR);
  } catch (error) {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
})();

// ============================================
// Multer Configuration
// ============================================

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const projectId = req.params.projectId;
    const projectDir = path.join(UPLOAD_DIR, projectId);
    
    try {
      await fs.access(projectDir);
    } catch (error) {
      await fs.mkdir(projectDir, { recursive: true });
    }
    
    cb(null, projectDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    const sanitized = basename.replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${sanitized}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  }
});

// ============================================
// Validation Rules
// ============================================

const uploadAssetValidation = [
  param('projectId')
    .isUUID()
    .withMessage('Invalid project ID'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
];

// ============================================
// Upload Asset
// ============================================

/**
 * Upload a file to a project
 * POST /api/assets/:projectId/upload
 */
router.post(
  '/:projectId/upload',
  authenticateToken,
  requireProjectRole(['owner', 'editor']),
  upload.single('file'),
  uploadAssetValidation,
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Clean up uploaded file if validation fails
        if (req.file) {
          await fs.unlink(req.file.path);
        }
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file provided'
        });
      }

      const { projectId } = req.params;
      const { description } = req.body;
      const tags = req.body.tags ? JSON.parse(req.body.tags) : [];

      // Store asset metadata in database
      const result = await pool.query(
        `INSERT INTO assets 
         (project_id, name, description, file_type, file_size, storage_path, uploaded_by, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING 
           asset_id, name, description, file_type, file_size, 
           storage_path, uploaded_by, created_at, tags`,
        [
          projectId,
          req.file.originalname,
          description || null,
          req.file.mimetype,
          req.file.size,
          req.file.path,
          req.user.userId,
          tags
        ]
      );

      const asset = result.rows[0];

      console.log(`Asset uploaded: ${asset.name} (${asset.asset_id}) by ${req.user.username}`);

      res.status(201).json({
        success: true,
        message: 'Asset uploaded successfully',
        data: {
          assetId: asset.asset_id,
          name: asset.name,
          description: asset.description,
          fileType: asset.file_type,
          fileSize: asset.file_size,
          uploadedBy: asset.uploaded_by,
          createdAt: asset.created_at,
          tags: asset.tags
        }
      });

    } catch (error) {
      // Clean up uploaded file on error
      if (req.file) {
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError) {
          console.error('Failed to delete file after error:', unlinkError);
        }
      }

      console.error('Asset upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload asset',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// ============================================
// List Assets
// ============================================

/**
 * Get all assets for a project
 * GET /api/assets/:projectId?page=1&limit=20&fileType=image/jpeg
 */
router.get('/:projectId', authenticateToken, requireProjectRole(['owner', 'editor', 'viewer']), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { page = 1, limit = 20, fileType, search } = req.query;

    // Build query
    let query = `
      SELECT 
        a.asset_id, 
        a.name, 
        a.description, 
        a.file_type, 
        a.file_size, 
        a.created_at,
        a.tags,
        u.username as uploaded_by_username,
        u.display_name as uploaded_by_display_name
      FROM assets a
      LEFT JOIN users u ON a.uploaded_by = u.user_id
      WHERE a.project_id = $1
    `;

    const queryParams = [projectId];
    let paramIndex = 2;

    // Add filters
    if (fileType) {
      query += ` AND a.file_type = $${paramIndex}`;
      queryParams.push(fileType);
      paramIndex++;
    }

    if (search) {
      query += ` AND (a.name ILIKE $${paramIndex} OR a.description ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Add pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ` ORDER BY a.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(parseInt(limit), offset);

    // Execute query
    const result = await pool.query(query, queryParams);

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM assets WHERE project_id = $1',
      [projectId]
    );

    res.json({
      success: true,
      data: {
        assets: result.rows.map(asset => ({
          assetId: asset.asset_id,
          name: asset.name,
          description: asset.description,
          fileType: asset.file_type,
          fileSize: asset.file_size,
          createdAt: asset.created_at,
          tags: asset.tags,
          uploadedBy: {
            username: asset.uploaded_by_username,
            displayName: asset.uploaded_by_display_name
          }
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].count),
          totalPages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('List assets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve assets',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// Download Asset
// ============================================

/**
 * Download an asset
 * GET /api/assets/:projectId/:assetId/download
 */
router.get(
  '/:projectId/:assetId/download',
  authenticateToken,
  requireProjectRole(['owner', 'editor', 'viewer']),
  async (req, res) => {
    try {
      const { projectId, assetId } = req.params;

      // Get asset metadata
      const result = await pool.query(
        `SELECT name, storage_path, file_type 
         FROM assets 
         WHERE asset_id = $1 AND project_id = $2`,
        [assetId, projectId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Asset not found'
        });
      }

      const asset = result.rows[0];

      // Check if file exists
      try {
        await fs.access(asset.storage_path);
      } catch (error) {
        return res.status(404).json({
          success: false,
          message: 'Asset file not found on disk'
        });
      }

      // Set headers and stream file
      res.setHeader('Content-Type', asset.file_type);
      res.setHeader('Content-Disposition', `attachment; filename="${asset.name}"`);
      res.sendFile(asset.storage_path);

    } catch (error) {
      console.error('Download asset error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to download asset',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// ============================================
// Delete Asset
// ============================================

/**
 * Delete an asset
 * DELETE /api/assets/:projectId/:assetId
 */
router.delete(
  '/:projectId/:assetId',
  authenticateToken,
  requireProjectRole(['owner', 'editor']),
  async (req, res) => {
    try {
      const { projectId, assetId } = req.params;

      // Get asset to delete file from disk
      const result = await pool.query(
        `SELECT storage_path FROM assets 
         WHERE asset_id = $1 AND project_id = $2`,
        [assetId, projectId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Asset not found'
        });
      }

      const storagePath = result.rows[0].storage_path;

      // Delete from database
      await pool.query(
        'DELETE FROM assets WHERE asset_id = $1',
        [assetId]
      );

      // Delete file from disk
      try {
        await fs.unlink(storagePath);
      } catch (error) {
        console.error('Failed to delete file from disk:', error);
        // Continue even if file deletion fails
      }

      console.log(`Asset deleted: ${assetId} by ${req.user.username}`);

      res.json({
        success: true,
        message: 'Asset deleted successfully'
      });

    } catch (error) {
      console.error('Delete asset error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete asset',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

module.exports = router;
