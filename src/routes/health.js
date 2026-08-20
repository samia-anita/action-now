'use strict';

const { Router } = require('express');
const { cache } = require('../utils/cache');

const router = Router();
const startTime = Date.now();

/**
 * GET /health
 *
 * Production health check endpoint.
 * Returns service status, uptime, memory usage, and cache stats.
 */
router.get('/', (_req, res) => {
  const mem = process.memoryUsage();
  const uptimeMs = Date.now() - startTime;

  res.status(200).json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    uptime: {
      ms: uptimeMs,
      human: formatUptime(uptimeMs)
    },
    memory: {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      rssMB: Math.round(mem.rss / 1024 / 1024)
    },
    cache: cache.stats(),
    services: {
      groq: process.env.GROQ_API_KEY ? 'configured' : 'missing'
    }
  });
});

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

module.exports = router;
