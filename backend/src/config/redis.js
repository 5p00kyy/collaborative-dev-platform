const redis = require('redis');

// Create Redis client
const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  password: process.env.REDIS_PASSWORD || undefined,
  database: 0,
});

// Error handling
redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

redisClient.on('connect', () => {
  console.log('Redis connection established');
});

redisClient.on('ready', () => {
  console.log('Redis client ready');
});

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
  }
})();

// Helper functions for common Redis operations
const redisHelpers = {
  // Set with expiration
  setEx: async (key, value, expirationInSeconds) => {
    try {
      await redisClient.setEx(key, expirationInSeconds, JSON.stringify(value));
    } catch (error) {
      console.error('Redis setEx error:', error);
      throw error;
    }
  },

  // Get and parse JSON
  get: async (key) => {
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      throw error;
    }
  },

  // Delete key
  del: async (key) => {
    try {
      await redisClient.del(key);
    } catch (error) {
      console.error('Redis del error:', error);
      throw error;
    }
  },

  // Check if key exists
  exists: async (key) => {
    try {
      return await redisClient.exists(key);
    } catch (error) {
      console.error('Redis exists error:', error);
      throw error;
    }
  },

  // Increment counter
  incr: async (key) => {
    try {
      return await redisClient.incr(key);
    } catch (error) {
      console.error('Redis incr error:', error);
      throw error;
    }
  },

  // Add to set
  sadd: async (key, ...members) => {
    try {
      return await redisClient.sAdd(key, members);
    } catch (error) {
      console.error('Redis sadd error:', error);
      throw error;
    }
  },

  // Get all members of a set
  smembers: async (key) => {
    try {
      return await redisClient.sMembers(key);
    } catch (error) {
      console.error('Redis smembers error:', error);
      throw error;
    }
  },

  // Remove from set
  srem: async (key, ...members) => {
    try {
      return await redisClient.sRem(key, members);
    } catch (error) {
      console.error('Redis srem error:', error);
      throw error;
    }
  }
};

module.exports = {
  redisClient,
  ...redisHelpers
};
