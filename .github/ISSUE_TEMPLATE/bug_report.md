---
name: '🐛 Bug report'
about: Create a detailed bug report to help us improve express-sentinel-limiter
title: '[BUG] '
labels: ['bug']
assignees: ''

---

> [!IMPORTANT]
> Please review our [Contributing Guidelines](https://github.com/rayrishu19-wq/express-sentinel-limiter/blob/main/CONTRIBUTING.md) before submitting. Verify whether the issue reproduces on the latest version of `express-sentinel-limiter` and note if you are using Redis or the in-memory fallback.

### 🐛 Bug Description
A clear and concise description of what the bug is.

### 🔁 Steps to Reproduce
Provide minimal, self-contained code or steps to reproduce the behavior:
```javascript
const express = require('express');
const { createSentinelLimiter } = require('express-sentinel-limiter');

const app = express();
const limiter = createSentinelLimiter({
  limit: 10,
  windowMs: 60000,
  // ... your configuration
});

app.use(limiter);
```

1. Run the sample script
2. Send request: `curl http://localhost:3000/...`
3. Observe error or unexpected behavior

### 🎯 Expected Behavior
A clear and concise description of what you expected to happen.

### 💥 Actual Behavior
A clear description of what actually happened, including any unexpected status codes or headers.

### 💻 Environment Information
- **express-sentinel-limiter Version:** [e.g. 1.0.0]
- **Node.js Version:** [e.g. 18.20.0, 20.12.0, 22.0.0]
- **Redis Version / Provider (if applicable):** [e.g. Redis 7.2, AWS ElastiCache, or None / In-Memory]
- **Operating System:** [e.g. Ubuntu 22.04, macOS Sonoma, Windows 11]

### 📋 Stack Trace / Console Logs
```text
Paste terminal logs or error stack traces here if applicable
```

### 📎 Additional Context
Add any other context, headers received, or architectural diagrams about the problem here.
