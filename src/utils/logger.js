'use strict';

/**
 * Lightweight structured logger.
 * Mirrors the pino API (logger.info(obj, msg), logger.error, etc.)
 * so it can be swapped for pino when the package is available.
 */

const LEVELS = { fatal: 60, error: 50, warn: 40, info: 30, debug: 20, trace: 10 };
const currentLevel = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

function log(level, levelNum, obj, msg) {
  if (levelNum < currentLevel) return;
  if (process.env.NODE_ENV === 'test') return; // Suppress logs during tests

  const entry = {
    level,
    time: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    ...(typeof obj === 'object' && obj !== null ? obj : {}),
    msg: msg ?? (typeof obj === 'string' ? obj : '')
  };

  // Redact sensitive fields
  delete entry.authorization;
  delete entry.cookie;
  delete entry.apiKey;

  const out = level === 'error' || level === 'fatal' ? process.stderr : process.stdout;
  out.write(JSON.stringify(entry) + '\n');
}

const logger = {
  fatal: (obj, msg) => log('fatal', LEVELS.fatal, obj, msg),
  error: (obj, msg) => log('error', LEVELS.error, obj, msg),
  warn:  (obj, msg) => log('warn',  LEVELS.warn,  obj, msg),
  info:  (obj, msg) => log('info',  LEVELS.info,  obj, msg),
  debug: (obj, msg) => log('debug', LEVELS.debug, obj, msg),
  trace: (obj, msg) => log('trace', LEVELS.trace, obj, msg),
  child: () => logger
};

module.exports = logger;
