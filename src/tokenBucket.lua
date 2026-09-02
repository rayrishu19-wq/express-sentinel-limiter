-- Redis Lua Script for Atomic Token Bucket Rate Limiting
-- Evaluated atomically on the Redis server to prevent race conditions in distributed clusters.

local key = KEYS[1]
local limit = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local cost = tonumber(ARGV[4]) or 1

local data = redis.call('get', key)
local tokens
local last_refill

if not data then
    tokens = limit
    last_refill = now
else
    local bucket = cjson.decode(data)
    last_refill = tonumber(bucket.lastRefill)
    local elapsed = math.max(0, now - last_refill)
    tokens = math.min(limit, tonumber(bucket.tokens) + (elapsed * refill_rate))
end

if tokens >= cost then
    tokens = tokens - cost
    local next_bucket = { tokens = tokens, lastRefill = now }
    local ttl = math.max(3600, math.ceil(limit / refill_rate) * 2)
    redis.call('set', key, cjson.encode(next_bucket), 'EX', ttl)
    return { 1, math.floor(tokens), 0 } -- allowed, remaining_tokens, retry_after_sec
else
    local next_bucket = { tokens = tokens, lastRefill = now }
    local ttl = math.max(3600, math.ceil(limit / refill_rate) * 2)
    redis.call('set', key, cjson.encode(next_bucket), 'EX', ttl)
    local missing = cost - tokens
    local retry_after = math.ceil(missing / refill_rate)
    return { 0, math.floor(tokens), retry_after } -- rejected, remaining_tokens, retry_after_sec
end
