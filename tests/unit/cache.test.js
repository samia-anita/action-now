'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { Cache } = require('../../src/utils/cache');

describe('Cache', () => {
  test('returns null for missing keys', () => {
    const cache = new Cache();
    assert.equal(cache.get('nonexistent'), null);
  });

  test('stores and retrieves values', () => {
    const cache = new Cache();
    cache.set('key1', { data: 'hello' });
    assert.deepEqual(cache.get('key1'), { data: 'hello' });
  });

  test('returns null for expired entries', async () => {
    const cache = new Cache({ ttlMs: 50 });
    cache.set('key1', 'value');
    await new Promise(r => setTimeout(r, 100));
    assert.equal(cache.get('key1'), null);
  });

  test('evicts oldest entry when maxSize is reached', () => {
    const cache = new Cache({ maxSize: 3 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4); // evicts 'a'
    assert.equal(cache.get('a'), null);
    assert.equal(cache.get('d'), 4);
  });

  test('tracks hits, misses, and hitRate', () => {
    const cache = new Cache();
    cache.set('k', 'v');
    cache.get('k');    // hit
    cache.get('k');    // hit
    cache.get('miss'); // miss
    const stats = cache.stats();
    assert.equal(stats.hits, 2);
    assert.equal(stats.misses, 1);
    assert.equal(stats.hitRate, '66.7%');
  });

  test('clear() resets all state', () => {
    const cache = new Cache();
    cache.set('k', 'v');
    cache.get('k');
    cache.clear();
    const stats = cache.stats();
    assert.equal(stats.size, 0);
    assert.equal(stats.hits, 0);
    assert.equal(stats.misses, 0);
  });
});

describe('Cache.buildKey', () => {
  test('produces same key for same inputs', () => {
    const k1 = Cache.buildKey('Toronto, ON', 'climate & environment', '15 minutes', ['I can code']);
    const k2 = Cache.buildKey('Toronto, ON', 'climate & environment', '15 minutes', ['I can code']);
    assert.equal(k1, k2);
  });

  test('produces same key regardless of skills order', () => {
    const k1 = Cache.buildKey('NYC', 'mental health', '1 hour', ['I can drive', 'I can code']);
    const k2 = Cache.buildKey('NYC', 'mental health', '1 hour', ['I can code', 'I can drive']);
    assert.equal(k1, k2);
  });

  test('produces different keys for different locations', () => {
    const k1 = Cache.buildKey('Toronto', 'mental health', '1 hour', []);
    const k2 = Cache.buildKey('Vancouver', 'mental health', '1 hour', []);
    assert.notEqual(k1, k2);
  });

  test('normalizes location case', () => {
    const k1 = Cache.buildKey('TORONTO, ON', 'climate & environment', '15 minutes', []);
    const k2 = Cache.buildKey('toronto, on', 'climate & environment', '15 minutes', []);
    assert.equal(k1, k2);
  });
});
