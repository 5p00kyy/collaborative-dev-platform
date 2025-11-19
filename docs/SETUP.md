# Setup Guide

Complete guide to setting up the Collaborative Development Platform for local development.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (>= 18.0.0) - [Download](https://nodejs.org/)
- **npm** (>= 9.0.0) - Comes with Node.js
- **PostgreSQL** (>= 14) - [Download](https://www.postgresql.org/download/)
- **Redis** (>= 6.0) - [Download](https://redis.io/download)
- **Git** - [Download](https://git-scm.com/)

### Verify Installation

```bash
node --version  # Should be >= 18.0.0
npm --version   # Should be >= 9.0.0
psql --version  # Should be >= 14
redis-server --version  # Should be >= 6.0
```

## Step-by-Step Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd platform
```

### 2. Backend Setup

#### Install Dependencies

```bash
cd backend
npm install
```

#### Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Server
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=platform_db
DB_USER=postgres
DB_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Authentication
JWT_SECRET=generate_random_secret_here
JWT_REFRESH_SECRET=generate_random_refresh_secret_here

# Cloud Storage (Optional for development)
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
AWS_BUCKET=platform-dev
```

**Generate Secure Secrets:**
```bash
# Generate JWT secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Database Setup

#### Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE platform_db;

# Exit psql
\q
```

#### Run Schema Migration

```bash
# From project root
psql -U postgres -d platform_db -f database/schema.sql
```

#### (Optional) Load Sample Data

```bash
psql -U postgres -d platform_db -f database/seeds/sample_data.sql
```

#### Verify Database

```bash
psql -U postgres -d platform_db

\dt  # List all tables
\d users  # Describe users table
```

### 4. Redis Setup

#### Start Redis Server

**Linux/Mac:**
```bash
redis-server
```

**Windows:**
```bash
# Use WSL or download Windows build
redis-server.exe
```

#### Verify Redis

```bash
redis-cli ping
# Should return: PONG
```

### 5. Start Backend Server

```bash
cd backend
npm run dev
```

You should see:
```
✓ Database connected
✓ Redis connected
╔════════════════════════════════════════════════╗
║   Collaborative Dev Platform - Backend API     ║
╠════════════════════════════════════════════════╣
║   Environment: DEVELOPMENT                     ║
║   Server:      http://localhost:3000           ║
║   Status:      Running ✓                       ║
╚════════════════════════════════════════════════╝
```

#### Test API

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-20T...",
  "uptime": 5.123,
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

### 6. Frontend Setup

The frontend uses vanilla JavaScript and Bootstrap, so no build step is needed.

#### Serve Frontend

**Option 1: Python HTTP Server**
```bash
cd frontend
python -m http.server 8080
```

**Option 2: Node.js http-server**
```bash
npm install -g http-server
cd frontend
http-server -p 8080
```

**Option 3: VS Code Live Server**
- Install "Live Server" extension
- Right-click on `frontend/pages/index.html`
- Select "Open with Live Server"

#### Access Frontend

Open browser to: http://localhost:8080/pages/index.html

## Development Workflow

### Running the Full Stack

**Terminal 1 - PostgreSQL:**
```bash
# Usually runs as a service, check status:
sudo service postgresql status
```

**Terminal 2 - Redis:**
```bash
redis-server
```

**Terminal 3 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 4 - Frontend:**
```bash
cd frontend
python -m http.server 8080
```

### Hot Reload

The backend uses `nodemon` for automatic reloading when files change. Just edit and save!

Frontend updates automatically when you refresh the browser.

## Database Management

### Create a Migration

```bash
# Create new migration file
touch database/migrations/002_add_feature.sql
```

### Reset Database

```bash
# Drop and recreate
psql -U postgres -c "DROP DATABASE platform_db;"
psql -U postgres -c "CREATE DATABASE platform_db;"
psql -U postgres -d platform_db -f database/schema.sql
```

### Backup Database

```bash
pg_dump -U postgres platform_db > backup.sql
```

### Restore Database

```bash
psql -U postgres platform_db < backup.sql
```

## Troubleshooting

### Port Already in Use

**Backend (3000):**
```bash
# Find process
lsof -i :3000
# Kill process
kill -9 <PID>
```

**Frontend (8080):**
```bash
# Use different port
python -m http.server 8081
```

### Database Connection Failed

1. Check PostgreSQL is running:
   ```bash
   sudo service postgresql status
   ```

2. Verify credentials in `.env`

3. Check PostgreSQL logs:
   ```bash
   tail -f /var/log/postgresql/postgresql-14-main.log
   ```

### Redis Connection Failed

1. Check Redis is running:
   ```bash
   redis-cli ping
   ```

2. Start Redis:
   ```bash
   redis-server
   ```

### npm Install Errors

1. Clear npm cache:
   ```bash
   npm cache clean --force
   ```

2. Delete node_modules and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

## Testing

### Run Tests

```bash
cd backend
npm test
```

### Run Tests with Coverage

```bash
npm run test -- --coverage
```

## Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| NODE_ENV | Environment mode | No | development |
| PORT | Backend server port | No | 3000 |
| DB_HOST | PostgreSQL host | Yes | localhost |
| DB_PORT | PostgreSQL port | No | 5432 |
| DB_NAME | Database name | Yes | platform_db |
| DB_USER | Database user | Yes | postgres |
| DB_PASSWORD | Database password | Yes | - |
| REDIS_HOST | Redis host | No | localhost |
| REDIS_PORT | Redis port | No | 6379 |
| JWT_SECRET | Access token secret | Yes | - |
| JWT_REFRESH_SECRET | Refresh token secret | Yes | - |
| JWT_EXPIRY | Access token expiry | No | 15m |
| JWT_REFRESH_EXPIRY | Refresh token expiry | No | 7d |

## Next Steps

1. Read the [Architecture Documentation](ARCHITECTURE.md)
2. Explore the [API Documentation](API.md)
3. Check out the development roadmap in [README.md](../README.md)
4. Start building Phase 1 features!

## Getting Help

- Check existing issues on GitHub
- Review documentation in `/docs`
- Check server logs for errors
- Use health check endpoint: `/health`
