const express = require('express');
const { body, validationResult } = require('express-validator');

const { pool } = require('../../config/database');
const { authenticateToken, requireProjectRole } = require('../../middleware/auth');

const router = express.Router();

// ============================================
// Validation Rules
// ============================================

const createTicketValidation = [
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
  body('description')
    .optional()
    .trim()
    .isLength({ max: 10000 })
    .withMessage('Description cannot exceed 10000 characters'),
  body('type')
    .optional()
    .isIn(['bug', 'feature', 'task', 'idea'])
    .withMessage('Type must be bug, feature, task, or idea'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Priority must be low, medium, high, or critical'),
  body('assignedTo')
    .optional()
    .isUUID()
    .withMessage('Invalid user ID for assignment')
];

const updateTicketValidation = [
  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Title cannot be empty')
    .isLength({ max: 500 })
    .withMessage('Title cannot exceed 500 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 10000 })
    .withMessage('Description cannot exceed 10000 characters'),
  body('type')
    .optional()
    .isIn(['bug', 'feature', 'task', 'idea'])
    .withMessage('Type must be bug, feature, task, or idea'),
  body('status')
    .optional()
    .isIn(['open', 'in_progress', 'review', 'closed'])
    .withMessage('Status must be open, in_progress, review, or closed'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Priority must be low, medium, high, or critical'),
  body('assignedTo')
    .optional()
    .custom((value) => value === null || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
    .withMessage('Invalid user ID for assignment')
];

const addCommentValidation = [
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Comment content is required')
    .isLength({ max: 5000 })
    .withMessage('Comment cannot exceed 5000 characters')
];

// ============================================
// List Tickets
// ============================================

/**
 * Get all tickets for a project
 * GET /api/tickets?projectId=xxx&status=open&priority=high&assignedTo=userId&search=keyword&page=1&limit=20
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { 
      projectId, 
      status, 
      priority, 
      type,
      assignedTo, 
      search, 
      page = 1, 
      limit = 20 
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
        t.*,
        u1.username as creator_username,
        u1.display_name as creator_display_name,
        u2.username as assignee_username,
        u2.display_name as assignee_display_name,
        (SELECT COUNT(*) FROM ticket_activities WHERE ticket_id = t.ticket_id AND activity_type = 'comment') as comment_count
      FROM tickets t
      LEFT JOIN users u1 ON t.created_by = u1.user_id
      LEFT JOIN users u2 ON t.assigned_to = u2.user_id
      WHERE t.project_id = $1
    `;

    const queryParams = [projectId];
    let paramIndex = 2;

    // Add filters
    if (status) {
      query += ` AND t.status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    if (priority) {
      query += ` AND t.priority = $${paramIndex}`;
      queryParams.push(priority);
      paramIndex++;
    }

    if (type) {
      query += ` AND t.type = $${paramIndex}`;
      queryParams.push(type);
      paramIndex++;
    }

    if (assignedTo) {
      query += ` AND t.assigned_to = $${paramIndex}`;
      queryParams.push(assignedTo);
      paramIndex++;
    }

    if (search) {
      query += ` AND (t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM (${query}) as filtered_tickets`;
    const countResult = await pool.query(countQuery, queryParams);
    const totalCount = parseInt(countResult.rows[0].count);

    // Add pagination and sorting
    const offset = (page - 1) * limit;
    query += ` ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);

    res.json({
      success: true,
      data: {
        tickets: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      }
    });

  } catch (error) {
    console.error('List tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve tickets',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// Create Ticket
// ============================================

/**
 * Create a new ticket
 * POST /api/tickets
 * Body: { projectId, title, description?, type?, priority?, assignedTo?, dueDate?, tags? }
 */
router.post('/', authenticateToken, createTicketValidation, async (req, res) => {
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
      description = '',
      type = 'task',
      priority = 'medium',
      assignedTo = null,
      dueDate = null,
      tags = [],
      metadata = {}
    } = req.body;

    // Verify user has access to project (at least viewer)
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

    // If assigning to someone, verify they have access to project
    if (assignedTo) {
      const assigneeCheck = await pool.query(
        `SELECT user_id FROM users WHERE user_id = $1 AND (
          user_id IN (SELECT owner_id FROM projects WHERE project_id = $2) OR
          user_id IN (SELECT user_id FROM project_collaborators WHERE project_id = $2 AND accepted_at IS NOT NULL)
        )`,
        [assignedTo, projectId]
      );

      if (assigneeCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Assigned user does not have access to this project'
        });
      }
    }

    // Create ticket
    const result = await pool.query(
      `INSERT INTO tickets (
        project_id, title, description, type, status, priority, 
        created_by, assigned_to, due_date, tags, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [projectId, title, description, type, 'open', priority, userId, assignedTo, dueDate, tags, JSON.stringify(metadata)]
    );

    const ticket = result.rows[0];

    // Log activity
    await pool.query(
      `INSERT INTO ticket_activities (ticket_id, user_id, activity_type, content)
       VALUES ($1, $2, $3, $4)`,
      [ticket.ticket_id, userId, 'created', 'Ticket created']
    );

    console.log(`Ticket created: ${ticket.title} (${ticket.ticket_id}) in project ${projectId}`);

    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      data: { ticket }
    });

  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create ticket',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// Get Single Ticket
// ============================================

/**
 * Get a ticket by ID
 * GET /api/tickets/:id
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT 
        t.*,
        u1.username as creator_username,
        u1.display_name as creator_display_name,
        u1.avatar_url as creator_avatar_url,
        u2.username as assignee_username,
        u2.display_name as assignee_display_name,
        u2.avatar_url as assignee_avatar_url,
        p.name as project_name
      FROM tickets t
      LEFT JOIN users u1 ON t.created_by = u1.user_id
      LEFT JOIN users u2 ON t.assigned_to = u2.user_id
      LEFT JOIN projects p ON t.project_id = p.project_id
      WHERE t.ticket_id = $1 
        AND (p.owner_id = $2 OR p.project_id IN (
          SELECT project_id FROM project_collaborators 
          WHERE user_id = $2 AND accepted_at IS NOT NULL
        ))`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found or access denied'
      });
    }

    // Get activities/comments
    const activities = await pool.query(
      `SELECT 
        ta.*,
        u.username,
        u.display_name,
        u.avatar_url
      FROM ticket_activities ta
      LEFT JOIN users u ON ta.user_id = u.user_id
      WHERE ta.ticket_id = $1
      ORDER BY ta.created_at ASC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ticket: result.rows[0],
        activities: activities.rows
      }
    });

  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve ticket',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// Update Ticket
// ============================================

/**
 * Update a ticket
 * PUT /api/tickets/:id
 * Body: { title?, description?, type?, status?, priority?, assignedTo?, dueDate?, tags? }
 */
router.put('/:id', authenticateToken, updateTicketValidation, async (req, res) => {
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

    // Get current ticket
    const ticketCheck = await pool.query(
      `SELECT t.*, p.owner_id 
       FROM tickets t
       LEFT JOIN projects p ON t.project_id = p.project_id
       WHERE t.ticket_id = $1`,
      [id]
    );

    if (ticketCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    const currentTicket = ticketCheck.rows[0];

    // Verify user has edit access
    const isOwner = currentTicket.owner_id === userId;
    const isCreator = currentTicket.created_by === userId;
    const isAssignee = currentTicket.assigned_to === userId;

    if (!isOwner && !isCreator && !isAssignee) {
      const editorCheck = await pool.query(
        `SELECT role FROM project_collaborators 
         WHERE project_id = $1 AND user_id = $2 AND role = 'editor' AND accepted_at IS NOT NULL`,
        [currentTicket.project_id, userId]
      );

      if (editorCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to update this ticket'
        });
      }
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];
    const changes = {};
    let paramIndex = 1;

    const allowedFields = ['title', 'description', 'type', 'status', 'priority', 'assigned_to', 'due_date', 'tags', 'metadata'];
    
    Object.keys(req.body).forEach(key => {
      const dbField = key === 'assignedTo' ? 'assigned_to' : key === 'dueDate' ? 'due_date' : key;
      
      if (allowedFields.includes(dbField) && req.body[key] !== undefined) {
        updateFields.push(`${dbField} = $${paramIndex}`);
        const value = (dbField === 'metadata') ? JSON.stringify(req.body[key]) : 
                      (dbField === 'tags' && Array.isArray(req.body[key])) ? req.body[key] : 
                      req.body[key];
        updateValues.push(value);
        changes[dbField] = { from: currentTicket[dbField], to: value };
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
      `UPDATE tickets 
       SET ${updateFields.join(', ')}
       WHERE ticket_id = $${paramIndex}
       RETURNING *`,
      updateValues
    );

    // Log activity
    await pool.query(
      `INSERT INTO ticket_activities (ticket_id, user_id, activity_type, changes)
       VALUES ($1, $2, $3, $4)`,
      [id, userId, 'updated', JSON.stringify(changes)]
    );

    console.log(`Ticket updated: ${id}`);

    res.json({
      success: true,
      message: 'Ticket updated successfully',
      data: { ticket: result.rows[0] }
    });

  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update ticket',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// Add Comment
// ============================================

/**
 * Add a comment to a ticket
 * POST /api/tickets/:id/comments
 * Body: { content }
 */
router.post('/:id/comments', authenticateToken, addCommentValidation, async (req, res) => {
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
    const { content } = req.body;

    // Verify ticket exists and user has access
    const ticketCheck = await pool.query(
      `SELECT t.ticket_id, p.owner_id 
       FROM tickets t
       LEFT JOIN projects p ON t.project_id = p.project_id
       WHERE t.ticket_id = $1 
         AND (p.owner_id = $2 OR p.project_id IN (
           SELECT project_id FROM project_collaborators 
           WHERE user_id = $2 AND accepted_at IS NOT NULL
         ))`,
      [id, userId]
    );

    if (ticketCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found or access denied'
      });
    }

    // Add comment
    const result = await pool.query(
      `INSERT INTO ticket_activities (ticket_id, user_id, activity_type, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, userId, 'comment', content]
    );

    // Update ticket updated_at
    await pool.query(
      'UPDATE tickets SET updated_at = NOW() WHERE ticket_id = $1',
      [id]
    );

    console.log(`Comment added to ticket ${id} by user ${userId}`);

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: { comment: result.rows[0] }
    });

  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add comment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// Delete Ticket
// ============================================

/**
 * Delete a ticket (owner/editor/creator only)
 * DELETE /api/tickets/:id
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Get ticket and verify permissions
    const ticketCheck = await pool.query(
      `SELECT t.*, p.owner_id 
       FROM tickets t
       LEFT JOIN projects p ON t.project_id = p.project_id
       WHERE t.ticket_id = $1`,
      [id]
    );

    if (ticketCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    const ticket = ticketCheck.rows[0];
    const isOwner = ticket.owner_id === userId;
    const isCreator = ticket.created_by === userId;

    if (!isOwner && !isCreator) {
      const editorCheck = await pool.query(
        `SELECT role FROM project_collaborators 
         WHERE project_id = $1 AND user_id = $2 AND role = 'editor' AND accepted_at IS NOT NULL`,
        [ticket.project_id, userId]
      );

      if (editorCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to delete this ticket'
        });
      }
    }

    // Delete ticket
    await pool.query('DELETE FROM tickets WHERE ticket_id = $1', [id]);

    console.log(`Ticket deleted: ${id}`);

    res.json({
      success: true,
      message: 'Ticket deleted successfully'
    });

  } catch (error) {
    console.error('Delete ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete ticket',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
