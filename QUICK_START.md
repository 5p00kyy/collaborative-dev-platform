# Quick Start Guide

Get the Collaborative Development Platform running in 5 minutes!

## Option 1: Docker (Recommended - Fastest)

### Prerequisites
- Docker
- Docker Compose

### Steps
```bash
# 1. Clone repository (once pushed to GitHub)
git clone <your-repo-url>
cd platform

# 2. Configure environment
cd docker
cp .env.example .env
# Edit .env and add your JWT secrets:
# JWT_SECRET=<generate with: openssl rand -hex 64>
# JWT_REFRESH_SECRET=<generate with: openssl rand -hex 64>

# 3. Start everything
docker-compose up

# 4. Access the application
# Frontend: http://localhost:8080
# Backend:  http://localhost:3000
# Health:   http://localhost:3000/health
```

That's it! The entire stack is running.

## Option 2: Manual Setup

### Prerequisites
- Node.js >= 18
- PostgreSQL >= 14
- Redis >= 6

### Steps

**1. Install Dependencies**
```bash
cd backend
npm install
```

**2. Configure Environment**
```bash
cp .env.example .env
# Edit .env with your database credentials and JWT secrets
```

**3. Setup Database**
```bash
# Create database
createdb platform_db

# Run schema
psql -U postgres -d platform_db -f ../database/schema.sql

# (Optional) Load sample data
psql -U postgres -d platform_db -f ../database/seeds/sample_data.sql
```

**4. Start Services**
```bash
# Terminal 1: Start Redis
redis-server

# Terminal 2: Start Backend
cd backend
npm run dev

# Terminal 3: Start Frontend
cd frontend
python -m http.server 8080
```

**5. Access Application**
- Frontend: http://localhost:8080/pages/index.html
- Backend: http://localhost:3000
- Health Check: http://localhost:3000/health

## Verify Installation

### Check Backend Health
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

### Check API Endpoints
```bash
curl http://localhost:3000/api
```

Expected response:
```json
{
  "name": "Collaborative Dev Platform API",
  "version": "0.1.0",
  "status": "active"
}
```

## Development Workflow

### Making Changes

**Backend:**
- Edit files in `backend/src/`
- Server auto-restarts (nodemon)
- Check logs in terminal

**Frontend:**
- Edit files in `frontend/`
- Refresh browser to see changes

**Database:**
- Create migration in `database/migrations/`
- Run: `psql -U postgres -d platform_db -f migration.sql`

### Running Tests
```bash
cd backend
npm test
```

## Common Commands

```bash
# View logs (Docker)
docker-compose -f docker/docker-compose.yml logs -f

# Stop all services (Docker)
docker-compose -f docker/docker-compose.yml down

# Rebuild (Docker)
docker-compose -f docker/docker-compose.yml up --build

# Reset database
psql -U postgres -c "DROP DATABASE platform_db;"
psql -U postgres -c "CREATE DATABASE platform_db;"
psql -U postgres -d platform_db -f database/schema.sql

# Clean restart
npm install
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

1. ✅ Platform is running
2. 📖 Read [SETUP.md](docs/SETUP.md) for detailed configuration
3. 🏗️ Read [ARCHITECTURE.md](docs/ARCHITECTURE.md) to understand the system
4. 🚀 Start building Phase 1 features!

## Troubleshooting

### Port Already in Use
```bash
# Check what's using port 3000
lsof -i :3000
# Kill it
kill -9 <PID>
```

### Database Connection Failed
- Verify PostgreSQL is running: `pg_isready`
- Check credentials in `.env`
- Ensure database exists: `psql -l`

### Redis Connection Failed
- Verify Redis is running: `redis-cli ping`
- Start Redis: `redis-server`

### Docker Issues
```bash
# Clean everything
docker-compose -f docker/docker-compose.yml down -v
docker system prune -a

# Rebuild
docker-compose -f docker/docker-compose.yml up --build
```

## Getting Help

- Check [SETUP.md](docs/SETUP.md) for detailed setup
- Review [PROJECT_STATUS.md](PROJECT_STATUS.md) for current state
- Check logs for error messages
- Test health endpoint: `/health`

---

**Ready to build?** Start with the authentication system in Phase 1!
