'use strict';

/**
 * Lightweight in-process rate limiter.
 * Implements a sliding window counter per IP.
 * Can be swapped for express-rate-limit when package is available.
 */

function createRateLimiter({ windowMs, max, message }) {
  const counters = new Map(); // ip -> { count, resetAt }

  // Cleanup old entries every windowMs
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of counters) {
      if (now > entry.resetAt) counters.delete(ip);
    }
  }, windowMs).unref(); // unref so this doesn't keep process alive

  return function rateLimitMiddleware(req, res, next) {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = counters.get(ip);

    if (!entry || now > entry.resetAt) {
      counters.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', 0);
      return res.status(429).json(message);
    }

    entry.count++;
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', max - entry.count);
    next();
  };
}

const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests. Please wait a moment and try again.', code: 'RATE_LIMITED' }
});

const generationLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'You have sent too many requests. Please wait a minute before trying again.', code: 'RATE_LIMITED' }
});

module.exports = { apiLimiter, generationLimiter };
