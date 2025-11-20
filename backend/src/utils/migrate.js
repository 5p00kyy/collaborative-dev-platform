const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

require('dotenv').config();

// ============================================
// Database Migration Utility
// ============================================

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'platform_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting database migration...\n');

    // Read and execute main schema
    const schemaPath = path.join(__dirname, '../../../database/schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');

    console.log('📋 Executing main schema...');
    await client.query(schema);
    console.log('✅ Main schema executed successfully\n');

    // Check for migration files
    const migrationsPath = path.join(__dirname, '../../../database/migrations');
    try {
      const migrationFiles = await fs.readdir(migrationsPath);
      const sqlFiles = migrationFiles.filter(f => f.endsWith('.sql')).sort();

      if (sqlFiles.length > 0) {
        console.log(`📂 Found ${sqlFiles.length} migration file(s)\n`);

        for (const file of sqlFiles) {
          console.log(`⚙️  Running migration: ${file}`);
          const migrationPath = path.join(migrationsPath, file);
          const migration = await fs.readFile(migrationPath, 'utf8');
          await client.query(migration);
          console.log(`✅ ${file} completed\n`);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      console.log('ℹ️  No migration files found, skipping...\n');
    }

    console.log('✅ Database migration completed successfully!');
    console.log('\n📊 Database is ready for use\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nDetails:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  runMigration().then(() => {
    console.log('Migration process completed');
    process.exit(0);
  }).catch(error => {
    console.error('Migration process failed:', error);
    process.exit(1);
  });
}

module.exports = { runMigration };
