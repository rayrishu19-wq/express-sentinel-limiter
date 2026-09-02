import { Request, Response, NextFunction } from 'express';

export interface RateLimitInfo {
  limit: number;
  remainingTokens: number;
  retryAfter: number;
}

export type DynamicCostFunction = (req: Request) => number;
export type KeyGeneratorFunction = (req: Request) => string;
export type SkipFunction = (req: Request) => boolean | Promise<boolean>;
export type OnRateLimitedHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
  info: RateLimitInfo
) => void;

export type RateLimitMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

export interface SentinelLimiterOptions {
  /**
   * Maximum capacity of the token bucket.
   * @default 60
   */
  limit?: number;

  /**
   * Time window in milliseconds used to calculate the continuous refill rate.
   * @default 60000 (1 minute)
   */
  windowMs?: number;

  /**
   * Number of tokens consumed per request, or a function returning the cost.
   * @default 1
   */
  cost?: number | DynamicCostFunction;

  /**
   * Optional ioredis client instance. If omitted, uses high-speed in-memory store.
   */
  redis?: any;

  /**
   * Namespace prefix for rate-limiting keys.
   * @default 'default'
   */
  prefix?: string;

  /**
   * Function to extract a unique identifier for the client (e.g. IP, API key, User ID).
   */
  keyGenerator?: KeyGeneratorFunction;

  /**
   * Function to determine if a request should bypass rate limiting.
   */
  skip?: SkipFunction;

  /**
   * Custom response handler invoked when a client exceeds their rate limit.
   */
  onRateLimited?: OnRateLimitedHandler;

  /**
   * Whether to fail open and allow traffic if an unexpected store error occurs.
   * @default true
   */
  failOpen?: boolean;

  /**
   * Whether to send standard RFC rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`).
   * @default true
   */
  setHeaders?: boolean;
}

export interface MemoryTokenBucketResult {
  allowed: boolean;
  remainingTokens: number;
  retryAfter: number;
}

export declare class MemoryTokenBucketStore {
  constructor(cleanupIntervalMs?: number);
  consume(key: string, limit: number, refillRate: number, cost?: number): MemoryTokenBucketResult;
  reset(key?: string): void;
  destroy(): void;
}

/**
 * Creates an Express middleware that enforces Token Bucket rate limiting
 * via Redis (atomic Lua script) with automatic in-memory fallback.
 */
export declare function createSentinelLimiter(
  options?: SentinelLimiterOptions
): RateLimitMiddleware;

declare global {
  namespace Express {
    interface Request {
      rateLimit?: RateLimitInfo & {
        allowed: boolean;
      };
    }
  }
}
