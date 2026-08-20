'use strict';

const { Router } = require('express');
const { validateActionRequest } = require('../utils/validation');
const { verifyCardUrls } = require('../utils/urlVerifier');
const { generateActions } = require('../services/groqService');
const { cache, Cache } = require('../utils/cache');
const logger = require('../utils/logger');

const router = Router();

/**
 * POST /api/actions
 *
 * Main AI generation endpoint. Returns 3 civic action cards grounded in
 * real organizations (via RAG) with verified URLs.
 *
 * Body: { location: string, issue: string, time: string, skills?: string[] }
 */
router.post('/actions', async (req, res, next) => {
  const start = Date.now();

  // ── 1. Validate input ──────────────────────────────
  const validation = validateActionRequest(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: validation.error, code: 'VALIDATION_ERROR' });
  }

  const { location, issue, time, skills } = validation.data;

  // ── 2. Check cache ─────────────────────────────────
  const cacheKey = Cache.buildKey(location, issue, time, skills);
  const cached = cache.get(cacheKey);

  if (cached) {
    logger.info({ location, issue, time, cacheHit: true }, 'Returning cached result');
    return res.status(200).json({ cards: cached, cached: true, durationMs: Date.now() - start });
  }

  // ── 3. Generate via Groq + RAG ─────────────────────
  let rawCards;
  try {
    rawCards = await generateActions({ location, issue, time, skills });
  } catch (err) {
    logger.error({ err: err.message, location, issue }, 'Groq generation failed');
    // Pass to centralized error handler
    return next(err);
  }

  // ── 4. Verify all URLs in parallel ────────────────
  let verifiedCards;
  try {
    verifiedCards = await verifyCardUrls(rawCards.slice(0, 3), location);
  } catch (err) {
    logger.warn({ err: err.message }, 'URL verification failed, using raw cards');
    verifiedCards = rawCards.slice(0, 3);
  }

  // ── 5. Cache and return ───────────────────────────
  cache.set(cacheKey, verifiedCards);

  const durationMs = Date.now() - start;
  logger.info({ location, issue, time, cardsCount: verifiedCards.length, durationMs, cached: false }, 'Actions generated');

  return res.status(200).json({ cards: verifiedCards, cached: false, durationMs });
});

module.exports = router;
