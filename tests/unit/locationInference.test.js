'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { inferTrustRegion } = require('../../src/utils/locationInference');

describe('inferTrustRegion — Canadian locations', () => {
  const cases = [
    'Toronto, ON', 'Toronto, Canada', 'Montreal, QC', 'Vancouver, BC',
    'Calgary, AB', 'Ottawa, ON', 'Halifax, NS', 'Winnipeg, MB',
    'Edmonton, AB', 'Canada', 'Quebec City', 'London, ON'
  ];
  for (const loc of cases) {
    test(`"${loc}" → ca`, () => assert.equal(inferTrustRegion(loc), 'ca'));
  }
});

describe('inferTrustRegion — UK locations', () => {
  const cases = [
    'London, UK', 'Manchester, UK', 'UK, London', 'England',
    'Scotland', 'Wales', 'United Kingdom', 'Great Britain', 'Northern Ireland'
  ];
  for (const loc of cases) {
    test(`"${loc}" → uk`, () => assert.equal(inferTrustRegion(loc), 'uk'));
  }
});

describe('inferTrustRegion — US locations', () => {
  const cases = [
    'New York, NY', 'Chicago, IL', 'Los Angeles, CA', 'Austin, TX',
    'Seattle, WA', 'Boston, MA', 'Miami, FL', 'Denver, CO',
    'Atlanta, GA', 'USA', 'United States', 'Portland, OR', 'Nashville, TN'
  ];
  for (const loc of cases) {
    test(`"${loc}" → us`, () => assert.equal(inferTrustRegion(loc), 'us'));
  }
});

describe('inferTrustRegion — international / ambiguous', () => {
  const cases = [
    'Berlin, Germany', 'Paris, France', 'Sydney, Australia',
    'Tokyo, Japan', '', '   ', 'Mumbai, India', 'Cape Town, South Africa'
  ];
  for (const loc of cases) {
    test(`"${loc}" → intl`, () => assert.equal(inferTrustRegion(loc), 'intl'));
  }
});

test('handles null gracefully', () => assert.equal(inferTrustRegion(null), 'intl'));
test('handles undefined gracefully', () => assert.equal(inferTrustRegion(undefined), 'intl'));

test('is case-insensitive', () => {
  assert.equal(inferTrustRegion('TORONTO, ON'), 'ca');
  assert.equal(inferTrustRegion('new york, ny'), 'us');
  assert.equal(inferTrustRegion('LONDON, UK'), 'uk');
});
