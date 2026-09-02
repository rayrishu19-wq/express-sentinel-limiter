/**
 * Advanced example demonstrating API-key rate limiting, whitelisting & custom 429 response
 * Run: node examples/custom-key.js
 */

const http = require('http');
const { createSentinelLimiter } = require('../src/index');

const limiter = createSentinelLimiter({
  limit: 10,
  windowMs: 60 * 1000, // 10 requests per minute
  prefix: 'api-v1',

  // Rate limit by API key header, or fallback to client IP
  keyGenerator: (req) => {
    const apiKey = req.headers['x-api-key'];
    return apiKey ? `apikey:${apiKey}` : `ip:${req.socket.remoteAddress}`;
  },

  // Skip rate limiting for health check endpoints
  skip: (req) => req.url === '/health',

  // Custom 429 error response format
  onRateLimited: (req, res, next, { limit, remainingTokens, retryAfter }) => {
    res.statusCode = 429;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        status: 'error',
        code: 'RATE_LIMIT_EXCEEDED',
        error: 'Too Many Requests',
        details: {
          quota: limit,
          remaining: remainingTokens,
          retryAfterSeconds: retryAfter,
        },
      })
    );
  },
});

const server = http.createServer(async (req, res) => {
  await limiter(req, res, () => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', endpoint: req.url }));
  });
});

server.listen(3001, () => {
  console.log(`🚀 Advanced API Key Sentinel Limiter running at http://localhost:3001`);
});
