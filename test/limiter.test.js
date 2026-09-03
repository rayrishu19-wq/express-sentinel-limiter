const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  createSentinelLimiter,
  MemoryTokenBucketStore,
  getClientIp,
  defaultKeyGenerator,
  setRateLimitHeaders,
} = require('../src/index');

describe('MemoryTokenBucketStore Unit Tests', () => {
  test('should consume tokens and calculate remaining count', () => {
    const store = new MemoryTokenBucketStore();
    const limit = 5;
    const refillRate = 1; // 1 token per second

    const r1 = store.consume('user-1', limit, refillRate, 1);
    assert.equal(r1.allowed, true);
    assert.equal(r1.remainingTokens, 4);

    const r2 = store.consume('user-1', limit, refillRate, 1);
    assert.equal(r2.allowed, true);
    assert.equal(r2.remainingTokens, 3);
  });

  test('should reject requests when tokens are depleted', () => {
    const store = new MemoryTokenBucketStore();
    const limit = 2;
    const refillRate = 0.5;

    store.consume('user-2', limit, refillRate, 1); // remaining 1
    store.consume('user-2', limit, refillRate, 1); // remaining 0

    const blocked = store.consume('user-2', limit, refillRate, 1);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfter > 0);
  });

  test('should isolate different keys in separate buckets', () => {
    const store = new MemoryTokenBucketStore();
    const limit = 3;
    const refillRate = 1;

    store.consume('client-A', limit, refillRate, 3); // client-A empty
    const resA = store.consume('client-A', limit, refillRate, 1);
    assert.equal(resA.allowed, false);

    // client-B should still have full quota
    const resB = store.consume('client-B', limit, refillRate, 1);
    assert.equal(resB.allowed, true);
    assert.equal(resB.remainingTokens, 2);
  });
});

describe('createSentinelLimiter Middleware Tests', () => {
  // Helper to create mock Express req/res objects
  function createMockContext(ip = '127.0.0.1', headers = {}) {
    const req = {
      ip,
      headers,
      socket: { remoteAddress: ip },
      url: '/test',
    };

    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) {
        this.headers[name.toLowerCase()] = String(value);
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
      end(data) {
        this.ended = true;
        this.data = data;
      },
    };

    return { req, res };
  }

  test('should allow requests within limit and set RFC headers', async () => {
    const limiter = createSentinelLimiter({
      limit: 3,
      windowMs: 10000,
      prefix: 'test-rfc',
    });

    const { req, res } = createMockContext('1.1.1.1');
    let nextCalled = false;

    await limiter(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(res.headers['x-ratelimit-limit'], '3');
    assert.equal(res.headers['x-ratelimit-remaining'], '2');
    assert.equal(req.rateLimit.allowed, true);
    assert.equal(req.rateLimit.remaining, 2);
  });

  test('should return 429 when limit is exceeded', async () => {
    const limiter = createSentinelLimiter({
      limit: 2,
      windowMs: 10000,
      prefix: 'test-block',
    });

    const { req: r1, res: s1 } = createMockContext('2.2.2.2');
    const { req: r2, res: s2 } = createMockContext('2.2.2.2');
    const { req: r3, res: s3 } = createMockContext('2.2.2.2');

    let nextCount = 0;
    await limiter(r1, s1, () => nextCount++);
    await limiter(r2, s2, () => nextCount++);
    await limiter(r3, s3, () => nextCount++);

    assert.equal(nextCount, 2, 'Only 2 requests should have called next()');
    assert.equal(s3.statusCode, 429);
    assert.equal(s3.body.error, 'Too Many Requests');
    assert.ok(s3.headers['retry-after']);
  });

  test('should respect skip function for whitelisting', async () => {
    const limiter = createSentinelLimiter({
      limit: 1,
      windowMs: 10000,
      skip: (req) => req.headers['x-internal'] === 'true',
      prefix: 'test-skip',
    });

    const { req: r1, res: s1 } = createMockContext('3.3.3.3', { 'x-internal': 'true' });
    const { req: r2, res: s2 } = createMockContext('3.3.3.3', { 'x-internal': 'true' });

    let count = 0;
    await limiter(r1, s1, () => count++);
    await limiter(r2, s2, () => count++);

    assert.equal(count, 2, 'Whitelisted requests should bypass rate limiting');
  });

  test('should invoke custom onRateLimited handler', async () => {
    let customHandlerCalled = false;

    const limiter = createSentinelLimiter({
      limit: 1,
      windowMs: 10000,
      prefix: 'test-custom-handler',
      onRateLimited: (req, res, next, info) => {
        customHandlerCalled = true;
        res.status(429).json({ custom: true, quota: info.limit });
      },
    });

    const { req: r1, res: s1 } = createMockContext('4.4.4.4');
    const { req: r2, res: s2 } = createMockContext('4.4.4.4');

    await limiter(r1, s1, () => {});
    await limiter(r2, s2, () => {});

    assert.equal(customHandlerCalled, true);
    assert.equal(s2.body.custom, true);
  });

  test('should validate configuration parameters', () => {
    assert.throws(() => {
      createSentinelLimiter({ limit: -5 });
    }, /must be a positive number/);

    assert.throws(() => {
      createSentinelLimiter({ windowMs: 0 });
    }, /must be a positive number/);
  });

  test('should send standard IETF draft headers when standardHeaders is enabled', async () => {
    const limiter = createSentinelLimiter({
      limit: 5,
      windowMs: 60000,
      prefix: 'test-standard-headers',
      standardHeaders: true,
      legacyHeaders: false,
    });

    const { req, res } = createMockContext('5.5.5.5');
    let nextCalled = false;

    await limiter(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(res.headers['ratelimit-limit'], '5');
    assert.equal(res.headers['ratelimit-remaining'], '4');
    assert.equal(res.headers['ratelimit-reset'], '0');
    assert.equal(res.headers['x-ratelimit-limit'], undefined);
    assert.equal(res.headers['x-ratelimit-remaining'], undefined);
  });

  test('should export utility functions from package entrypoint', () => {
    assert.equal(typeof getClientIp, 'function');
    assert.equal(typeof defaultKeyGenerator, 'function');
    assert.equal(typeof setRateLimitHeaders, 'function');
  });

  test('should attach store reference and allow programmatic resetKey()', async () => {
    const limiter = createSentinelLimiter({
      limit: 1,
      windowMs: 60000,
      prefix: 'test-reset',
    });

    assert.ok(limiter.store instanceof MemoryTokenBucketStore);
    assert.equal(typeof limiter.resetKey, 'function');

    const { req: r1, res: s1 } = createMockContext('9.9.9.9');
    const { req: r2, res: s2 } = createMockContext('9.9.9.9');

    // First request passes
    await limiter(r1, s1, () => {});
    assert.equal(r1.rateLimit.allowed, true);

    // Second request is blocked
    await limiter(r2, s2, () => {});
    assert.equal(s2.statusCode, 429);

    // Reset key for this IP
    const key = defaultKeyGenerator(r1, 'test-reset');
    await limiter.resetKey(key);

    // Third request passes after reset
    const { req: r3, res: s3 } = createMockContext('9.9.9.9');
    let nextRan = false;
    await limiter(r3, s3, () => {
      nextRan = true;
    });
    assert.equal(nextRan, true);
    assert.equal(r3.rateLimit.allowed, true);
  });
});
