/**
 * Redis Connection & Resilience Example for express-sentinel-limiter
 *
 * Demonstrates:
 * 1. Initializing the limiter with an ioredis client (or cluster).
 * 2. Automatic, zero-downtime fallback to the high-speed in-memory store
 *    if Redis disconnects or encounters network partitions.
 *
 * Run: node examples/redis-cluster.js
 */

const http = require('http');
const { createSentinelLimiter } = require('../src/index');

// Example mock or real ioredis setup
let redisClient = null;

try {
  const Redis = require('ioredis');
  redisClient = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    enableOfflineQueue: false, // Prevents queuing when disconnected
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => Math.min(times * 100, 3000),
  });

  redisClient.on('connect', () => {
    console.log('✅ Redis connected: Using atomic Lua distributed rate limiter');
  });

  redisClient.on('error', (err) => {
    console.warn('⚠️  Redis unreachable: express-sentinel-limiter automatically falls back to in-memory store');
  });
} catch (e) {
  console.log('ℹ️  ioredis not installed: defaulting to built-in in-memory fallback store.');
}

const limiter = createSentinelLimiter({
  limit: 10,
  windowMs: 60 * 1000,
  redis: redisClient,
  prefix: 'resilient-cluster-api',
  failOpen: true, // Guarantees traffic is never blocked on store errors
});

const server = http.createServer(async (req, res) => {
  res.json = (data) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data, null, 2));
  };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };

  await limiter(req, res, () => {
    res.json({
      success: true,
      message: 'Request served with resilient rate limit protection.',
      storeMode: (redisClient && redisClient.status === 'ready') ? 'Redis (Distributed Lua)' : 'In-Memory Fallback',
      remaining: req.rateLimit.remaining,
    });
  });
});

const PORT = 3003;
server.listen(PORT, () => {
  console.log(`🚀 Redis Resilience Example running at http://localhost:${PORT}`);
});
