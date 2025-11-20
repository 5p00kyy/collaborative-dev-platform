# API Documentation

## Overview

The Collaborative Dev Platform API provides RESTful endpoints for managing projects, tickets, notes, assets, and team collaboration.

**Base URL:** `http://localhost:3000/api`  
**API Version:** 0.1.0  
**Authentication:** JWT Bearer tokens

---

## 📚 Interactive Documentation

### Swagger UI

Access the full interactive API documentation at:

**Local Development:**
```
http://localhost:3000/api/docs
```

**Docker:**
```
http://localhost:8080/api/docs
```

The Swagger UI provides:
- ✅ Complete endpoint documentation
- ✅ Request/response schemas
- ✅ Try-it-out functionality
- ✅ Authentication support
- ✅ Example requests and responses

### OpenAPI Specification

Download the OpenAPI 3.0 specification:
```
http://localhost:3000/api/docs.json
```

Use this with tools like Postman, Insomnia, or generate client SDKs.

---

## 🔐 Authentication

### Overview

The API uses JWT (JSON Web Tokens) for authentication with a two-token system:
- **Access Token:** Short-lived (15 minutes), used for API requests
- **Refresh Token:** Long-lived (7 days), used to get new access tokens

### Authentication Flow

1. **Register or Login** to get tokens
2. **Include Access Token** in all requests:
   ```
   Authorization: Bearer <access_token>
   ```
3. **Refresh tokens** when access token expires
4. **Logout** to invalidate refresh token

### Endpoints

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "displayName": "John Doe"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "userId": "uuid",
      "username": "johndoe",
      "email": "john@example.com",
      "displayName": "John Doe"
    },
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci..."
  }
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

#### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGci..."
}
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <access_token>
```

---

## 📁 Resources

### Projects

Manage development projects with collaborators.

**Endpoints:**
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project details
- `PATCH /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

**Example:**
```http
GET /api/projects?status=active&page=1&limit=10
Authorization: Bearer <token>
```

### Collaborators

Manage team members and permissions.

**Endpoints:**
- `GET /api/collaborators/project/:projectId` - List collaborators
- `POST /api/collaborators/invite` - Invite collaborator
- `POST /api/collaborators/accept/:inviteId` - Accept invitation
- `PATCH /api/collaborators/:id` - Update role
- `DELETE /api/collaborators/:id` - Remove collaborator

**Roles:**
- `owner` - Full control
- `editor` - Can edit, cannot delete project
- `viewer` - Read-only access

### Tickets

Issue tracking and workflow management.

**Endpoints:**
- `GET /api/tickets/project/:projectId` - List tickets
- `POST /api/tickets` - Create ticket
- `GET /api/tickets/:id` - Get ticket details
- `PATCH /api/tickets/:id` - Update ticket
- `DELETE /api/tickets/:id` - Delete ticket
- `POST /api/tickets/:id/comments` - Add comment
- `GET /api/tickets/:id/activities` - Get activity log

**Ticket Types:** `bug`, `feature`, `task`, `idea`  
**Statuses:** `open`, `in_progress`, `review`, `closed`  
**Priorities:** `low`, `medium`, `high`, `critical`

### Notes

Knowledge management with markdown support.

**Endpoints:**
- `GET /api/notes/project/:projectId` - List notes
- `POST /api/notes` - Create note
- `GET /api/notes/:id` - Get note
- `PATCH /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Delete note
- `GET /api/notes/:id/versions` - Get version history

**Features:**
- Markdown content
- Hierarchical organization (parent/child)
- Full-text search
- Tagging
- Version tracking

### Assets

File and asset management.

**Endpoints:**
- `POST /api/assets/:projectId/upload` - Upload file
- `GET /api/assets/:projectId` - List assets
- `GET /api/assets/:projectId/:assetId/download` - Download file
- `DELETE /api/assets/:projectId/:assetId` - Delete file

**Supported File Types:**
- Images: JPEG, PNG, GIF, WebP, SVG
- Documents: PDF, Text, Markdown, JSON
- Archives: ZIP, TAR, GZIP

**Limits:**
- Max file size: 100 MB
- MIME type validation
- File extension validation

---

## 📊 Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### Pagination
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10
    }
  }
}
```

---

## 🚦 HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request successful |
| 201 | Created - Resource created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid/missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

---

## ⚡ Rate Limiting

**Authentication Endpoints:**
- 5 requests per minute per IP

**General API Endpoints:**
- 100 requests per minute per user

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

---

## 🧪 Testing with cURL

### Register
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Test123!",
    "displayName": "Test User"
  }'
```

### Create Project
```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_token>" \
  -d '{
    "name": "My Project",
    "description": "Project description",
    "visibility": "private"
  }'
```

### Upload Asset
```bash
curl -X POST http://localhost:3000/api/assets/<project_id>/upload \
  -H "Authorization: Bearer <your_token>" \
  -F "file=@/path/to/file.png" \
  -F "description=My file" \
  -F "tags=[\"design\",\"mockup\"]"
```

---

## 🔧 Client Libraries

### JavaScript/Node.js

```javascript
const API_BASE = 'http://localhost:3000/api';
let accessToken = null;

async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }
  
  return data;
}

// Login
const loginResponse = await apiRequest('/auth/login', {
  method: 'POST',
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password'
  })
});

accessToken = loginResponse.data.accessToken;

// Get projects
const projects = await apiRequest('/projects');
console.log(projects.data.projects);
```

### Python

```python
import requests

API_BASE = 'http://localhost:3000/api'
access_token = None

def api_request(endpoint, method='GET', data=None):
    headers = {'Content-Type': 'application/json'}
    
    if access_token:
        headers['Authorization'] = f'Bearer {access_token}'
    
    response = requests.request(
        method,
        f'{API_BASE}{endpoint}',
        json=data,
        headers=headers
    )
    
    response.raise_for_status()
    return response.json()

# Login
login_response = api_request('/auth/login', 'POST', {
    'email': 'user@example.com',
    'password': 'password'
})

access_token = login_response['data']['accessToken']

# Get projects
projects = api_request('/projects')
print(projects['data']['projects'])
```

---

## 🐛 Error Handling

### Validation Errors (400)
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Must be a valid email address"
    },
    {
      "field": "password",
      "message": "Password must be at least 8 characters"
    }
  ]
}
```

### Authentication Errors (401)
```json
{
  "success": false,
  "message": "Invalid or expired token"
}
```

### Permission Errors (403)
```json
{
  "success": false,
  "message": "You don't have permission to perform this action"
}
```

---

## 📖 Additional Resources

- **Swagger UI:** `/api/docs`
- **OpenAPI Spec:** `/api/docs.json`
- **GitHub Repository:** https://github.com/5p00kyy/collaborative-dev-platform
- **Architecture Docs:** See `ARCHITECTURE.md`
- **Setup Guide:** See `SETUP.md`

---

## 🤝 Support

For API support:
- Create an issue on GitHub
- Check existing documentation
- Review Swagger UI examples

---

**Last Updated:** November 20, 2025  
**API Version:** 0.1.0
