const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// ====== Database Test Utilities ======

let pool;

/**
 * Initialize test database connection pool
 */
const setupTestDB = async () => {
  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'platform_db_test'
  });

  // Initialize schema - execute each statement separately
  const schemaPath = path.join(__dirname, '../../../database/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  // Split by semicolons and execute each statement
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    try {
      await pool.query(statement);
    } catch (error) {
      // Ignore errors for CREATE statements that may already exist
      if (!error.message.includes('already exists')) {
        console.error('Schema initialization error:', error.message);
      }
    }
  }

  return pool;
};

/**
 * Clean all tables for fresh test state
 */
const cleanDatabase = async () => {
  if (!pool) {
    throw new Error('Database pool not initialized. Call setupTestDB first.');
  }

  await pool.query('TRUNCATE TABLE ticket_activities CASCADE');
  await pool.query('TRUNCATE TABLE tickets CASCADE');
  await pool.query('TRUNCATE TABLE note_versions CASCADE');
  await pool.query('TRUNCATE TABLE notes CASCADE');
  await pool.query('TRUNCATE TABLE collaborators CASCADE');
  await pool.query('TRUNCATE TABLE projects CASCADE');
  await pool.query('TRUNCATE TABLE users CASCADE');
};

/**
 * Close database connection
 */
const closeDatabase = async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};

/**
 * Get the database pool instance
 */
const getPool = () => {
  if (!pool) {
    throw new Error('Database pool not initialized. Call setupTestDB first.');
  }
  return pool;
};

/**
 * Create a test user
 */
const createTestUser = async (overrides = {}) => {
  const bcrypt = require('bcrypt');
  const password = await bcrypt.hash('Test123!', 10);
  
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, username, display_name)
     VALUES ($1, $2, $3, $4)
     RETURNING user_id as id, email, username, display_name, created_at`,
    [
      overrides.email || 'test@example.com',
      overrides.password_hash || password,
      overrides.username || 'testuser',
      overrides.display_name || 'Test User'
    ]
  );
  
  return result.rows[0];
};

/**
 * Create a test project
 */
const createTestProject = async (userId, overrides = {}) => {
  const result = await pool.query(
    `INSERT INTO projects (name, description, owner_id, status, visibility)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING project_id as id, name, description, owner_id, status, visibility, created_at`,
    [
      overrides.name || 'Test Project',
      overrides.description || 'A test project',
      userId,
      overrides.status || 'active',
      overrides.visibility || 'private'
    ]
  );
  
  return result.rows[0];
};

/**
 * Create a test note
 */
const createTestNote = async (projectId, userId, overrides = {}) => {
  const result = await pool.query(
    `INSERT INTO notes (project_id, created_by, title, content, path, tags)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING note_id as id, project_id, created_by, title, content, path, tags, created_at`,
    [
      projectId,
      userId,
      overrides.title || 'Test Note',
      overrides.content || 'Test content',
      overrides.path || '/test-note',
      overrides.tags || []
    ]
  );
  
  return result.rows[0];
};

/**
 * Create a test ticket
 */
const createTestTicket = async (projectId, userId, overrides = {}) => {
  const result = await pool.query(
    `INSERT INTO tickets (project_id, created_by, title, description, status, priority, type)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ticket_id as id, project_id, created_by, title, description, status, priority, type, created_at`,
    [
      projectId,
      userId,
      overrides.title || 'Test Ticket',
      overrides.description || 'Test description',
      overrides.status || 'open',
      overrides.priority || 'medium',
      overrides.type || 'task'
    ]
  );
  
  return result.rows[0];
};

module.exports = {
  setupTestDB,
  cleanDatabase,
  closeDatabase,
  getPool,
  createTestUser,
  createTestProject,
  createTestNote,
  createTestTicket
};
