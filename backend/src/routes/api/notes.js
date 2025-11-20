const express = require('express');
const { body, validationResult } = require('express-validator');

const { pool } = require('../../config/database');
const { authenticateToken } = require('../../middleware/auth');

const router = express.Router();

// ============================================
// Validation Rules
// ============================================

const createNoteValidation = [
  body('projectId')
    .notEmpty()
    .withMessage('Project ID is required')
    .isUUID()
    .withMessage('Invalid project ID'),
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 500 })
    .withMessage('Title cannot exceed 500 characters'),
  body('content')
    .optional()
    .isLength({ max: 100000 })
    .withMessage('Content cannot exceed 100000 characters'),
  body('contentFormat')
    .optional()
    .isIn(['markdown', 'html', 'plain'])
    .withMessage('Content format must be markdown, html, or plain'),
  body('parentNoteId')
    .optional()
    .isUUID()
    .withMessage('Invalid parent note ID')
];

const updateNoteValidation = [
  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Title cannot be empty')
    .isLength({ max: 500 })
    .withMessage('Title cannot exceed 500 characters'),
  body('content')
    .optional()
    .isLength({ max: 100000 })
    .withMessage('Content cannot exceed 100000 characters'),
  body('contentFormat')
    .optional()
    .isIn(['markdown', 'html', 'plain'])
    .withMessage('Content format must be markdown, html, or plain'),
  body('parentNoteId')
    .optional()
    .custom((value) => value === null || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
    .withMessage('Invalid parent note ID')
];

// ============================================
// List Notes
// ============================================

/**
 * Get all notes for a project
 * GET /api/notes?projectId=xxx&parentNoteId=xxx&search=keyword&tags=tag1,tag2&page=1&limit=50
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { 
      projectId, 
      parentNoteId,
      search, 
      tags,
      page = 1, 
      limit = 50 
    } = req.query;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required'
      });
    }

    // Verify user has access to project
    const accessCheck = await pool.query(
      `SELECT project_id FROM projects 
       WHERE project_id = $1 AND (owner_id = $2 OR project_id IN (
         SELECT project_id FROM project_collaborators 
         WHERE user_id = $2 AND accepted_at IS NOT NULL
       ))`,
      [projectId, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this project'
      });
    }

    // Build query
    let query = `
      SELECT 
        n.*,
        u.username as author_username,
        u.display_name as author_display_name,
        (SELECT COUNT(*) FROM notes WHERE parent_note_id = n.note_id) as child_count
      FROM notes n
      LEFT JOIN users u ON n.author_id = u.user_id
      WHERE n.project_id = $1
    `;

    const queryParams = [projectId];
    let paramIndex = 2;

    // Filter by parent note (or top-level notes)
    if (parentNoteId !== undefined) {
      if (parentNoteId === '' || parentNoteId === 'null') {
        query += ` AND n.parent_note_id IS NULL`;
      } else {
        query += ` AND n.parent_note_id = $${paramIndex}`;
        queryParams.push(parentNoteId);
        paramIndex++;
      }
    }

    // Search in title and content
    if (search) {
      query += ` AND (n.title ILIKE $${paramIndex} OR n.content ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Filter by tags
    if (tags) {
      const tagArray = tags.split(',').map(t => t.trim());
      query += ` AND n.tags && $${paramIndex}`;
      queryParams.push(tagArray);
      paramIndex++;
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM (${query}) as filtered_notes`;
    const countResult = await pool.query(countQuery, queryParams);
    const totalCount = parseInt(countResult.rows[0].count);

    // Add pagination and sorting
    const offset = (page - 1) * limit;
    query += ` ORDER BY n.updated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);

    res.json({
      success: true,
      data: {
        notes: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      }
    });

  } catch (error) {
    console.error('List notes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve notes',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// Create Note
// ============================================

/**
 * Create a new note
 * POST /api/notes
 * Body: { projectId, title, content?, contentFormat?, parentNoteId?, tags? }
 */
router.post('/', authenticateToken, createNoteValidation, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user.userId;
    const {
      projectId,
      title,
      content = '',
      contentFormat = 'markdown',
      parentNoteId = null,
      tags = [],
      metadata = {}
    } = req.body;

    // Verify user has access to project
    const accessCheck = await pool.query(
      `SELECT project_id FROM projects 
       WHERE project_id = $1 AND (owner_id = $2 OR project_id IN (
         SELECT project_id FROM project_collaborators 
         WHERE user_id = $2 AND accepted_at IS NOT NULL
       ))`,
      [projectId, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this project'
      });
    }

    // If parent note specified, verify it exists and belongs to same project
    if (parentNoteId) {
      const parentCheck = await pool.query(
        'SELECT note_id FROM notes WHERE note_id = $1 AND project_id = $2',
        [parentNoteId, projectId]
      );

      if (parentCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Parent note not found or belongs to different project'
        });
      }
    }

    // Build path for hierarchical navigation
    let path = '/';
    if (parentNoteId) {
      const parentPath = await pool.query(
        'SELECT path FROM notes WHERE note_id = $1',
        [parentNoteId]
      );
      if (parentPath.rows.length > 0) {
        path = `${parentPath.rows[0].path}${parentNoteId}/`;
      }
    }

    // Create note
    const result = await pool.query(
      `INSERT INTO notes (
        project_id, title, content, content_format, author_id, 
        parent_note_id, path, tags, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [projectId, title, content, contentFormat, userId, parentNoteId, path, tags, JSON.stringify(metadata)]
    );

    const note = result.rows[0];

    console.log(`Note created: ${note.title} (${note.note_id}) in project ${projectId}`);

    res.status(201).json({
      success: true,
      message: 'Note created successfully',
      data: { note }
    });

  } catch (error) {
    console.error('Create note error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create note',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// Get Single Note
// ============================================

/**
 * Get a note by ID
 * GET /api/notes/:id
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT 
        n.*,
        u.username as author_username,
        u.display_name as author_display_name,
        u.avatar_url as author_avatar_url,
        p.name as project_name,
        (SELECT COUNT(*) FROM notes WHERE parent_note_id = n.note_id) as child_count
      FROM notes n
      LEFT JOIN users u ON n.author_id = u.user_id
      LEFT JOIN projects p ON n.project_id = p.project_id
      WHERE n.note_id = $1 
        AND (p.owner_id = $2 OR p.project_id IN (
          SELECT project_id FROM project_collaborators 
          WHERE user_id = $2 AND accepted_at IS NOT NULL
        ))`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Note not found or access denied'
      });
    }

    // Get child notes if any
    const children = await pool.query(
      `SELECT note_id, title, updated_at FROM notes WHERE parent_note_id = $1 ORDER BY title`,
      [id]
    );

    res.json({
      success: true,
      data: {
        note: result.rows[0],
        children: children.rows
      }
    });

  } catch (error) {
    console.error('Get note error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve note',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// Update Note
// ============================================

/**
 * Update a note
 * PUT /api/notes/:id
 * Body: { title?, content?, contentFormat?, parentNoteId?, tags? }
 */
router.put('/:id', authenticateToken, updateNoteValidation, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const userId = req.user.userId;

    // Get current note
    const noteCheck = await pool.query(
      `SELECT n.*, p.owner_id 
       FROM notes n
       LEFT JOIN projects p ON n.project_id = p.project_id
       WHERE n.note_id = $1`,
      [id]
    );

    if (noteCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    const currentNote = noteCheck.rows[0];

    // Verify user has edit access (owner, author, or editor)
    const isOwner = currentNote.owner_id === userId;
    const isAuthor = currentNote.author_id === userId;

    if (!isOwner && !isAuthor) {
      const editorCheck = await pool.query(
        `SELECT role FROM project_collaborators 
         WHERE project_id = $1 AND user_id = $2 AND role = 'editor' AND accepted_at IS NOT NULL`,
        [currentNote.project_id, userId]
      );

      if (editorCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to update this note'
        });
      }
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    const allowedFields = ['title', 'content', 'content_format', 'parent_note_id', 'tags', 'metadata'];
    
    Object.keys(req.body).forEach(key => {
      const dbField = key === 'contentFormat' ? 'content_format' : key === 'parentNoteId' ? 'parent_note_id' : key;
      
      if (allowedFields.includes(dbField) && req.body[key] !== undefined) {
        updateFields.push(`${dbField} = $${paramIndex}`);
        const value = (dbField === 'metadata') ? JSON.stringify(req.body[key]) : 
                      (dbField === 'tags' && Array.isArray(req.body[key])) ? req.body[key] : 
                      req.body[key];
        updateValues.push(value);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    // Always increment version and update timestamp
    updateFields.push(`version = version + 1`);
    updateFields.push('updated_at = NOW()');
    updateValues.push(id);

    const result = await pool.query(
      `UPDATE notes 
       SET ${updateFields.join(', ')}
       WHERE note_id = $${paramIndex}
       RETURNING *`,
      updateValues
    );

    console.log(`Note updated: ${id}`);

    res.json({
      success: true,
      message: 'Note updated successfully',
      data: { note: result.rows[0] }
    });

  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update note',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// Delete Note
// ============================================

/**
 * Delete a note (owner/author/editor only)
 * DELETE /api/notes/:id
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Get note and verify permissions
    const noteCheck = await pool.query(
      `SELECT n.*, p.owner_id 
       FROM notes n
       LEFT JOIN projects p ON n.project_id = p.project_id
       WHERE n.note_id = $1`,
      [id]
    );

    if (noteCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    const note = noteCheck.rows[0];
    const isOwner = note.owner_id === userId;
    const isAuthor = note.author_id === userId;

    if (!isOwner && !isAuthor) {
      const editorCheck = await pool.query(
        `SELECT role FROM project_collaborators 
         WHERE project_id = $1 AND user_id = $2 AND role = 'editor' AND accepted_at IS NOT NULL`,
        [note.project_id, userId]
      );

      if (editorCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to delete this note'
        });
      }
    }

    // Delete note (cascade will handle child notes)
    await pool.query('DELETE FROM notes WHERE note_id = $1', [id]);

    console.log(`Note deleted: ${id}`);

    res.json({
      success: true,
      message: 'Note deleted successfully'
    });

  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete note',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
