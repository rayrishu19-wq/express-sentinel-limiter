/**
 * Extracts client IP address supporting standard reverse proxy headers.
 *
 * @param {import('express').Request|Object} req - Incoming HTTP request
 * @returns {string} Client IP address or fallback loopback
 */
function getClientIp(req) {
  const forwarded = req.headers && req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || (req.socket && req.socket.remoteAddress) || '127.0.0.1';
}

/**
 * Default key generator constructing a namespaced Redis/store key by client IP.
 *
 * @param {import('express').Request|Object} req - Incoming HTTP request
 * @param {string} [prefix='default'] - Rate limit namespace prefix
 * @returns {string} Namespaced rate limit key
 */
function defaultKeyGenerator(req, prefix = 'default') {
  const ip = getClientIp(req);
  return `sentinel:ratelimit:${prefix}:${ip}`;
}

/**
 * Sets standard RFC rate limit headers on the HTTP response.
 * Supports legacy X-RateLimit-* headers and modern standard IETF RateLimit-* headers.
 *
 * @param {import('express').Response|Object} res - HTTP response object
 * @param {number} limit - Maximum bucket capacity
 * @param {number} remaining - Tokens remaining in current window
 * @param {number} [retryAfter=0] - Seconds to wait until next token replenishment
 * @param {Object} [options={}] - Header format options
 * @param {boolean} [options.legacyHeaders=true] - Send X-RateLimit-* headers
 * @param {boolean} [options.standardHeaders=false] - Send RateLimit-* (IETF draft) headers
 */
function setRateLimitHeaders(res, limit, remaining, retryAfter = 0, options = {}) {
  if (!res || typeof res.setHeader !== 'function') return;

  const { legacyHeaders = true, standardHeaders = false } = options;

  if (legacyHeaders) {
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, remaining)));
  }

  if (standardHeaders) {
    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, remaining)));
    res.setHeader('RateLimit-Reset', String(Math.max(0, retryAfter)));
  }

  if (retryAfter > 0) {
    res.setHeader('Retry-After', String(retryAfter));
  }
}

module.exports = {
  getClientIp,
  defaultKeyGenerator,
  setRateLimitHeaders,
};
