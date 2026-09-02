const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { MemoryTokenBucketStore } = require('../src/memoryStore');

describe('MemoryTokenBucketStore Lifecycle & Edge Cases', () => {
  test('should initialize with full capacity and consume correctly', () => {
    const store = new MemoryTokenBucketStore();
    const res = store.consume('client-1', 10, 2, 3);
    assert.equal(res.allowed, true);
    assert.equal(res.remainingTokens, 7);
    assert.equal(res.retryAfter, 0);
    store.destroy();
  });

  test('should reset a single key when specified', () => {
    const store = new MemoryTokenBucketStore();
    store.consume('user-a', 5, 1, 5); // empty
    store.consume('user-b', 5, 1, 5); // empty

    assert.equal(store.consume('user-a', 5, 1, 1).allowed, false);
    assert.equal(store.consume('user-b', 5, 1, 1).allowed, false);

    // Reset only user-a
    store.reset('user-a');

    // user-a gets fresh bucket
    const freshA = store.consume('user-a', 5, 1, 1);
    assert.equal(freshA.allowed, true);

    // user-b still blocked
    const stillBlockedB = store.consume('user-b', 5, 1, 1);
    assert.equal(stillBlockedB.allowed, false);

    store.destroy();
  });

  test('should reset all keys when reset() is called with no arguments', () => {
    const store = new MemoryTokenBucketStore();
    store.consume('key-1', 2, 1, 2);
    store.consume('key-2', 2, 1, 2);

    assert.equal(store.consume('key-1', 2, 1, 1).allowed, false);
    assert.equal(store.consume('key-2', 2, 1, 1).allowed, false);

    store.reset();

    assert.equal(store.consume('key-1', 2, 1, 1).allowed, true);
    assert.equal(store.consume('key-2', 2, 1, 1).allowed, true);

    store.destroy();
  });

  test('should clean up resources when destroy() is invoked', () => {
    const store = new MemoryTokenBucketStore(100);
    store.consume('transient-key', 5, 1, 1);
    assert.equal(store.buckets.size, 1);

    store.destroy();
    assert.equal(store.buckets.size, 0);
  });

  test('should calculate accurate retryAfter when tokens are insufficient', () => {
    const store = new MemoryTokenBucketStore();
    const limit = 10;
    const refillRate = 2; // 2 tokens per second
    const cost = 10;

    store.consume('rate-check', limit, refillRate, cost); // 0 remaining
    const blocked = store.consume('rate-check', limit, refillRate, 4);

    assert.equal(blocked.allowed, false);
    // Missing 4 tokens at 2 tokens/sec = 2 seconds
    assert.equal(blocked.retryAfter, 2);
    store.destroy();
  });
});
