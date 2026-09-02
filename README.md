# 🛡️ express-sentinel-limiter

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/Tests-8%20passed-brightgreen.svg)]()
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0%20runtime-success.svg)]()

> High-throughput, distributed **Token-Bucket rate limiter** middleware for Express.js, powered by atomic **Redis Lua scripts** with automatic zero-downtime in-memory fallback.

---

## ⚡ Why `express-sentinel-limiter`?

Most standard Express rate limiters rely on **Fixed Window counters**. Fixed windows suffer from serious boundary vulnerabilities:

| Algorithm | Traffic Spikes / Boundary Bursting | Distributed Consistency | Resilience |
| :--- | :--- | :--- | :--- |
| **Fixed Window** *(express-rate-limit)* | ❌ **High risk**: Client can burst 2x the limit across adjacent window borders | ⚠️ Prone to race conditions in multi-pod clusters | ❌ Hard dependency on Redis |
| **Token Bucket** *(express-sentinel-limiter)* | ✅ **Smooth**: Continuous refill guarantees strict rate enforcement while allowing controlled bursts | ✅ **Atomic Lua execution**: Zero race conditions across distributed pods | ✅ **Automatic in-memory fallback** if Redis disconnects |

---

## 🏛️ How It Works

```
Client Request
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│               express-sentinel-limiter                      │
│                                                             │
│   Redis Connected?                                          │
│   ├── YES ──► Atomic Lua Evaluation (Single Network Hop)    │
│   └── NO  ──► High-Speed In-Memory Token Bucket             │
└─────────────────────────────────────────────────────────────┘
      │
      ├── [Tokens >= Cost] ──► Decrement & Call next() (Set RFC Headers)
      └── [Tokens < Cost]  ──► 429 Too Many Requests (Retry-After)
```

---

## 📦 Installation

```bash
npm install express-sentinel-limiter
```

*(Optional: If using Redis for multi-instance clusters, install `ioredis`)*
```bash
npm install ioredis
```

---

## 🚀 Quick Start

### 1. Basic In-Memory Limiter (Zero Configuration)
Works out of the box with zero external dependencies — ideal for single-instance apps, development, and testing:

```javascript
const express = require('express');
const { createSentinelLimiter } = require('express-sentinel-limiter');

const app = express();

// Protect all /api routes: 60 requests per minute
const limiter = createSentinelLimiter({
  limit: 60,
  windowMs: 60 * 1000,
});

app.use('/api/', limiter);

app.get('/api/users', (req, res) => {
  res.json({ message: 'Success!', remaining: req.rateLimit.remaining });
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

---

### 2. Distributed Redis Cluster Setup
For production microservices and Kubernetes clusters, pass an existing `ioredis` client. Requests are evaluated **atomically** in Redis via Lua:

```javascript
const express = require('express');
const Redis = require('ioredis');
const { createSentinelLimiter } = require('express-sentinel-limiter');

const app = express();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const apiLimiter = createSentinelLimiter({
  redis,
  limit: 100,
  windowMs: 60 * 1000,
  prefix: 'api-gateway',
  failOpen: true, // Never block users if Redis experiences a temporary network hiccup
});

app.use(apiLimiter);
```

---

## 🛠️ Advanced Usage

### Rate Limiting by API Key or User ID
```javascript
const limiter = createSentinelLimiter({
  limit: 50,
  windowMs: 60 * 1000,
  keyGenerator: (req) => {
    // Limit authenticated users by User ID, otherwise fallback to IP
    return req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`;
  },
});
```

### Whitelisting / Bypassing Internal Endpoints
```javascript
const limiter = createSentinelLimiter({
  limit: 100,
  windowMs: 60 * 1000,
  skip: (req) => {
    // Skip rate limiting for internal health probes
    return req.url === '/health' || req.ip === '10.0.0.1';
  },
});
```

### Custom 429 Response Format
```javascript
const limiter = createSentinelLimiter({
  limit: 20,
  windowMs: 60 * 1000,
  onRateLimited: (req, res, next, { limit, remainingTokens, retryAfter }) => {
    res.status(429).json({
      status: 'error',
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Quota of ${limit} requests exceeded. Try again in ${retryAfter} seconds.`,
      retryAfterSeconds: retryAfter,
    });
  },
});
```

---

## 📋 Standard RFC Response Headers

Every protected request automatically receives standard compliance headers:

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58

HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
Retry-After: 12
Content-Type: application/json
```

---

## ⚙️ Configuration Reference

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `limit` | `number` | `60` | Maximum capacity of the token bucket (max requests per window). |
| `windowMs` | `number` | `60000` | Time window in milliseconds used to calculate continuous refill rate (`limit / (windowMs / 1000)` tokens/sec). |
| `cost` | `number \| (req) => number` | `1` | Tokens consumed per request. |
| `redis` | `ioredis instance` | `null` | Optional Redis client for distributed atomic Lua execution. |
| `prefix` | `string` | `'default'` | Namespace prefix for Redis rate-limiting keys. |
| `keyGenerator` | `(req) => string` | IP-based | Function generating unique client rate-limit key. |
| `skip` | `(req) => boolean` | `null` | Function returning `true` to bypass rate limiting. |
| `onRateLimited` | `Function` | Default JSON | Custom handler invoked when limit is exceeded. |
| `failOpen` | `boolean` | `true` | When `true`, allows requests if an unexpected store error occurs. |
| `setHeaders` | `boolean` | `true` | Whether to append RFC `X-RateLimit-*` headers to responses. |

---

## 🧪 Testing

The package includes an automated integration test suite with 100% native Node.js test runner:

```bash
npm test
```

```
▶ MemoryTokenBucketStore Unit Tests
  ✔ should consume tokens and calculate remaining count
  ✔ should reject requests when tokens are depleted
  ✔ should isolate different keys in separate buckets
✔ MemoryTokenBucketStore Unit Tests
▶ createSentinelLimiter Middleware Tests
  ✔ should allow requests within limit and set RFC headers
  ✔ should return 429 when limit is exceeded
  ✔ should respect skip function for whitelisting
  ✔ should invoke custom onRateLimited handler
  ✔ should validate configuration parameters
✔ createSentinelLimiter Middleware Tests
ℹ tests 8 | pass 8 | fail 0
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 👨‍💻 Author

**Rishu Ray**
* **GitHub**: [@rayrishu19-wq](https://github.com/rayrishu19-wq)
* **Portfolio**: [rayrishu19-wq.github.io/personal-portfolio](https://rayrishu19-wq.github.io/personal-portfolio/)
* **LinkedIn**: [linkedin.com/in/rayrishu19](https://linkedin.com/in/rayrishu19)
