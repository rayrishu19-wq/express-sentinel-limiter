const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { getClientIp, defaultKeyGenerator, setRateLimitHeaders } = require('../src/utils');

describe('Utils Unit Tests', () => {
  describe('getClientIp()', () => {
    test('should extract first IP from comma-separated x-forwarded-for header', () => {
      const req = {
        headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178' },
      };
      assert.equal(getClientIp(req), '203.0.113.195');
    });

    test('should trim whitespace from x-forwarded-for header', () => {
      const req = {
        headers: { 'x-forwarded-for': '   198.51.100.42   ' },
      };
      assert.equal(getClientIp(req), '198.51.100.42');
    });

    test('should fall back to req.ip if header is missing', () => {
      const req = {
        headers: {},
        ip: '10.0.0.5',
      };
      assert.equal(getClientIp(req), '10.0.0.5');
    });

    test('should fall back to socket remoteAddress if req.ip is missing', () => {
      const req = {
        headers: {},
        socket: { remoteAddress: '192.168.1.100' },
      };
      assert.equal(getClientIp(req), '192.168.1.100');
    });

    test('should return 127.0.0.1 when no IP can be resolved', () => {
      const req = {};
      assert.equal(getClientIp(req), '127.0.0.1');
    });
  });

  describe('defaultKeyGenerator()', () => {
    test('should format key with default prefix', () => {
      const req = { ip: '10.10.10.10' };
      assert.equal(defaultKeyGenerator(req), 'sentinel:ratelimit:default:10.10.10.10');
    });

    test('should format key with custom prefix', () => {
      const req = { ip: '10.10.10.10' };
      assert.equal(defaultKeyGenerator(req, 'api-v2'), 'sentinel:ratelimit:api-v2:10.10.10.10');
    });
  });

  describe('setRateLimitHeaders()', () => {
    test('should set X-RateLimit headers correctly', () => {
      const headers = {};
      const res = {
        setHeader(name, val) {
          headers[name] = val;
        },
      };

      setRateLimitHeaders(res, 100, 42, 0);
      assert.equal(headers['X-RateLimit-Limit'], '100');
      assert.equal(headers['X-RateLimit-Remaining'], '42');
      assert.equal(headers['Retry-After'], undefined);
    });

    test('should set Retry-After header when retryAfter > 0', () => {
      const headers = {};
      const res = {
        setHeader(name, val) {
          headers[name] = val;
        },
      };

      setRateLimitHeaders(res, 60, 0, 15);
      assert.equal(headers['X-RateLimit-Limit'], '60');
      assert.equal(headers['X-RateLimit-Remaining'], '0');
      assert.equal(headers['Retry-After'], '15');
    });

    test('should not throw if res or setHeader is invalid', () => {
      assert.doesNotThrow(() => {
        setRateLimitHeaders(null, 100, 50, 0);
        setRateLimitHeaders({}, 100, 50, 0);
      });
    });
  });
});
