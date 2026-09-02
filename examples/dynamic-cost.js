/**
 * Dynamic Request Cost Example for express-sentinel-limiter
 *
 * Demonstrates charging different token costs based on route or request payload.
 * For instance:
 *  - Lightweight GET endpoints: 1 token
 *  - Write/POST endpoints: 3 tokens
 *  - Heavy AI / Report generation endpoints: 10 tokens
 *
 * Run: node examples/dynamic-cost.js
 */

const http = require('http');
const { createSentinelLimiter } = require('../src/index');

// Rate limiter with 20 total tokens per minute
const dynamicLimiter = createSentinelLimiter({
  limit: 20,
  windowMs: 60 * 1000,
  prefix: 'demo-dynamic-cost',
  // Calculate cost dynamically based on request URL and method
  cost: (req) => {
    const url = req.url || '/';
    if (url.startsWith('/api/heavy-export')) {
      return 10; // Expensive report: consumes 10 tokens
    }
    if (req.method === 'POST' || req.method === 'PUT') {
      return 3;  // Mutations: consume 3 tokens
    }
    return 1;    // Standard read: consumes 1 token
  },
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

  await dynamicLimiter(req, res, () => {
    res.json({
      success: true,
      path: req.url,
      method: req.method,
      rateLimitInfo: {
        limit: req.rateLimit.limit,
        remaining: req.rateLimit.remaining,
      },
    });
  });
});

const PORT = 3002;
server.listen(PORT, () => {
  console.log(`🚀 Dynamic Cost Example running at http://localhost:${PORT}`);
  console.log(`- Standard GET (cost: 1): curl -i http://localhost:${PORT}/api/items`);
  console.log(`- Heavy Export (cost: 10): curl -i http://localhost:${PORT}/api/heavy-export`);
});
