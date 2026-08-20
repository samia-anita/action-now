'use strict';

/**
 * API integration tests using Node's built-in http module.
 * No supertest needed — we spin up the Express app on a random port
 * and hit it with real HTTP requests.
 */

const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.GROQ_API_KEY = 'test-key-not-real';
process.env.NODE_ENV = 'test';

// ── MOCK groqService ────────────────────────────────────
let mockGenerateActions = null;

// Patch before requiring server
const groqServicePath = require.resolve('../../src/services/groqService');
require.cache[groqServicePath] = {
  id: groqServicePath,
  filename: groqServicePath,
  loaded: true,
  exports: {
    generateActions: async (...args) => {
      if (mockGenerateActions) return mockGenerateActions(...args);
      throw new Error('mockGenerateActions not set');
    },
    validateAiResponse: require('../../src/services/groqService').validateAiResponse,
    buildPrompt: () => ({ systemPrompt: '', userPrompt: '' })
  }
};

// ── MOCK urlVerifier ─────────────────────────────────────
const urlVerifierPath = require.resolve('../../src/utils/urlVerifier');
require.cache[urlVerifierPath] = {
  id: urlVerifierPath,
  filename: urlVerifierPath,
  loaded: true,
  exports: {
    verifyUrl: async (url) => url || 'https://www.google.com/search?q=test',
    verifyCardUrls: async (cards) => cards
  }
};

const app = require('../../src/server');

// ── HELPERS ──────────────────────────────────────────────
let server, baseUrl;

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: '127.0.0.1',
      port: server.address().port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };

    const req = http.request(opts, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(raw); } catch { parsed = raw; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const VALID_BODY = {
  location: 'Toronto, ON',
  issue: 'climate & environment',
  time: '15 minutes',
  skills: ['I can code']
};

const MOCK_CARDS = [
  { title: 'Join a climate group', description: 'Find a local group.', badge: 'do_today', effort: '2h', actionUrl: 'https://example.org/a' },
  { title: 'Email your MP', description: 'Write to your MP.', badge: 'contact', effort: '15 min', actionUrl: 'https://example.org/b' },
  { title: 'Take a free course', description: 'Learn about climate.', badge: 'learn', effort: '1 hour', actionUrl: 'https://example.org/c' }
];

before(async () => {
  server = app.listen(0); // random port
  await new Promise(r => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise(r => server.close(r)));

beforeEach(() => {
  mockGenerateActions = null;
  // Clear cache between tests
  const { cache } = require('../../src/utils/cache');
  cache.clear();
});

// ── TESTS ────────────────────────────────────────────────

describe('POST /api/actions', () => {
  test('returns 200 with cards on valid input', async () => {
    mockGenerateActions = async () => MOCK_CARDS;
    const res = await request('POST', '/api/actions', VALID_BODY);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.cards));
    assert.equal(res.body.cards.length, 3);
    assert.ok(res.body.cards[0].title);
    assert.equal(res.body.cached, false);
  });

  test('returns 400 for missing location', async () => {
    const { location, ...body } = VALID_BODY;
    const res = await request('POST', '/api/actions', body);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /location/i);
    assert.equal(res.body.code, 'VALIDATION_ERROR');
  });

  test('returns 400 for invalid issue', async () => {
    const res = await request('POST', '/api/actions', { ...VALID_BODY, issue: 'politics' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /issue/i);
  });

  test('returns 400 for invalid time', async () => {
    const res = await request('POST', '/api/actions', { ...VALID_BODY, time: 'next year' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /time/i);
  });

  test('returns 500 when Groq service throws', async () => {
    mockGenerateActions = async () => { throw new Error('Groq API error'); };
    const res = await request('POST', '/api/actions', VALID_BODY);
    assert.equal(res.status, 500);
    assert.ok(res.body.error);
  });

  test('returns cached result on second identical request', async () => {
    let callCount = 0;
    mockGenerateActions = async () => { callCount++; return MOCK_CARDS; };

    await request('POST', '/api/actions', VALID_BODY);
    const res2 = await request('POST', '/api/actions', VALID_BODY);

    assert.equal(res2.status, 200);
    assert.equal(res2.body.cached, true);
    assert.equal(callCount, 1); // Only called once
  });

  test('works without optional skills field', async () => {
    mockGenerateActions = async () => MOCK_CARDS;
    const { skills, ...body } = VALID_BODY;
    const res = await request('POST', '/api/actions', body);
    assert.equal(res.status, 200);
    assert.equal(res.body.cards.length, 3);
  });
});

describe('GET /health', () => {
  test('returns 200 with required fields', async () => {
    const res = await request('GET', '/health', null);
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.ok(res.body.uptime);
    assert.ok(res.body.memory);
    assert.ok(res.body.cache);
    assert.equal(res.body.services.groq, 'configured');
  });
});

describe('Security headers', () => {
  test('response includes X-Content-Type-Options', async () => {
    mockGenerateActions = async () => MOCK_CARDS;
    const res = await request('POST', '/api/actions', VALID_BODY);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
  });

  test('response includes X-Frame-Options', async () => {
    mockGenerateActions = async () => MOCK_CARDS;
    const res = await request('POST', '/api/actions', VALID_BODY);
    assert.equal(res.headers['x-frame-options'], 'DENY');
  });
});

describe('404 handler', () => {
  test('returns 404 for unknown API routes', async () => {
    const res = await request('GET', '/api/nonexistent', null);
    assert.equal(res.status, 404);
    assert.equal(res.body.code, 'NOT_FOUND');
  });
});
