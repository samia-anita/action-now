'use strict';

const logger = require('../utils/logger');

/**
 * Centralized Express error handler.
 * All errors thrown in route handlers flow here.
 *
 * @type {import('express').ErrorRequestHandler}
 */
function errorHandler(err, req, res, _next) {
  const status = err.statusCode || err.status || 500;

  logger.error({
    err: { message: err.message, stack: err.stack },
    req: { method: req.method, url: req.url, ip: req.ip }
  }, 'Unhandled request error');

  const body = {
    error: status < 500
      ? err.message
      : 'An unexpected server error occurred. Please try again.',
    code: err.code || 'INTERNAL_ERROR'
  };

  // Expose raw detail in development only
  if (process.env.NODE_ENV === 'development' && err.raw) {
    body.raw = err.raw;
  }

  res.status(status).json(body);
}

/**
 * 404 handler — catches requests to non-existent routes.
 * @type {import('express').RequestHandler}
 */
function notFoundHandler(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}`, code: 'NOT_FOUND' });
}

/**
 * Creates an HTTP error with a status code.
 * @param {number} status
 * @param {string} message
 * @param {string} [code]
 * @returns {Error & { statusCode: number, code?: string }}
 */
function createHttpError(status, message, code) {
  const err = new Error(message);
  err.statusCode = status;
  if (code) err.code = code;
  return err;
}

module.exports = { errorHandler, notFoundHandler, createHttpError };
