# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-09-03

### Added
- Exported core utility helpers `getClientIp`, `defaultKeyGenerator`, and `setRateLimitHeaders` directly from package root.
- Attached underlying `store` reference to the returned limiter middleware instance.
- Added programmatic `limiter.resetKey(key)` asynchronous helper for integration testing and administrator unblocking workflows.
- Comprehensive TypeScript declaration updates for exported utilities and middleware properties.

---

## [1.1.0] - 2026-09-03

### Added
- Standard IETF draft rate limit response headers support (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`).
- `standardHeaders` option in `createSentinelLimiter` configuration (default `false`).
- `legacyHeaders` option in `createSentinelLimiter` configuration to toggle `X-RateLimit-*` headers (default `true`).
- Unit tests validating standalone and combined standard/legacy header output.

---

## [1.0.0] - 2026-09-02

### Added
- Continuous **Token Bucket** algorithm implementation with smooth refill.
- Atomic **Redis Lua script** for zero race conditions across distributed Express instances.
- High-speed **In-Memory fallback store** (`MemoryTokenBucketStore`) for zero-downtime during Redis disconnects or single-node deployments.
- Standard RFC rate limit response headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`).
- Dynamic request token cost support via numeric cost or callback `(req) => number`.
- Configurable client key generators (`keyGenerator`) and bypass logic (`skip`).
- Custom rate-limited response handler (`onRateLimited`).
- Complete TypeScript declaration definitions (`types/index.d.ts`).
- Basic and custom key generator usage examples in `examples/`.
- Automated unit test suite using Node.js native test runner (`node:test`).
