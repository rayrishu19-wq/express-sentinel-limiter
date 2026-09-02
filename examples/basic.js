/**
 * Basic Express example using express-sentinel-limiter
 * Run: node examples/basic.js
 */

const http = require('http');
const { createSentinelLimiter } = require('../src/index');

// Create a rate limiter: 5 requests per 10 seconds
const limiter = createSentinelLimiter({
  limit: 5,
  windowMs: 10 * 1000,
  prefix: 'demo-basic',
});

// Simple HTTP handler demonstrating middleware compatibility
const server = http.createServer(async (req, res) => {
  // Polyfill simple JSON sender
  res.json = (data) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data, null, 2));
  };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };

  // Run limiter middleware
  await limiter(req, res, () => {
    res.json({
      success: true,
      message: 'Hello from rate-protected API!',
      tokensRemaining: req.rateLimit.remaining,
    });
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Sentinel Limiter Basic Example running at http://localhost:${PORT}`);
  console.log(`Try making 6 requests: curl -i http://localhost:${PORT}`);
});
