-- Migration: 001_initial_schema
-- Description: Create initial database schema for Collaborative Dev Platform
-- Created: 2025-11-20

-- This migration file is a reference copy of the main schema
-- For actual database setup, use the main schema.sql file

-- To apply this migration:
-- psql -U postgres -d platform_db -f 001_initial_schema.sql

\echo 'Creating initial database schema...'

-- Include the main schema file
\i ../schema.sql

\echo 'Initial schema created successfully!'
