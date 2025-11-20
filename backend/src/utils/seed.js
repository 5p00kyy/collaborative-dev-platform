const { Pool } = require('pg');
const bcrypt = require('bcrypt');

require('dotenv').config();

// ============================================
// Database Seed Utility
// ============================================

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'platform_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

const SALT_ROUNDS = 10;

async function seedDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Starting database seeding...\n');

    // Create demo users
    console.log('👥 Creating demo users...');
    const password = await bcrypt.hash('Demo123!', SALT_ROUNDS);
    
    const users = await client.query(`
      INSERT INTO users (username, email, password_hash, display_name)
      VALUES 
        ('demo_admin', 'admin@demo.com', $1, 'Demo Admin'),
        ('demo_user', 'user@demo.com', $1, 'Demo User'),
        ('demo_collab', 'collab@demo.com', $1, 'Demo Collaborator')
      ON CONFLICT (email) DO NOTHING
      RETURNING user_id, username, email
    `, [password]);

    console.log(`✅ Created ${users.rows.length} demo users\n`);

    if (users.rows.length > 0) {
      const adminId = users.rows[0].user_id;
      const userId = users.rows[1]?.user_id;
      const collabId = users.rows[2]?.user_id;

      // Create demo project
      console.log('📁 Creating demo project...');
      const project = await client.query(`
        INSERT INTO projects (name, description, owner_id, status, visibility)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING project_id, name
      `, [
        'Demo Project',
        'This is a demo project to showcase the platform features',
        adminId,
        'active',
        'private'
      ]);

      const projectId = project.rows[0].project_id;
      console.log(`✅ Created project: ${project.rows[0].name}\n`);

      // Add collaborators
      if (userId && collabId) {
        console.log('🤝 Adding collaborators...');
        await client.query(`
          INSERT INTO project_collaborators (project_id, user_id, role, accepted_at)
          VALUES 
            ($1, $2, 'editor', NOW()),
            ($1, $3, 'viewer', NOW())
        `, [projectId, userId, collabId]);
        console.log('✅ Added 2 collaborators\n');
      }

      // Create demo tickets
      console.log('🎫 Creating demo tickets...');
      const tickets = await client.query(`
        INSERT INTO tickets (
          project_id, title, description, type, status, priority, created_by, assigned_to
        )
        VALUES 
          ($1, 'Setup development environment', 'Configure local development setup with all required tools', 'task', 'closed', 'high', $2, $3),
          ($1, 'Fix login page bug', 'Login page shows error on valid credentials', 'bug', 'in_progress', 'critical', $2, $3),
          ($1, 'Add dark mode support', 'Implement dark mode theme across all pages', 'feature', 'open', 'medium', $2, NULL),
          ($1, 'Improve dashboard performance', 'Dashboard loads slowly with many projects', 'task', 'review', 'high', $2, $3),
          ($1, 'Add export functionality', 'Allow users to export project data as JSON', 'idea', 'open', 'low', $2, NULL)
        RETURNING ticket_id, title
      `, [projectId, adminId, userId || adminId]);

      console.log(`✅ Created ${tickets.rows.length} demo tickets\n`);

      // Create demo notes
      console.log('📝 Creating demo notes...');
      const notes = await client.query(`
        INSERT INTO notes (
          project_id, title, content, content_format, author_id, tags
        )
        VALUES 
          ($1, 'Getting Started', '# Getting Started\n\nWelcome to the project! This note contains important information for new team members.\n\n## Key Points\n- Review the project documentation\n- Set up your development environment\n- Join the team chat', 'markdown', $2, ARRAY['onboarding', 'important']),
          ($1, 'API Documentation', '# API Endpoints\n\nList of available API endpoints:\n\n- `/api/auth` - Authentication\n- `/api/projects` - Project management\n- `/api/tickets` - Issue tracking', 'markdown', $2, ARRAY['documentation', 'api']),
          ($1, 'Meeting Notes - Week 1', '# Team Meeting\n\n**Date:** 2025-11-20\n\n## Attendees\n- Demo Admin\n- Demo User\n\n## Discussion Points\n1. Project kickoff\n2. Timeline review\n3. Role assignments', 'markdown', $2, ARRAY['meeting', 'week-1'])
        RETURNING note_id, title
      `, [projectId, adminId]);

      console.log(`✅ Created ${notes.rows.length} demo notes\n`);

      // Add comments to tickets
      console.log('💬 Adding ticket comments...');
      if (tickets.rows.length > 0) {
        await client.query(`
          INSERT INTO ticket_activities (ticket_id, user_id, activity_type, content)
          VALUES 
            ($1, $2, 'comment', 'I can help with this task'),
            ($1, $3, 'comment', 'Great! Let me know if you need any resources')
        `, [tickets.rows[0].ticket_id, userId || adminId, adminId]);
        console.log('✅ Added ticket comments\n');
      }
    }

    console.log('✅ Database seeding completed successfully!');
    console.log('\n📊 Demo Data Summary:');
    console.log('   👥 Users: 3 (admin@demo.com, user@demo.com, collab@demo.com)');
    console.log('   🔑 Password: Demo123!');
    console.log('   📁 Projects: 1');
    console.log('   🎫 Tickets: 5');
    console.log('   📝 Notes: 3\n');

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    console.error('\nDetails:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  seedDatabase().then(() => {
    console.log('Seeding process completed');
    process.exit(0);
  }).catch(error => {
    console.error('Seeding process failed:', error);
    process.exit(1);
  });
}

module.exports = { seedDatabase };
