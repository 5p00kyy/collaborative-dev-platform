const express = require('express');
const { body, validationResult, query } = require('express-validator');

const { pool } = require('../../config/database');
const { authenticateToken, requireProjectRole } = require('../../middleware/auth');

const router = express.Router();

// ============================================
// Validation Rules
// ============================================

const createProjectValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Project name is required')
    .isLength({ max: 255 })
    .withMessage('Project name cannot exceed 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Description cannot exceed 5000 characters'),
  body('visibility')
    .optional()
    .isIn(['private', 'shared', 'public'])
    .withMessage('Visibility must be private, shared, or public'),
  body('status')
    .optional()
    .isIn(['active', 'archived', 'wip'])
    .withMessage('Status must be active, archived, or wip')
];

const updateProjectValidation = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Project name cannot be empty')
    .isLength({ max: 255 })
    .withMessage('Project name cannot exceed 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Description cannot exceed 5000 characters'),
  body('visibility')
    .optional()
    .isIn(['private', 'shared', 'public'])
    .withMessage('Visibility must be private, shared, or public'),
  body('status')
    .optional()
    .isIn(['active', 'archived', 'wip'])
    .withMessage('Status must be active, archived, or wip')
];

// ============================================
// List Projects
// ============================================

/**
 * Get all projects for the authenticated user
 * GET /api/projects?status=active&visibility=private&search=keyword&page=1&limit=10
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, visibility, search, page = 1, limit = 10 } = req.query;

    // Build dynamic query
    let query = `
      SELECT 
        p.project_id, 
        p.name, 
        p.description, 
        p.status, 
        p.visibility, 
        p.created_at, 
        p.updated_at,
        p.owner_id,
        u.username as owner_username,
        u.display_name as owner_display_name,
        (SELECT COUNT(*) FROM project_collaborators pc WHERE pc.project_id = p.project_id) as collaborator_count
      FROM projects p
      LEFT JOIN users u ON p.owner_id = u.user_id
      WHERE (p.owner_id = $1 OR p.project_id IN (
        SELECT project_id FROM project_collaborators 
        WHERE user_id = $1 AND accepted_at IS NOT NULL
      ))
    `;

    const queryParams = [userId];
    let paramIndex = 2;

    // Add filters
    if (status) {
      query += ` AND p.status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    if (visibility) {
      query += ` AND p.visibility = $${paramIndex}`;
      queryParams.push(visibility);
      paramIndex++;
    }

    if (search) {
      query += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM (${query}) as filtered_projects`;
    const countResult = await pool.query(countQuery, queryParams);
    const totalCount = parseInt(countResult.rows[0].count);

    // Add pagination
    const offset = (page - 1) * limit;
    query += ` ORDER BY p.updated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);

    res.json({
      success: true,
      data: {
        projects: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      }
    });

  } catch (error) {
    console.error('List projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve projects',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// Create Project
// ============================================

/**
 * Create a new project
 * POST /api/projects
 * Body: { name, description?, visibility?, status? }
 */
router.post('/', authenticateToken, createProjectValidation, async (req, res) => {
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
      name, 
      description = '', 
      visibility = 'private', 
      status = 'active',
      metadata = {}
    } = req.body;

    // Create project
    const result = await pool.query(
      `INSERT INTO projects (name, description, owner_id, visibility, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING project_id, name, description, owner_id, visibility, status, created_at, updated_at, metadata`,
      [name, description, userId, visibility, status, JSON.stringify(metadata)]
    );

    const project = result.rows[0];

    console.log(`Project created: ${project.name} (${project.project_id}) by user ${userId}`);

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: {
        project
      }
    });

  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create project',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// Get Single Project
// ============================================

/**
 * Get a single project by ID
 * GET /api/projects/:id
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT 
        p.*,
        u.username as owner_username,
        u.display_name as owner_display_name,
        u.avatar_url as owner_avatar_url,
        (
          SELECT json_agg(json_build_object(
            'userId', pc.user_id,
            'username', u2.username,
            'displayName', u2.display_name,
            'avatarUrl', u2.avatar_url,
            'role', pc.role,
            'invitedAt', pc.invited_at,
            'acceptedAt', pc.accepted_at
          ))
          FROM project_collaborators pc
          LEFT JOIN users u2 ON pc.user_id = u2.user_id
          WHERE pc.project_id = p.project_id
        ) as collaborators
      FROM projects p
      LEFT JOIN users u ON p.owner_id = u.user_id
      WHERE p.project_id = $1 
        AND (p.owner_id = $2 OR p.project_id IN (
          SELECT project_id FROM project_collaborators 
          WHERE user_id = $2 AND accepted_at IS NOT NULL
        ))`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    res.json({
      success: true,
      data: {
        project: result.rows[0]
      }
    });

  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve project',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// Update Project
// ============================================

/**
 * Update a project
 * PUT /api/projects/:id
 * Body: { name?, description?, visibility?, status?, metadata? }
 */
router.put('/:id', authenticateToken, requireProjectRole(['owner', 'editor']), updateProjectValidation, async (req, res) => {
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
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    // Build dynamic update query
    const allowedFields = ['name', 'description', 'visibility', 'status', 'metadata'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex}`);
        updateValues.push(field === 'metadata' ? JSON.stringify(req.body[field]) : req.body[field]);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    // Always update updated_at
    updateFields.push('updated_at = NOW()');

    updateValues.push(id);

    const result = await pool.query(
      `UPDATE projects 
       SET ${updateFields.join(', ')}
       WHERE project_id = $${paramIndex}
       RETURNING *`,
      updateValues
    );

    console.log(`Project updated: ${result.rows[0].name} (${id})`);

    res.json({
      success: true,
      message: 'Project updated successfully',
      data: {
        project: result.rows[0]
      }
    });

  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update project',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// Delete Project
// ============================================

/**
 * Delete a project (owner only)
 * DELETE /api/projects/:id
 */
router.delete('/:id', authenticateToken, requireProjectRole(['owner']), async (req, res) => {
  try {
    const { id } = req.params;

    // Delete project (cascade will handle related records)
    const result = await pool.query(
      'DELETE FROM projects WHERE project_id = $1 RETURNING name',
      [id]
    );

    console.log(`Project deleted: ${result.rows[0].name} (${id})`);

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });

  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete project',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
