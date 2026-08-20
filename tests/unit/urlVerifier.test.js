'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { mock } = require('node:test');

// We'll test urlVerifier by patching global fetch
describe('verifyUrl', () => {
  let verifyUrl, verifyCardUrls;

  // Re-require after each test to reset module state
  beforeEach(() => {
    // Clear module cache to allow fresh requires
    const key = require.resolve('../../src/utils/urlVerifier');
    delete require.cache[key];
    ({ verifyUrl, verifyCardUrls } = require('../../src/utils/urlVerifier'));
  });

  test('returns URL when fetch succeeds (200)', async () => {
    global.fetch = async () => ({ ok: true, status: 200 });
    const result = await verifyUrl('https://example.com', 'Test', 'Toronto');
    assert.equal(result, 'https://example.com');
  });

  test('returns Google fallback when fetch returns 404', async () => {
    global.fetch = async () => ({ ok: false, status: 404 });
    const result = await verifyUrl('https://example.com/dead', 'Test Org', 'Toronto');
    assert.match(result, /google\.com\/search/);
    assert.match(result, /Test/);
  });

  test('returns Google fallback when fetch throws', async () => {
    global.fetch = async () => { throw new Error('Network error'); };
    const result = await verifyUrl('https://example.com', 'Test', 'Toronto');
    assert.match(result, /google\.com\/search/);
  });

  test('returns fallback for non-http URL without calling fetch', async () => {
    let fetchCalled = false;
    global.fetch = async () => { fetchCalled = true; return { ok: true }; };
    const result = await verifyUrl('ftp://example.com', 'Test', 'Toronto');
    assert.match(result, /google\.com\/search/);
    assert.equal(fetchCalled, false);
  });

  test('returns fallback for undefined URL without calling fetch', async () => {
    let fetchCalled = false;
    global.fetch = async () => { fetchCalled = true; return { ok: true }; };
    const result = await verifyUrl(undefined, 'Test', 'Toronto');
    assert.match(result, /google\.com\/search/);
    assert.equal(fetchCalled, false);
  });

  test('returns fallback for javascript: scheme', async () => {
    let fetchCalled = false;
    global.fetch = async () => { fetchCalled = true; return { ok: true }; };
    const result = await verifyUrl('javascript:alert(1)', 'Test', 'Toronto');
    assert.match(result, /google\.com\/search/);
    assert.equal(fetchCalled, false);
  });

  test('includes title and location in fallback query', async () => {
    global.fetch = async () => { throw new Error('fail'); };
    const result = await verifyUrl('https://example.com', 'Local Food Bank', 'Chicago');
    assert.match(result, /Local/);
    assert.match(result, /Chicago/);
  });
});

describe('verifyCardUrls', () => {
  let verifyCardUrls;

  beforeEach(() => {
    const key = require.resolve('../../src/utils/urlVerifier');
    delete require.cache[key];
    ({ verifyCardUrls } = require('../../src/utils/urlVerifier'));
  });

  test('returns fallback for dead URL, keeps live URL', async () => {
    let callCount = 0;
    global.fetch = async (url) => {
      callCount++;
      return { ok: url.includes('live') };
    };

    const cards = [
      { title: 'Live', actionUrl: 'https://live.example.com' },
      { title: 'Dead', actionUrl: 'https://dead.example.com' }
    ];

    const result = await verifyCardUrls(cards, 'Toronto');
    assert.equal(result[0].actionUrl, 'https://live.example.com');
    assert.match(result[1].actionUrl, /google\.com\/search/);
    assert.equal(callCount, 2);
  });

  test('preserves all other card fields', async () => {
    global.fetch = async () => ({ ok: true });
    const card = { title: 'Test', description: 'Desc', badge: 'do_today', effort: '1h', actionUrl: 'https://test.com' };
    const [result] = await verifyCardUrls([card], 'NYC');
    assert.equal(result.description, 'Desc');
    assert.equal(result.badge, 'do_today');
    assert.equal(result.effort, '1h');
  });
});
