'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { retrieveOrganizations, formatContextForPrompt } = require('../../src/services/retrievalService');

describe('retrieveOrganizations', () => {
  test('returns orgs matching issue for US location', () => {
    const orgs = retrieveOrganizations('Chicago, IL', 'food insecurity');
    assert.ok(orgs.length > 0);
    assert.ok(orgs.every(o => o.issue === 'food insecurity'));
  });

  test('returns orgs for Canadian location', () => {
    const orgs = retrieveOrganizations('Toronto, ON', 'climate & environment');
    assert.ok(orgs.length > 0);
    assert.ok(orgs.every(o => o.issue === 'climate & environment'));
  });

  test('prefers region-specific over international', () => {
    const orgs = retrieveOrganizations('Toronto, ON', 'food insecurity');
    assert.ok(orgs[0].regions.includes('ca'));
  });

  test('falls back to international for unknown region', () => {
    const orgs = retrieveOrganizations('Tokyo, Japan', 'food insecurity');
    assert.ok(orgs.length > 0);
    assert.ok(orgs.every(o => o.regions.includes('intl')));
  });

  test('respects limit parameter', () => {
    const orgs = retrieveOrganizations('New York, NY', 'climate & environment', 1);
    assert.ok(orgs.length <= 1);
  });

  test('returns empty array for unknown issue', () => {
    const orgs = retrieveOrganizations('Toronto', 'made up issue');
    assert.deepEqual(orgs, []);
  });

  test('all returned orgs have required fields', () => {
    const orgs = retrieveOrganizations('London, UK', 'animal welfare');
    for (const org of orgs) {
      assert.ok(org.name, 'missing name');
      assert.ok(org.url, 'missing url');
      assert.ok(org.description, 'missing description');
      assert.ok(typeof org.verified === 'boolean', 'missing verified');
    }
  });
});

describe('formatContextForPrompt', () => {
  test('returns empty string for empty array', () => {
    assert.equal(formatContextForPrompt([]), '');
  });

  test('includes org name in output', () => {
    const orgs = retrieveOrganizations('Chicago, IL', 'food insecurity');
    const context = formatContextForPrompt(orgs.slice(0, 1));
    assert.match(context, new RegExp(orgs[0].name));
  });

  test('includes a URL', () => {
    const orgs = retrieveOrganizations('Toronto, ON', 'climate & environment');
    const context = formatContextForPrompt(orgs.slice(0, 1));
    assert.match(context, /https?:\/\//);
  });

  test('includes the section header', () => {
    const orgs = retrieveOrganizations('Toronto', 'mental health');
    const context = formatContextForPrompt(orgs);
    assert.match(context, /VERIFIED ORGANIZATIONS/);
  });
});
