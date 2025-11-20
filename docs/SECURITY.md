# Security Guide

## Overview

The Collaborative Dev Platform implements multiple layers of security to protect user data and prevent common web vulnerabilities.

---

## 🔐 Authentication & Authorization

### JWT-Based Authentication

**Two-Token System:**
- **Access Token**: Short-lived (15 minutes), used for API requests
- **Refresh Token**: Long-lived (7 days), stored in Redis

**Security Features:**
- Bcrypt password hashing (10 rounds)
- Token rotation on refresh
- Token blacklisting on logout
- Secure token storage in Redis

### Role-Based Access Control (RBAC)

**Project Roles:**
- `owner` - Full control over project
- `editor` - Can create, edit, delete resources (except project)
- `viewer` - Read-only access

**Middleware:**
```javascript
// Require authentication
authenticateToken(req, res, next)

// Require specific project role
requireProjectRole(['owner', 'editor'])(req, res, next)
```

---

## 🛡️ CSRF Protection

### Double-Submit Cookie Pattern

The platform uses a modern CSRF protection mechanism:

**How It Works:**
1. Server sets `XSRF-TOKEN` cookie on first request
2. Client reads cookie and sends value in `X-XSRF-TOKEN` header
3. Server validates both cookie and header match

**Implementation:**

```javascript
// Backend automatically sets CSRF cookie
app.use(setCsrfToken);

// Frontend automatically includes CSRF token
// (handled by apiRequest function in app.js)
```

**Manual CSRF Token Retrieval:**

```bash
# Get CSRF token
GET /api/csrf-token

Response:
{
  "success": true,
  "data": {
    "csrfToken": "abc123..."
  }
}
```

**Including CSRF Token:**

```javascript
// Automatic (using apiRequest)
await apiRequest('/api/projects', {
  method: 'POST',
  body: { name: 'My Project' }
});

// Manual
fetch('/api/projects', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-XSRF-TOKEN': getCsrfTokenFromCookie(),
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({ name: 'My Project' })
});
```

**Important Notes:**
- CSRF is **NOT** required for JWT-authenticated requests (Bearer token)
- CSRF **IS** required for cookie-based sessions
- Safe methods (GET, HEAD, OPTIONS) are exempt
- Token expires after 24 hours

---

## 🔒 Password Security

### Requirements

Passwords must:
- Be at least 8 characters long
- Contain at least one uppercase letter
- Contain at least one lowercase letter
- Contain at least one number

Validated by:
```regex
^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$
```

### Hashing

- **Algorithm**: bcrypt
- **Rounds**: 10 (configurable via `SALT_ROUNDS`)
- **Storage**: Never store plain-text passwords

**Example:**
```javascript
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

// Hashing
const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

// Verification
const isValid = await bcrypt.compare(password, passwordHash);
```

---

## 🚦 Rate Limiting

### Endpoint-Specific Limits

**Authentication Endpoints:**
- 5 requests per minute per IP
- Applies to: `/api/auth/*`

**General API Endpoints:**
- 100 requests per minute per user
- Applies to all other `/api/*` routes

**Implementation:**
- Uses `express-rate-limit` with Redis store
- Returns `429 Too Many Requests` when exceeded

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

### Custom Rate Limits

```javascript
const rateLimit = require('express-rate-limit');

const customLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

router.post('/expensive-operation', customLimiter, handler);
```

---

## 📁 File Upload Security

### Validation

**File Type Restrictions:**
```javascript
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'text/plain', 'text/markdown',
  'application/json',
  'application/zip', 'application/x-tar', 'application/gzip'
];
```

**File Size Limits:**
- Maximum: 100 MB
- Configurable via `MAX_FILE_SIZE` environment variable

**Security Measures:**
1. MIME type validation
2. File extension validation
3. File size limits
4. Unique filename generation (prevents overwrites)
5. Sanitized filenames (removes special characters)
6. Isolated storage per project

### Upload Endpoint

```javascript
POST /api/assets/:projectId/upload
Content-Type: multipart/form-data

- Requires authentication
- Requires 'owner' or 'editor' role
- Validates file type and size
- Stores metadata in database
- Files stored in: uploads/:projectId/
```

### Secure File Storage

```
uploads/
  ├── <project-id-1>/
  │   ├── file-abc123.jpg
  │   └── document-def456.pdf
  └── <project-id-2>/
      └── image-ghi789.png
```

**Recommendations for Production:**
- Use cloud storage (AWS S3, Google Cloud Storage)
- Enable virus scanning
- Implement CDN for large files
- Set up automated backups

---

## 🌐 HTTP Security Headers

### Helmet.js Configuration

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));
```

**Headers Set:**
- `Content-Security-Policy` - Prevent XSS attacks
- `X-Content-Type-Options: nosniff` - Prevent MIME-type sniffing
- `X-Frame-Options: DENY` - Prevent clickjacking
- `X-XSS-Protection: 1; mode=block` - Enable XSS filter
- `Strict-Transport-Security` - Enforce HTTPS (production)

---

## 🔍 Input Validation

### Express Validator

All user inputs are validated using `express-validator`:

**Example:**
```javascript
const { body, validationResult } = require('express-validator');

const validation = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail(),
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_-]+$/)
];

router.post('/endpoint', validation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  // Process request
});
```

### SQL Injection Prevention

- **Always use parameterized queries**
- Never concatenate user input into SQL

**Good:**
```javascript
const result = await pool.query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);
```

**Bad (DON'T DO THIS):**
```javascript
// NEVER DO THIS
const result = await pool.query(
  `SELECT * FROM users WHERE email = '${email}'`
);
```

---

## 🚨 XSS Prevention

### Output Encoding

**Frontend:**
- Use `textContent` instead of `innerHTML` when possible
- Sanitize HTML with DOMPurify for markdown content
- Escape user input before display

**Example:**
```javascript
// Safe
element.textContent = userInput;

// Unsafe
element.innerHTML = userInput; // DON'T DO THIS

// Safe for HTML (with sanitization)
import DOMPurify from 'dompurify';
element.innerHTML = DOMPurify.sanitize(userInput);
```

### Content Security Policy

CSP headers prevent inline scripts and unauthorized external resources.

---

## 🔐 Environment Variables

### Required Secrets

Never commit these to version control:

```env
# JWT Secrets (use strong random strings)
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_REFRESH_SECRET=your-refresh-token-secret-change-this

# CSRF Secret
CSRF_SECRET=your-csrf-secret-change-this

# Database
DB_PASSWORD=your-database-password

# Redis (if password-protected)
REDIS_PASSWORD=your-redis-password

# AWS (if using S3)
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
```

### Generating Secure Secrets

```bash
# Generate random secret (32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use openssl
openssl rand -hex 32
```

---

## 🛠️ Security Best Practices

### Development

1. **Never commit secrets** - Use `.env` files (gitignored)
2. **Use HTTPS in production** - Force with redirect
3. **Keep dependencies updated** - Run `npm audit` regularly
4. **Enable 2FA** - For GitHub, AWS, production servers
5. **Review code** - Check for security issues before merging

### Production Checklist

- [ ] All secrets in environment variables
- [ ] HTTPS enabled with valid certificate
- [ ] CORS restricted to production domains
- [ ] Rate limiting enabled
- [ ] Database has strong password
- [ ] Redis requires authentication
- [ ] File uploads validated and scanned
- [ ] Logging enabled for security events
- [ ] Regular backups configured
- [ ] Security headers enabled (Helmet)
- [ ] Input validation on all endpoints
- [ ] CSRF protection active
- [ ] Dependencies audited (`npm audit`)

### Monitoring

**Log Security Events:**
- Failed login attempts
- Invalid CSRF tokens
- Rate limit violations
- Unauthorized access attempts
- File upload rejections

**Recommended Tools:**
- Error tracking: Sentry
- Log aggregation: Logtail, Papertrail
- Uptime monitoring: Pingdom, UptimeRobot
- Security scanning: Snyk, npm audit

---

## 📚 Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

---

## 🚨 Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** create a public GitHub issue
2. Email: security@yourplatform.com (set this up)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours.

---

**Last Updated:** November 20, 2025  
**Security Version:** 1.0.0
