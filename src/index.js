const fs = require('fs');
const path = require('path');
const { MemoryTokenBucketStore } = require('./memoryStore');
const { getClientIp, defaultKeyGenerator, setRateLimitHeaders } = require('./utils');

// Load atomic Lua script once at module initialization
const LUA_TOKEN_BUCKET = fs.readFileSync(
  path.join(__dirname, 'tokenBucket.lua'),
  'utf-8'
);

/**
 * Creates an Express middleware that enforces Token Bucket rate limiting
 * via Redis (atomic Lua script) with automatic in-memory fallback.
 *
 * @param {Object} options Configuration options
 * @param {number} [options.limit=60] Max requests allowed per window (bucket capacity)
 * @param {number} [options.windowMs=60000] Time window in milliseconds (used to calculate continuous refill rate)
 * @param {number|Function} [options.cost=1] Tokens consumed per request (or function returning a number)
 * @param {Object} [options.redis] ioredis client instance (optional)
 * @param {string} [options.prefix='default'] Namespace prefix for Redis keys
 * @param {Function} [options.keyGenerator] Function to extract/generate client key: (req) => string
 * @param {Function} [options.skip] Optional function returning true to skip rate limiting: (req) => boolean
 * @param {Function} [options.onRateLimited] Custom 429 handler: (req, res, next, info) => void
 * @param {boolean} [options.failOpen=true] If true, allows traffic if store encounters an unhandled error
 * @param {boolean} [options.setHeaders=true] Whether to set rate limit headers
 * @param {boolean} [options.legacyHeaders=true] Whether to send X-RateLimit-* legacy headers
 * @param {boolean} [options.standardHeaders=false] Whether to send RateLimit-* (IETF draft) headers
 * @returns {Function} Express middleware (req, res, next)
 */
function createSentinelLimiter(options = {}) {
  const {
    limit = 60,
    windowMs = 60 * 1000,
    cost: costOption = 1,
    redis = null,
    prefix = 'default',
    keyGenerator = (req) => defaultKeyGenerator(req, prefix),
    skip = null,
    onRateLimited = null,
    failOpen = true,
    setHeaders = true,
    legacyHeaders = true,
    standardHeaders = false,
  } = options;

  if (typeof limit !== 'number' || limit <= 0) {
    throw new TypeError('express-sentinel-limiter: "limit" must be a positive number');
  }

  if (typeof windowMs !== 'number' || windowMs <= 0) {
    throw new TypeError('express-sentinel-limiter: "windowMs" must be a positive number');
  }

  // Calculate continuous refill rate in tokens per second
  const windowSec = windowMs / 1000;
  const refillRate = limit / windowSec;

  // Shared in-memory fallback store
  const memoryStore = new MemoryTokenBucketStore();

  async function sentinelLimiterMiddleware(req, res, next) {
    // Check if request should bypass rate limiting
    if (typeof skip === 'function') {
      try {
        if (await skip(req)) {
          return next();
        }
      } catch (skipErr) {
        // If skip check fails, continue with rate limiting
      }
    }

    const key = keyGenerator(req);
    const nowSec = Date.now() / 1000;
    const cost = typeof costOption === 'function' ? Number(costOption(req)) || 1 : costOption;

    let allowed = false;
    let remainingTokens = 0;
    let retryAfter = 0;

    // Check if Redis is provided and operational
    const hasRedis = redis && typeof redis.eval === 'function' && redis.status === 'ready';

    if (hasRedis) {
      try {
        const result = await redis.eval(
          LUA_TOKEN_BUCKET,
          1,
          key,
          limit.toString(),
          refillRate.toString(),
          nowSec.toString(),
          cost.toString()
        );

        allowed = result[0] === 1;
        remainingTokens = result[1];
        retryAfter = result[2] || 0;
      } catch (redisErr) {
        // Fall back seamlessly to in-memory store if Redis encounters an error
        const memResult = memoryStore.consume(key, limit, refillRate, cost);
        allowed = memResult.allowed;
        remainingTokens = memResult.remainingTokens;
        retryAfter = memResult.retryAfter;
      }
    } else {
      // In-memory token bucket evaluation
      const memResult = memoryStore.consume(key, limit, refillRate, cost);
      allowed = memResult.allowed;
      remainingTokens = memResult.remainingTokens;
      retryAfter = memResult.retryAfter;
    }

    // Attach rate limit info to request for downstream handlers
    req.rateLimit = {
      limit,
      remaining: remainingTokens,
      retryAfter,
      allowed,
    };

    // Set standard RFC rate limit headers
    if (setHeaders) {
      setRateLimitHeaders(res, limit, remainingTokens, retryAfter, {
        legacyHeaders,
        standardHeaders,
      });
    }

    if (allowed) {
      return next();
    }

    // Rate limit exceeded (429)
    if (typeof onRateLimited === 'function') {
      return onRateLimited(req, res, next, {
        limit,
        remainingTokens,
        retryAfter,
      });
    }

    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit of ${limit} requests per ${windowSec}s exceeded. Please retry in ${retryAfter}s.`,
      retryAfterSeconds: retryAfter,
    });
  };

  // Expose underlying in-memory store reference
  sentinelLimiterMiddleware.store = memoryStore;

  // Programmatic key reset helper for testing or admin unblock workflows
  sentinelLimiterMiddleware.resetKey = async function resetKey(key) {
    if (!key) return;
    if (redis && typeof redis.del === 'function' && redis.status === 'ready') {
      try {
        await redis.del(key);
      } catch (err) {
        // Ignore redis del error on manual cleanup
      }
    }
    memoryStore.reset(key);
  };

  return sentinelLimiterMiddleware;
}

module.exports = {
  createSentinelLimiter,
  MemoryTokenBucketStore,
  getClientIp,
  defaultKeyGenerator,
  setRateLimitHeaders,
};
