const request = require('supertest');
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const authRouter = require('../../src/routes/api/auth');
const { pool } = require('../../src/config/database');
const { setRedis, getRedis, deleteRedis } = require('../../src/config/redis');
const {
  setupTestDB,
  cleanDatabase,
  closeDatabase,
  createTestUser
} = require('../helpers/db-setup');

// Mock Redis
jest.mock('../../src/config/redis', () => ({
  setRedis: jest.fn(),
  getRedis: jest.fn(),
  deleteRedis: jest.fn()
}));

// Setup Express app for testing
const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

// ====== Test Suite ======

describe('Auth API', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  beforeEach(async () => {
    await cleanDatabase();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  // ====== Registration Tests ======

  describe('POST /api/auth/register', () => {
    const validUserData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Test123!',
      displayName: 'Test User'
    };

    it('should register a new user successfully', async () => {
      setRedis.mockResolvedValue('OK');

      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.data.user).toMatchObject({
        username: 'testuser',
        email: 'test@example.com',
        displayName: 'Test User'
      });
      expect(response.body.data.user.userId).toBeDefined();
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();

      // Verify Redis was called to store refresh token
      expect(setRedis).toHaveBeenCalledWith(
        expect.stringMatching(/^refresh_token:/),
        expect.any(String),
        expect.any(Number)
      );
    });

    it('should reject registration with invalid username', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...validUserData, username: 'ab' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors).toBeDefined();
    });

    it('should reject registration with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...validUserData, email: 'invalid-email' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...validUserData, password: 'weak' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should reject duplicate email', async () => {
      await createTestUser({ email: 'test@example.com' });

      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    it('should reject duplicate username', async () => {
      await createTestUser({ username: 'testuser' });

      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    it('should use username as displayName if not provided', async () => {
      setRedis.mockResolvedValue('OK');
      const { displayName, ...userWithoutDisplayName } = validUserData;

      const response = await request(app)
        .post('/api/auth/register')
        .send(userWithoutDisplayName)
        .expect(201);

      expect(response.body.data.user.displayName).toBe('testuser');
    });
  });

  // ====== Login Tests ======

  describe('POST /api/auth/login', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await createTestUser({
        email: 'test@example.com',
        username: 'testuser'
      });
    });

    it('should login successfully with valid credentials', async () => {
      setRedis.mockResolvedValue('OK');

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123!'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data.user).toMatchObject({
        userId: testUser.id,
        username: 'testuser',
        email: 'test@example.com'
      });
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();

      // Verify Redis was called
      expect(setRedis).toHaveBeenCalled();
    });

    it('should reject login with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrong@example.com',
          password: 'Test123!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid email or password');
    });

    it('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid email or password');
    });

    it('should reject login with missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should update last_login timestamp on successful login', async () => {
      setRedis.mockResolvedValue('OK');

      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123!'
        })
        .expect(200);

      // Verify last_login was updated
      const result = await pool.query(
        'SELECT last_login FROM users WHERE id = $1',
        [testUser.id]
      );

      expect(result.rows[0].last_login).not.toBeNull();
    });
  });

  // ====== Logout Tests ======

  describe('POST /api/auth/logout', () => {
    let testUser;
    let accessToken;

    beforeEach(async () => {
      testUser = await createTestUser();
      accessToken = jwt.sign(
        { userId: testUser.id, email: testUser.email, username: testUser.username },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '15m' }
      );
    });

    it('should logout successfully with valid token', async () => {
      deleteRedis.mockResolvedValue(1);

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logout successful');

      // Verify Redis delete was called
      expect(deleteRedis).toHaveBeenCalledWith(`refresh_token:${testUser.id}`);
    });

    it('should reject logout without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No token provided');
    });

    it('should reject logout with invalid token format', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'InvalidFormat')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  // ====== Refresh Token Tests ======

  describe('POST /api/auth/refresh', () => {
    let testUser;
    let refreshToken;

    beforeEach(async () => {
      testUser = await createTestUser();
      refreshToken = jwt.sign(
        { userId: testUser.id, email: testUser.email, username: testUser.username },
        process.env.JWT_REFRESH_SECRET || 'test-refresh-secret',
        { expiresIn: '7d' }
      );
    });

    it('should refresh token successfully', async () => {
      getRedis.mockResolvedValue(refreshToken);
      setRedis.mockResolvedValue('OK');

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Token refreshed successfully');
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();

      // Verify new token was stored in Redis
      expect(setRedis).toHaveBeenCalled();
    });

    it('should reject refresh without token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Refresh token is required');
    });

    it('should reject refresh with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid or expired');
    });

    it('should reject refresh with token not in Redis', async () => {
      getRedis.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid or expired');
    });

    it('should reject refresh with mismatched token', async () => {
      getRedis.mockResolvedValue('different-token');

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid or expired');
    });
  });
});
