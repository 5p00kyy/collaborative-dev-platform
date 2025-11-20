const rateLimit = require('express-rate-limit');
const { redisClient } = require('../config/redis');

// ============================================
// Rate Limiting Middleware
// ============================================

/**
 * Redis-backed rate limiter store
 */
class RedisStore {
  constructor(options = {}) {
    this.prefix = options.prefix || 'rl:';
    this.resetExpiryOnChange = options.resetExpiryOnChange || false;
  }

  async increment(key) {
    const redisKey = `${this.prefix}${key}`;
    const current = await redisClient.incr(redisKey);
    
    if (current === 1) {
      await redisClient.expire(redisKey, 60); // 60 seconds window
    }
    
    return {
      totalHits: current,
      resetTime: new Date(Date.now() + 60000)
    };
  }

  async decrement(key) {
    const redisKey = `${this.prefix}${key}`;
    await redisClient.decr(redisKey);
  }

  async resetKey(key) {
    const redisKey = `${this.prefix}${key}`;
    await redisClient.del(redisKey);
  }
}

// ============================================
// Rate Limit Configurations
// ============================================

/**
 * General API rate limiter
 * 100 requests per minute
 */
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: {
    success: false,
    message: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:general:' })
});

/**
 * Auth endpoints rate limiter (stricter)
 * 5 requests per minute
 */
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after a minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:auth:' }),
  skipSuccessfulRequests: true // Don't count successful login attempts
});

/**
 * Create operation rate limiter
 * 20 creates per minute
 */
const createLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: {
    success: false,
    message: 'Too many create requests, please slow down'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:create:' })
});

/**
 * Strict rate limiter for sensitive operations
 * 10 requests per 5 minutes
 */
const strictLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  message: {
    success: false,
    message: 'Rate limit exceeded for this operation'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:strict:' })
});

module.exports = {
  generalLimiter,
  authLimiter,
  createLimiter,
  strictLimiter,
  RedisStore
};
