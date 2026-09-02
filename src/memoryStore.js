/**
 * In-memory Token Bucket Store for express-sentinel-limiter.
 * Used for development, testing, or as a seamless fallback when Redis is unavailable.
 */

class MemoryTokenBucketStore {
  constructor(cleanupIntervalMs = 60000) {
    this.buckets = new Map();

    // Periodically clean up buckets idle for over 1 hour
    this.cleanupTimer = setInterval(() => {
      const now = Date.now() / 1000;
      for (const [key, bucket] of this.buckets.entries()) {
        if (now - bucket.lastRefill > 3600) {
          this.buckets.delete(key);
        }
      }
    }, cleanupIntervalMs);

    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Evaluates the token bucket for a specific key.
   * 
   * @param {string} key - Unique rate-limiting key
   * @param {number} limit - Maximum bucket capacity
   * @param {number} refillRate - Tokens added per second
   * @param {number} cost - Number of tokens consumed (default 1)
   * @returns {{ allowed: boolean, remainingTokens: number, retryAfter: number }}
   */
  consume(key, limit, refillRate, cost = 1) {
    const now = Date.now() / 1000;
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: limit, lastRefill: now };
    } else {
      const elapsed = Math.max(0, now - bucket.lastRefill);
      bucket.tokens = Math.min(limit, bucket.tokens + elapsed * refillRate);
      bucket.lastRefill = now;
    }

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      this.buckets.set(key, bucket);
      return {
        allowed: true,
        remainingTokens: Math.floor(bucket.tokens),
        retryAfter: 0,
      };
    } else {
      this.buckets.set(key, bucket);
      const missing = cost - bucket.tokens;
      const retryAfter = Math.ceil(missing / refillRate);
      return {
        allowed: false,
        remainingTokens: Math.floor(bucket.tokens),
        retryAfter,
      };
    }
  }

  reset(key) {
    if (key) {
      this.buckets.delete(key);
    } else {
      this.buckets.clear();
    }
  }

  destroy() {
    clearInterval(this.cleanupTimer);
    this.buckets.clear();
  }
}

module.exports = { MemoryTokenBucketStore };
