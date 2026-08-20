'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const logger = require('./utils/logger');
const { apiLimiter, generationLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const actionsRouter = require('./routes/actions');
const healthRouter = require('./routes/health');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ── SECURITY HEADERS ───────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; img-src 'self' data: https:; media-src 'self'"
  );
  next();
});

// ── HTTP REQUEST LOGGING ───────────────────────────────────
app.use((req, res, next) => {
  if (req.url === '/health') return next();
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]({ method: req.method, url: req.url, status: res.statusCode, ms }, 'request');
  });
  next();
});

// ── BODY PARSING ───────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));

// ── RATE LIMITING ──────────────────────────────────────────
app.use('/api', apiLimiter);
app.use('/api/actions', generationLimiter);

// ── ROUTES ─────────────────────────────────────────────────
app.use('/health', healthRouter);
app.use('/api', actionsRouter);

// ── STATIC FILES ───────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true
}));

// ── SPA FALLBACK (no wildcard — use regex-free approach) ────
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/health')) return next();
  const indexPath = path.join(__dirname, '..', 'public', 'index.html');
  res.sendFile(indexPath, err => { if (err) next(err); });
});

// ── ERROR HANDLING ─────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── START ──────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'Action Now server started');
  });

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason: String(reason) }, 'Unhandled promise rejection');
    process.exit(1);
  });

  process.on('uncaughtException', (err) => {
    logger.fatal({ err: err.message }, 'Uncaught exception');
    process.exit(1);
  });
}

module.exports = app;
