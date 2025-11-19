-- ============================================
-- Sample Data for Development
-- ============================================

-- Sample Users (passwords are 'password123' hashed with bcrypt)
-- Note: Update these with actual bcrypt hashes before use
INSERT INTO users (username, email, password_hash, display_name) VALUES
('john_doe', 'john@example.com', '$2b$10$placeholder', 'John Doe'),
('jane_smith', 'jane@example.com', '$2b$10$placeholder', 'Jane Smith'),
('dev_user', 'dev@example.com', '$2b$10$placeholder', 'Dev User')
ON CONFLICT (email) DO NOTHING;

-- Sample Projects
INSERT INTO projects (name, description, owner_id, status) VALUES
('Backend API Development', 'REST API for the main application', (SELECT user_id FROM users WHERE username = 'john_doe'), 'active'),
('Mobile App', 'Cross-platform mobile application', (SELECT user_id FROM users WHERE username = 'jane_smith'), 'wip'),
('Documentation Site', 'User documentation and guides', (SELECT user_id FROM users WHERE username = 'dev_user'), 'active');

-- Sample Notes
INSERT INTO notes (project_id, title, content, author_id) VALUES
((SELECT project_id FROM projects WHERE name = 'Backend API Development'), 
 'API Architecture', 
 '# API Architecture\n\n## Overview\nThis document outlines the architecture decisions for our REST API.\n\n## Technologies\n- Node.js\n- Express\n- PostgreSQL', 
 (SELECT user_id FROM users WHERE username = 'john_doe')),
 
((SELECT project_id FROM projects WHERE name = 'Backend API Development'), 
 'Database Schema', 
 '# Database Schema\n\n## Users Table\n- user_id (UUID)\n- username (VARCHAR)\n- email (VARCHAR)', 
 (SELECT user_id FROM users WHERE username = 'john_doe'));

-- Sample Tickets
INSERT INTO tickets (project_id, title, description, type, status, priority, created_by) VALUES
((SELECT project_id FROM projects WHERE name = 'Backend API Development'),
 'Implement user authentication',
 'Add JWT-based authentication to the API',
 'feature',
 'in_progress',
 'high',
 (SELECT user_id FROM users WHERE username = 'john_doe')),
 
((SELECT project_id FROM projects WHERE name = 'Backend API Development'),
 'Fix CORS issue',
 'CORS headers not working properly on production',
 'bug',
 'open',
 'medium',
 (SELECT user_id FROM users WHERE username = 'john_doe'));

-- Sample Project Collaborators
INSERT INTO project_collaborators (project_id, user_id, role, accepted_at) VALUES
((SELECT project_id FROM projects WHERE name = 'Backend API Development'),
 (SELECT user_id FROM users WHERE username = 'jane_smith'),
 'editor',
 NOW());

\echo 'Sample data inserted successfully!'
