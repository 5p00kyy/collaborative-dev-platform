const express = require('express');
const { body, validationResult } = require('express-validator');

const { pool } = require('../../config/database');
const { authenticateToken, requireProjectRole } = require('../../middleware/auth');

const router = express.Router();

// ============================================
// Validation Rules
// ============================================

const inviteCollaboratorValidation = [
  body('projectId')
    .notEmpty()
    .withMessage('Project ID is required')
    .isUUID()
    .withMessage('Invalid project ID'),
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('role')
    .isIn(['editor', 'viewer'])
    .withMessage('Role must be editor or viewer'),
  body('permissions')
    .optional()
    .isObject()
    .withMessage('Permissions must be an object')
];

const updateCollaboratorValidation = [
  body('role')
    .optional()
    .isIn(['editor', 'viewer'])
    .withMessage('Role must be editor or viewer'),
  body('permissions')
    .optional()
    .isObject()
    .withMessage('Permissions must be an object')
];

// ============================================
// List Project Collaborators
// ============================================

/**
 * Get all collaborators for a project
 * GET /api/collaborators/project/:projectId
 */
router.get('/project/:projectId', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.userId;

    // Verify user has access to this project
    const accessCheck = await pool.query(
      `SELECT project_id FROM projects 
       WHERE project_id = $1 AND (owner_id = $2 OR project_id IN (
         SELECT project_id FROM project_collaborators 
         WHERE user_id = $2 AND accepted_at IS NOT NULL
       ))`,
      [projectId, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    // Get collaborators
    const result = await pool.query(
      `SELECT 
        pc.collaboration_id,
        pc.project_id,
        pc.user_id,
        pc.role,
        pc.permissions,
        pc.invited_at,
        pc.accepted_at,
        u.username,
        u.email,
        u.display_name,
        u.avatar_url
      FROM project_collaborators pc
      LEFT JOIN users u ON pc.user_id = u.user_id
      WHERE pc.project_id = $1
      ORDER BY pc.invited_at DESC`,
      [projectId]
    );

    res.json({
      success: true,
      data: {
        collaborators: result.rows
      }
    });

  } catch (error) {
    console.error('List collaborators error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve collaborators',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// Invite Collaborator
// ============================================

/**
 * Invite a user to collaborate on a project
 * POST /api/collaborators/invite
 * Body: { projectId, email, role, permissions? }
 */
router.post('/invite', authenticateToken, inviteCollaboratorValidation, async (req, res) => {
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

    const { projectId, email, role, permissions = {} } = req.body;
    const inviterId = req.user.userId;

    // Verify inviter is owner or editor
    const projectCheck = await pool.query(
      `SELECT owner_id FROM projects WHERE project_id = $1`,
      [projectId]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const isOwner = projectCheck.rows[0].owner_id === inviterId;
    
    if (!isOwner) {
      // Check if user is an editor
      const editorCheck = await pool.query(
        `SELECT role FROM project_collaborators 
         WHERE project_id = $1 AND user_id = $2 AND role = 'editor' AND accepted_at IS NOT NULL`,
        [projectId, inviterId]
      );

      if (editorCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Only project owners and editors can invite collaborators'
        });
      }
    }

    // Find user by email
    const userResult = await pool.query(
      'SELECT user_id, username, email FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User with this email not found'
      });
    }

    const invitedUser = userResult.rows[0];

    // Check if user is already a collaborator
    const existingCollab = await pool.query(
      'SELECT collaboration_id FROM project_collaborators WHERE project_id = $1 AND user_id = $2',
      [projectId, invitedUser.user_id]
    );

    if (existingCollab.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'User is already a collaborator on this project'
      });
    }

    // Check if user is the owner
    if (invitedUser.user_id === projectCheck.rows[0].owner_id) {
      return res.status(400).json({
        success: false,
        message: 'Project owner is automatically a collaborator'
      });
    }

    // Insert collaborator
    const result = await pool.query(
      `INSERT INTO project_collaborators (project_id, user_id, role, permissions)
       VALUES ($1, $2, $3, $4)
       RETURNING collaboration_id, project_id, user_id, role, permissions, invited_at`,
      [projectId, invitedUser.user_id, role, JSON.stringify(permissions)]
    );

    console.log(`Collaborator invited: ${invitedUser.username} to project ${projectId} as ${role}`);

    res.status(201).json({
      success: true,
      message: 'Collaborator invited successfully',
      data: {
        collaboration: {
          ...result.rows[0],
          username: invitedUser.username,
          email: invitedUser.email
        }
      }
    });

  } catch (error) {
    console.error('Invite collaborator error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to invite collaborator',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// Accept Collaboration Invite
// ============================================

/**
 * Accept a collaboration invitation
 * POST /api/collaborators/:collaborationId/accept
 */
router.post('/:collaborationId/accept', authenticateToken, async (req, res) => {
  try {
    const { collaborationId } = req.params;
    const userId = req.user.userId;

    // Verify invitation exists and is for this user
    const collabCheck = await pool.query(
      'SELECT * FROM project_collaborators WHERE collaboration_id = $1 AND user_id = $2',
      [collaborationId, userId]
    );

    if (collabCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Collaboration invitation not found'
      });
    }

    const collab = collabCheck.rows[0];

    if (collab.accepted_at) {
      return res.status(400).json({
        success: false,
        message: 'Invitation already accepted'
      });
    }

    // Accept invitation
    const result = await pool.query(
      `UPDATE project_collaborators 
       SET accepted_at = NOW() 
       WHERE collaboration_id = $1 
       RETURNING *`,
      [collaborationId]
    );

    console.log(`Collaboration accepted: ${userId} for project ${collab.project_id}`);

    res.json({
      success: true,
      message: 'Collaboration invitation accepted',
      data: {
        collaboration: result.rows[0]
      }
    });

  } catch (error) {
    console.error('Accept collaboration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept invitation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// Update Collaborator
// ============================================

/**
 * Update collaborator role/permissions (owner/editor only)
 * PUT /api/collaborators/:collaborationId
 * Body: { role?, permissions? }
 */
router.put('/:collaborationId', authenticateToken, updateCollaboratorValidation, async (req, res) => {
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

    const { collaborationId } = req.params;
    const userId = req.user.userId;
    const { role, permissions } = req.body;

    // Get collaboration details
    const collabCheck = await pool.query(
      `SELECT pc.*, p.owner_id 
       FROM project_collaborators pc
       LEFT JOIN projects p ON pc.project_id = p.project_id
       WHERE pc.collaboration_id = $1`,
      [collaborationId]
    );

    if (collabCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Collaboration not found'
      });
    }

    const collab = collabCheck.rows[0];

    // Only owner or editors can update collaborators
    const isOwner = collab.owner_id === userId;
    if (!isOwner) {
      const editorCheck = await pool.query(
        `SELECT role FROM project_collaborators 
         WHERE project_id = $1 AND user_id = $2 AND role = 'editor' AND accepted_at IS NOT NULL`,
        [collab.project_id, userId]
      );

      if (editorCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Only project owners and editors can update collaborators'
        });
      }
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (role) {
      updateFields.push(`role = $${paramIndex}`);
      updateValues.push(role);
      paramIndex++;
    }

    if (permissions) {
      updateFields.push(`permissions = $${paramIndex}`);
      updateValues.push(JSON.stringify(permissions));
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateValues.push(collaborationId);

    const result = await pool.query(
      `UPDATE project_collaborators 
       SET ${updateFields.join(', ')}
       WHERE collaboration_id = $${paramIndex}
       RETURNING *`,
      updateValues
    );

    console.log(`Collaborator updated: ${collaborationId}`);

    res.json({
      success: true,
      message: 'Collaborator updated successfully',
      data: {
        collaboration: result.rows[0]
      }
    });

  } catch (error) {
    console.error('Update collaborator error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update collaborator',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// Remove Collaborator
// ============================================

/**
 * Remove a collaborator from a project (owner/editor only)
 * DELETE /api/collaborators/:collaborationId
 */
router.delete('/:collaborationId', authenticateToken, async (req, res) => {
  try {
    const { collaborationId } = req.params;
    const userId = req.user.userId;

    // Get collaboration details
    const collabCheck = await pool.query(
      `SELECT pc.*, p.owner_id 
       FROM project_collaborators pc
       LEFT JOIN projects p ON pc.project_id = p.project_id
       WHERE pc.collaboration_id = $1`,
      [collaborationId]
    );

    if (collabCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Collaboration not found'
      });
    }

    const collab = collabCheck.rows[0];

    // Users can remove themselves, or owner/editors can remove others
    const isSelf = collab.user_id === userId;
    const isOwner = collab.owner_id === userId;

    if (!isSelf && !isOwner) {
      const editorCheck = await pool.query(
        `SELECT role FROM project_collaborators 
         WHERE project_id = $1 AND user_id = $2 AND role = 'editor' AND accepted_at IS NOT NULL`,
        [collab.project_id, userId]
      );

      if (editorCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to remove collaborator'
        });
      }
    }

    // Delete collaboration
    await pool.query(
      'DELETE FROM project_collaborators WHERE collaboration_id = $1',
      [collaborationId]
    );

    console.log(`Collaborator removed: ${collaborationId}`);

    res.json({
      success: true,
      message: 'Collaborator removed successfully'
    });

  } catch (error) {
    console.error('Remove collaborator error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove collaborator',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;