'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { validateAiResponse } = require('../../src/services/groqService');

const VALID_CARD = {
  title: 'Join a climate march',
  description: 'Attend the upcoming rally. It raises visibility for local policy change.',
  badge: 'do_today',
  effort: '2 hours',
  actionUrl: 'https://example.org/march'
};

describe('validateAiResponse', () => {
  test('accepts valid response with 3 cards', () => {
    const r = validateAiResponse({ cards: [VALID_CARD, VALID_CARD, VALID_CARD] });
    assert.equal(r.valid, true);
    assert.equal(r.cards.length, 3);
  });

  test('accepts response with 1 card', () => {
    const r = validateAiResponse({ cards: [VALID_CARD] });
    assert.equal(r.valid, true);
  });

  test('limits cards to first 3', () => {
    const many = [VALID_CARD, VALID_CARD, VALID_CARD, VALID_CARD, VALID_CARD];
    const r = validateAiResponse({ cards: many });
    assert.equal(r.valid, true);
    assert.ok(r.cards.length <= 3);
  });

  test('rejects null response', () => {
    assert.equal(validateAiResponse(null).valid, false);
  });

  test('rejects missing cards array', () => {
    assert.equal(validateAiResponse({ results: [] }).valid, false);
  });

  test('rejects empty cards array', () => {
    assert.equal(validateAiResponse({ cards: [] }).valid, false);
  });

  test('rejects card with empty title', () => {
    const r = validateAiResponse({ cards: [{ ...VALID_CARD, title: '' }] });
    assert.equal(r.valid, false);
  });

  test('rejects card with empty description', () => {
    const r = validateAiResponse({ cards: [{ ...VALID_CARD, description: '' }] });
    assert.equal(r.valid, false);
  });

  test('rejects card with invalid badge', () => {
    const r = validateAiResponse({ cards: [{ ...VALID_CARD, badge: 'invalid' }] });
    assert.equal(r.valid, false);
  });

  test('accepts all valid badge values', () => {
    for (const badge of ['do_today', 'contact', 'learn']) {
      const r = validateAiResponse({ cards: [{ ...VALID_CARD, badge }] });
      assert.equal(r.valid, true, `badge "${badge}" should be valid`);
    }
  });

  test('rejects card with empty effort', () => {
    const r = validateAiResponse({ cards: [{ ...VALID_CARD, effort: '' }] });
    assert.equal(r.valid, false);
  });

  test('filters invalid cards, keeps valid ones', () => {
    const mixed = [
      { ...VALID_CARD, badge: 'bad' },  // invalid
      VALID_CARD,                         // valid
      { ...VALID_CARD, title: '' }        // invalid
    ];
    const r = validateAiResponse({ cards: mixed });
    assert.equal(r.valid, true);
    assert.equal(r.cards.length, 1);
  });
});
