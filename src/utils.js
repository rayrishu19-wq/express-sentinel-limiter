/**
 * Utility functions for express-sentinel-limiter
 */

function getClientIp(req) {
  const forwarded = req.headers && req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || (req.socket && req.socket.remoteAddress) || '127.0.0.1';
}

function defaultKeyGenerator(req, prefix = 'default') {
  const ip = getClientIp(req);
  return `sentinel:ratelimit:${prefix}:${ip}`;
}

function setRateLimitHeaders(res, limit, remaining, retryAfter = 0) {
  if (!res || typeof res.setHeader !== 'function') return;

  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, remaining)));

  if (retryAfter > 0) {
    res.setHeader('Retry-After', String(retryAfter));
  }
}

module.exports = {
  getClientIp,
  defaultKeyGenerator,
  setRateLimitHeaders,
};
