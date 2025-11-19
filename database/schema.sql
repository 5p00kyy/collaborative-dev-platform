-- ============================================
-- Collaborative Dev Platform - Database Schema
-- PostgreSQL 14+
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Users & Authentication
-- ============================================

CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    preferences JSONB DEFAULT '{}',
    coding_style_profile JSONB DEFAULT '{}',
    CONSTRAINT username_length CHECK (length(username) >= 3),
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- ============================================
-- Projects
-- ============================================

CREATE TABLE projects (
    project_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'active',
    visibility VARCHAR(50) DEFAULT 'private',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    cloud_config JSONB DEFAULT '{}',
    CONSTRAINT valid_status CHECK (status IN ('active', 'archived', 'wip')),
    CONSTRAINT valid_visibility CHECK (visibility IN ('private', 'shared', 'public'))
);

CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);

-- ============================================
-- Project Collaborators
-- ============================================

CREATE TABLE project_collaborators (
    collaboration_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    permissions JSONB DEFAULT '{}',
    invited_at TIMESTAMP DEFAULT NOW(),
    accepted_at TIMESTAMP,
    CONSTRAINT valid_role CHECK (role IN ('owner', 'editor', 'viewer')),
    UNIQUE(project_id, user_id)
);

CREATE INDEX idx_collaborators_project ON project_collaborators(project_id);
CREATE INDEX idx_collaborators_user ON project_collaborators(user_id);

-- ============================================
-- Notes/Documentation
-- ============================================

CREATE TABLE notes (
    note_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    content_format VARCHAR(20) DEFAULT 'markdown',
    author_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    parent_note_id UUID REFERENCES notes(note_id) ON DELETE CASCADE,
    path VARCHAR(1000),
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    CONSTRAINT valid_format CHECK (content_format IN ('markdown', 'html', 'plain'))
);

CREATE INDEX idx_notes_project ON notes(project_id);
CREATE INDEX idx_notes_author ON notes(author_id);
CREATE INDEX idx_notes_parent ON notes(parent_note_id);
CREATE INDEX idx_notes_tags ON notes USING GIN(tags);
CREATE INDEX idx_notes_updated_at ON notes(updated_at DESC);

-- ============================================
-- Note Version History
-- ============================================

CREATE TABLE note_versions (
    version_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    note_id UUID REFERENCES notes(note_id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content TEXT,
    changed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    change_summary TEXT,
    diff JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(note_id, version_number)
);

CREATE INDEX idx_note_versions_note ON note_versions(note_id);
CREATE INDEX idx_note_versions_created_at ON note_versions(created_at DESC);

-- ============================================
-- Tickets/Issues
-- ============================================

CREATE TABLE tickets (
    ticket_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    type VARCHAR(50) DEFAULT 'task',
    status VARCHAR(50) DEFAULT 'open',
    priority VARCHAR(50) DEFAULT 'medium',
    created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    due_date TIMESTAMP,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    CONSTRAINT valid_type CHECK (type IN ('bug', 'feature', 'task', 'idea')),
    CONSTRAINT valid_status CHECK (status IN ('open', 'in_progress', 'review', 'closed')),
    CONSTRAINT valid_priority CHECK (priority IN ('low', 'medium', 'high', 'critical'))
);

CREATE INDEX idx_tickets_project ON tickets(project_id);
CREATE INDEX idx_tickets_assigned ON tickets(assigned_to);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_tickets_tags ON tickets USING GIN(tags);

-- ============================================
-- Ticket Activities
-- ============================================

CREATE TABLE ticket_activities (
    activity_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES tickets(ticket_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    activity_type VARCHAR(50) NOT NULL,
    content TEXT,
    changes JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ticket_activities_ticket ON ticket_activities(ticket_id);
CREATE INDEX idx_ticket_activities_created_at ON ticket_activities(created_at DESC);

-- ============================================
-- Assets Repository
-- ============================================

CREATE TABLE assets (
    asset_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    file_type VARCHAR(100),
    file_size BIGINT,
    storage_path TEXT NOT NULL,
    uploaded_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    version INTEGER DEFAULT 1
);

CREATE INDEX idx_assets_project ON assets(project_id);
CREATE INDEX idx_assets_uploader ON assets(uploaded_by);
CREATE INDEX idx_assets_tags ON assets USING GIN(tags);

-- ============================================
-- Activity Log (Paper Trail)
-- ============================================

CREATE TABLE activity_log (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    changes JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activity_log_project ON activity_log(project_id);
CREATE INDEX idx_activity_log_user ON activity_log(user_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);

-- ============================================
-- Triggers for updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Views
-- ============================================

-- View for project overview with collaborator count
CREATE VIEW project_overview AS
SELECT 
    p.project_id,
    p.name,
    p.description,
    p.status,
    p.owner_id,
    u.username as owner_username,
    p.created_at,
    p.updated_at,
    COUNT(DISTINCT pc.user_id) as collaborator_count,
    COUNT(DISTINCT n.note_id) as note_count,
    COUNT(DISTINCT t.ticket_id) as ticket_count
FROM projects p
LEFT JOIN users u ON p.owner_id = u.user_id
LEFT JOIN project_collaborators pc ON p.project_id = pc.project_id
LEFT JOIN notes n ON p.project_id = n.project_id
LEFT JOIN tickets t ON p.project_id = t.project_id
GROUP BY p.project_id, u.username;

-- Comments
COMMENT ON TABLE users IS 'User accounts and authentication';
COMMENT ON TABLE projects IS 'Project information and settings';
COMMENT ON TABLE notes IS 'Documentation and knowledge base notes';
COMMENT ON TABLE tickets IS 'Issues, tasks, and ideas';
COMMENT ON TABLE activity_log IS 'Audit trail for all project activities';
