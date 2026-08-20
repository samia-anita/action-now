'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { validateActionRequest, isValidHttpUrl, VALID_ISSUES, VALID_TIMES } = require('../../src/utils/validation');

const VALID_BODY = {
  location: 'Toronto, ON',
  issue: 'climate & environment',
  time: '15 minutes',
  skills: ['I can code']
};

describe('validateActionRequest', () => {
  test('accepts a fully valid request', () => {
    const r = validateActionRequest(VALID_BODY);
    assert.equal(r.success, true);
    assert.equal(r.data.location, 'Toronto, ON');
    assert.deepEqual(r.data.skills, ['I can code']);
  });

  test('trims whitespace from location', () => {
    const r = validateActionRequest({ ...VALID_BODY, location: '  Chicago, IL  ' });
    assert.equal(r.success, true);
    assert.equal(r.data.location, 'Chicago, IL');
  });

  test('accepts request without skills (defaults to [])', () => {
    const { skills, ...noSkills } = VALID_BODY;
    const r = validateActionRequest(noSkills);
    assert.equal(r.success, true);
    assert.deepEqual(r.data.skills, []);
  });

  test('rejects missing location', () => {
    const { location, ...body } = VALID_BODY;
    const r = validateActionRequest(body);
    assert.equal(r.success, false);
    assert.match(r.error, /location/i);
  });

  test('rejects location too short', () => {
    const r = validateActionRequest({ ...VALID_BODY, location: 'X' });
    assert.equal(r.success, false);
  });

  test('rejects location too long', () => {
    const r = validateActionRequest({ ...VALID_BODY, location: 'A'.repeat(121) });
    assert.equal(r.success, false);
  });

  test('rejects invalid issue', () => {
    const r = validateActionRequest({ ...VALID_BODY, issue: 'made up issue' });
    assert.equal(r.success, false);
    assert.match(r.error, /issue/i);
  });

  test('rejects invalid time', () => {
    const r = validateActionRequest({ ...VALID_BODY, time: '3 weeks' });
    assert.equal(r.success, false);
    assert.match(r.error, /time/i);
  });

  test('rejects invalid skill', () => {
    const r = validateActionRequest({ ...VALID_BODY, skills: ['I can fly'] });
    assert.equal(r.success, false);
  });

  test('all VALID_ISSUES pass validation', () => {
    for (const issue of VALID_ISSUES) {
      const r = validateActionRequest({ ...VALID_BODY, issue });
      assert.equal(r.success, true, `Expected ${issue} to be valid`);
    }
  });

  test('all VALID_TIMES pass validation', () => {
    for (const time of VALID_TIMES) {
      const r = validateActionRequest({ ...VALID_BODY, time });
      assert.equal(r.success, true, `Expected "${time}" to be valid`);
    }
  });

  test('rejects null body', () => {
    const r = validateActionRequest(null);
    assert.equal(r.success, false);
  });

  test('rejects non-object body', () => {
    const r = validateActionRequest('string');
    assert.equal(r.success, false);
  });
});

describe('isValidHttpUrl', () => {
  test('accepts https URLs', () => {
    assert.equal(isValidHttpUrl('https://www.example.com'), true);
  });

  test('accepts http URLs', () => {
    assert.equal(isValidHttpUrl('http://example.com/path?q=1'), true);
  });

  test('rejects non-string values', () => {
    assert.equal(isValidHttpUrl(null), false);
    assert.equal(isValidHttpUrl(undefined), false);
    assert.equal(isValidHttpUrl(42), false);
    assert.equal(isValidHttpUrl({}), false);
  });

  test('rejects invalid URL strings', () => {
    assert.equal(isValidHttpUrl('not-a-url'), false);
    assert.equal(isValidHttpUrl('ftp://example.com'), false);
    assert.equal(isValidHttpUrl(''), false);
    assert.equal(isValidHttpUrl('javascript:alert(1)'), false);
  });

  test('rejects bare domains', () => {
    assert.equal(isValidHttpUrl('example.com'), false);
    assert.equal(isValidHttpUrl('www.example.com'), false);
  });
});
