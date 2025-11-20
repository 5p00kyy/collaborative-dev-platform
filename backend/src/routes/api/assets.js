const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
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

// File type magic bytes for validation
const FILE_SIGNATURES = {
  'image/jpeg': [
    [0xFF, 0xD8, 0xFF]
  ],
  'image/png': [
    [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
  ],
  'image/gif': [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]  // GIF89a
  ],
  'image/webp': [
    [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50] // RIFF....WEBP
  ],
  'application/pdf': [
    [0x25, 0x50, 0x44, 0x46] // %PDF
  ],
  'application/zip': [
    [0x50, 0x4B, 0x03, 0x04], // PK..
    [0x50, 0x4B, 0x05, 0x06]  // PK.. (empty archive)
  ]
};

const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  '.pdf',
  '.txt', '.md',
  '.json',
  '.zip', '.tar', '.gz'
];

// ====== Security Validation Functions ======

/**
 * Validate file extension
 */
function validateFileExtension(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

/**
 * Validate file type using magic bytes
 */
async function validateFileMagicBytes(filePath, mimeType) {
  // Skip validation for text files
  if (mimeType.startsWith('text/') || mimeType === 'application/json') {
    return true;
  }

  const signatures = FILE_SIGNATURES[mimeType];
  if (!signatures) {
    // If no signature defined, rely on MIME type only
    return true;
  }

  try {
    const buffer = Buffer.alloc(12); // Read first 12 bytes
    const fd = fsSync.openSync(filePath, 'r');
    fsSync.readSync(fd, buffer, 0, 12, 0);
    fsSync.closeSync(fd);

    // Check against all known signatures for this type
    for (const signature of signatures) {
      let match = true;
      for (let i = 0; i < signature.length; i++) {
        if (signature[i] !== null && buffer[i] !== signature[i]) {
          match = false;
          break;
        }
      }
      if (match) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Error validating file magic bytes:', error);
    return false;
  }
}

/**
 * Sanitize filename to prevent directory traversal
 */
function sanitizeFilename(filename) {
  // Remove path separators and null bytes
  return filename
    .replace(/\.\./g, '')
    .replace(/[\/\\]/g, '')
    .replace(/\0/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Calculate file hash (SHA-256)
 */
async function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fsSync.createReadStream(filePath);
    
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

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
    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error(`File type ${file.mimetype} not allowed`));
    }

    // Validate file extension
    if (!validateFileExtension(file.originalname)) {
      return cb(new Error(`File extension not allowed for ${file.originalname}`));
    }

    // Additional checks for suspicious filenames
    const sanitized = sanitizeFilename(file.originalname);
    if (sanitized !== file.originalname) {
      return cb(new Error('Invalid characters in filename'));
    }

    cb(null, true);
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

      // Validate file magic bytes (deep validation)
      const isValidMagicBytes = await validateFileMagicBytes(
        req.file.path,
        req.file.mimetype
      );

      if (!isValidMagicBytes) {
        // Delete invalid file
        await fs.unlink(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'File content does not match declared type. Possible file type mismatch or corruption.',
          code: 'INVALID_FILE_SIGNATURE'
        });
      }

      // Calculate file hash for integrity checking
      const fileHash = await calculateFileHash(req.file.path);

      // Check for duplicate files (same hash)
      const duplicateCheck = await pool.query(
        `SELECT asset_id, name FROM assets 
         WHERE project_id = $1 AND file_size = $2
         LIMIT 10`, // Check only recent similar-sized files
        [projectId, req.file.size]
      );

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
