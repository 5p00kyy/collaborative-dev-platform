# Architecture Documentation

## System Overview

The Collaborative Development Platform is a full-stack web application designed for real-time project collaboration with Git-like version control capabilities and self-learning code structure enforcement.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (Browser)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Bootstrap 5  │  │ Vanilla JS   │  │  WebSocket   │  │
│  │     UI       │  │    Logic     │  │    Client    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   Backend (Node.js)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Express    │  │  WebSocket   │  │     JWT      │  │
│  │   REST API   │  │    Server    │  │     Auth     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
            ┌─────────────┼─────────────┐
            ▼             ▼             ▼
    ┌────────────┐  ┌──────────┐  ┌──────────┐
    │ PostgreSQL │  │  Redis   │  │   S3     │
    │  Database  │  │  Cache   │  │ Storage  │
    └────────────┘  └──────────┘  └──────────┘
```

## Technology Stack

### Frontend
- **UI Framework**: Bootstrap 5.3.2
- **JavaScript**: Vanilla ES6+ (no frameworks)
- **Icons**: Bootstrap Icons
- **Markdown**: Marked.js
- **Sanitization**: DOMPurify
- **WebSocket**: Native WebSocket API

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express 4.18
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcrypt
- **WebSocket**: Socket.io or ws
- **Security**: Helmet, CORS
- **Compression**: compression middleware
- **Logging**: Morgan

### Database & Storage
- **Primary Database**: PostgreSQL 14+
  - JSONB for flexible metadata
  - Full-text search
  - UUID primary keys
- **Cache Layer**: Redis 6+
  - Session management
  - Real-time state
  - Rate limiting
- **File Storage**: AWS S3 / Azure Blob
  - Asset repository
  - File attachments

## Core Components

### 1. Authentication System

**Flow:**
```
User Input → Express Route → Validation → bcrypt.compare() 
→ JWT Generation → Redis Session → Response
```

**Features:**
- JWT access tokens (15min expiry)
- Refresh tokens (7 days expiry)
- httpOnly cookies for refresh tokens
- Redis-based session management
- Password strength validation

### 2. Real-Time Sync Engine

**Architecture:**
```
Client Edit → WebSocket → Operation Transform → Redis Queue 
→ Broadcast → Other Clients → Apply Changes
```

**Components:**
- WebSocket server for bidirectional communication
- Operational Transformation (OT) for conflict resolution
- Redis pub/sub for multi-server scaling
- Presence tracking (who's online, cursor position)
- Offline queue with IndexedDB

**OT Algorithm:**
```javascript
// Simplified OT example
function transform(op1, op2) {
  if (op1.position < op2.position) {
    return [op1, adjustPosition(op2, op1.length)]
  } else {
    return [adjustPosition(op1, op2.length), op2]
  }
}
```

### 3. Version Control System

**Similar to Git:**
- Projects can be "forked"
- Changes proposed via "merge proposals"
- Requires 2-person approval
- Full diff/merge capabilities
- Version history for all documents

**Data Structure:**
```sql
projects
  ├── project_forks (parent → child relationship)
  ├── merge_proposals
  │   ├── changes_summary
  │   └── merge_approvals
  └── note_versions (full history)
```

### 4. Self-Learning Rule System

**Pipeline:**
```
Code Input → Parser (Babel/Acorn) → AST Traversal 
→ Pattern Extraction → Frequency Analysis → Rule Generation 
→ Confidence Scoring → Validation Engine → Suggestions
```

**Pattern Categories:**
- Naming conventions (camelCase, PascalCase, etc.)
- Code structure (indentation, braces, quotes)
- Architecture patterns (file organization, imports)
- Best practices (error handling, async patterns)

**Learning Process:**
1. Parse code on every commit/save
2. Extract patterns and store in database
3. Calculate frequency (user-level and project-level)
4. Generate rules when confidence > 70%
5. Auto-enforce when confidence > 90%
6. Adjust based on user feedback

## Database Design

### Schema Highlights

**Core Tables:**
- `users` - User accounts
- `projects` - Project metadata
- `project_collaborators` - Access control
- `notes` - Documentation
- `note_versions` - Version history
- `tickets` - Issue tracking
- `activity_log` - Audit trail

**Indexing Strategy:**
- B-tree indexes on foreign keys
- GIN indexes for JSONB and array columns
- Composite indexes for common queries
- Partial indexes for filtered queries

**Triggers:**
- Auto-update `updated_at` timestamps
- Cascade deletes for cleanup
- Version number incrementing

## Security Measures

### Authentication & Authorization
- JWT with short expiry times
- Refresh token rotation
- Role-based access control (RBAC)
- Granular permissions per resource

### Data Protection
- Password hashing with bcrypt (10 rounds)
- AES-256 encryption for credentials
- HTTPS only in production
- SQL injection prevention (parameterized queries)
- XSS protection (DOMPurify, CSP headers)
- CSRF tokens

### Rate Limiting
- Express-rate-limit middleware
- Redis-backed for distributed systems
- Per-endpoint limits
- IP-based tracking

### Audit Trail
- All actions logged to `activity_log`
- IP address and user agent tracking
- Change history with diffs
- Immutable log entries

## Scalability Considerations

### Horizontal Scaling
- Stateless API servers (JWT auth)
- Redis for shared session state
- PostgreSQL connection pooling
- Load balancer ready

### Performance Optimizations
- Response compression (gzip)
- Database query optimization
- Redis caching layer
- CDN for static assets
- Lazy loading for large datasets

### Real-Time Scaling
- Redis pub/sub for multi-server WebSocket
- Sticky sessions for WebSocket connections
- Message queuing for async operations
- Rate limiting per user

## Deployment Architecture

### Development
```
localhost:3000 (Backend)
localhost:8080 (Frontend)
localhost:5432 (PostgreSQL)
localhost:6379 (Redis)
```

### Production
```
nginx → Load Balancer → [Node.js Servers] → PostgreSQL
                                          → Redis Cluster
                                          → S3
```

## API Design

### RESTful Principles
- Resource-based URLs
- HTTP verbs (GET, POST, PUT, DELETE)
- JSON request/response
- Proper status codes
- Versioned endpoints (/api/v1)

### Response Format
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful",
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

### Error Format
```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

## Future Enhancements

- GraphQL API option
- Mobile apps (React Native)
- Desktop apps (Electron)
- AI-powered code suggestions
- Advanced analytics
- Plugin system
- GitHub/GitLab integration
- Slack/Discord notifications
- Multi-language support
