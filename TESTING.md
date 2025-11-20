# Testing Guide

## Overview

The Collaborative Dev Platform uses **Jest** for unit and integration testing, with a complete CI/CD pipeline via **GitHub Actions**.

## Quick Start

```bash
# Install dependencies
cd backend && npm install

# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- tests/unit/auth.test.js

# Run tests in watch mode
npm test -- --watch
```

## Test Structure

```
backend/tests/
├── helpers/
│   └── db-setup.js          # Database test utilities
├── unit/
│   └── auth.test.js         # Unit tests for auth
├── integration/             # Integration tests (TBD)
└── setup.js                 # Jest global setup
```

## Test Database Setup

### Local Testing

1. Create test database:
```bash
psql -U postgres
CREATE DATABASE platform_db_test;
\q
```

2. Set environment variables (`.env.test`):
```env
NODE_ENV=test
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=platform_db_test
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=test-secret-key
JWT_REFRESH_SECRET=test-refresh-secret
```

3. Initialize schema:
```bash
PGPASSWORD=postgres psql -h localhost -U postgres -d platform_db_test -f ../database/schema.sql
```

### CI/CD Testing

GitHub Actions automatically:
- Spins up PostgreSQL 15 and Redis 7 containers
- Initializes the test database
- Runs all tests with coverage
- Uploads coverage reports to Codecov

## Writing Tests

### Test Helpers

Use the provided test helpers in `tests/helpers/db-setup.js`:

```javascript
const {
  setupTestDB,
  cleanDatabase,
  closeDatabase,
  createTestUser,
  createTestProject,
  createTestNote,
  createTestTicket
} = require('../helpers/db-setup');

describe('My Feature', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('should work', async () => {
    const user = await createTestUser();
    const project = await createTestProject(user.id);
    // ... test logic
  });
});
```

### Mock Redis

Redis is mocked in tests to avoid external dependencies:

```javascript
jest.mock('../../src/config/redis', () => ({
  setRedis: jest.fn(),
  getRedis: jest.fn(),
  deleteRedis: jest.fn()
}));
```

### Example Test

```javascript
const request = require('supertest');
const express = require('express');

it('should register a new user', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      username: 'testuser',
      email: 'test@example.com',
      password: 'Test123!',
      displayName: 'Test User'
    })
    .expect(201);

  expect(response.body.success).toBe(true);
  expect(response.body.data.user.email).toBe('test@example.com');
});
```

## Coverage Goals

Current coverage thresholds (defined in `jest.config.js`):

- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

## CI/CD Pipeline

### Workflow: `.github/workflows/ci.yml`

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

**Jobs:**

1. **test** - Run backend tests
   - PostgreSQL 15 service
   - Redis 7 service
   - Node.js 18
   - Run Jest with coverage
   - Upload to Codecov

2. **lint-frontend** - Validate HTML/CSS
   - HTML5 validator
   - CSS validation

3. **security** - Security audit
   - npm audit (moderate+ vulnerabilities)

4. **build-docker** - Build Docker image
   - Runs after all tests pass
   - Uses Docker Buildx with caching

### Status Badges

Add to your README:

```markdown
![CI Status](https://github.com/5p00kyy/collaborative-dev-platform/workflows/CI%20Pipeline/badge.svg)
[![codecov](https://codecov.io/gh/5p00kyy/collaborative-dev-platform/branch/main/graph/badge.svg)](https://codecov.io/gh/5p00kyy/collaborative-dev-platform)
```

## Running Specific Test Types

### Unit Tests Only

```bash
npm test -- tests/unit/
```

### Integration Tests Only

```bash
npm test -- tests/integration/
```

### With Verbose Output

```bash
npm test -- --verbose
```

### Update Snapshots

```bash
npm test -- -u
```

## Debugging Tests

### VSCode Launch Configuration

Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Jest Current File",
      "program": "${workspaceFolder}/backend/node_modules/.bin/jest",
      "args": [
        "${fileBasename}",
        "--config=${workspaceFolder}/backend/jest.config.js",
        "--runInBand"
      ],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### Enable Debug Logs

```bash
DEBUG=* npm test
```

## Common Issues

### Database Connection Errors

**Problem**: Tests fail with `ECONNREFUSED` or `database does not exist`

**Solution**:
1. Ensure PostgreSQL is running: `pg_isready`
2. Create test database: `createdb platform_db_test`
3. Check `.env.test` credentials

### Redis Connection Errors

**Problem**: Redis mock not working

**Solution**: Ensure the mock is defined **before** importing the module that uses Redis:

```javascript
jest.mock('../../src/config/redis'); // Before imports
const authRouter = require('../../src/routes/api/auth');
```

### Schema Initialization Fails

**Problem**: `relation "users" does not exist`

**Solution**: Run schema initialization:
```bash
PGPASSWORD=postgres psql -h localhost -U postgres -d platform_db_test -f database/schema.sql
```

### UUID vs Integer IDs

**Problem**: Tests expect integer IDs but database uses UUIDs

**Solution**: Test helpers automatically map `user_id` → `id` in returned objects

## Best Practices

1. **Isolate Tests**: Each test should be independent
2. **Clean State**: Use `cleanDatabase()` before each test
3. **Mock External Services**: Mock Redis, S3, email services
4. **Use Factories**: Use test helpers for consistent test data
5. **Test Edge Cases**: Invalid inputs, missing data, permissions
6. **Meaningful Assertions**: Test behavior, not implementation
7. **Fast Tests**: Keep tests under 10 seconds total

## Roadmap

- [ ] Integration tests for API endpoints
- [ ] E2E tests with Playwright
- [ ] Performance testing
- [ ] Load testing with k6
- [ ] Visual regression testing
- [ ] Mutation testing
- [ ] Contract testing for APIs

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Docs](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
