'use strict';

const { inferTrustRegion } = require('../utils/locationInference');
const orgsDb = require('../data/organizations.json');

/**
 * @typedef {Object} Organization
 * @property {string} id
 * @property {string} name
 * @property {string} issue
 * @property {string[]} regions
 * @property {string[]} cities
 * @property {string} url
 * @property {string} volunteerUrl
 * @property {string} description
 * @property {string[]} actions
 * @property {boolean} verified
 */

/**
 * Retrieves relevant organizations from the curated database based on
 * the user's location and issue category.
 *
 * This is the retrieval layer of the RAG (Retrieval-Augmented Generation) system.
 * Context retrieved here is injected directly into the LLM prompt, grounding the
 * model's output in verified, real organizations rather than hallucinated ones.
 *
 * @param {string} location - User's location string
 * @param {string} issue    - Issue category (must match VALID_ISSUES)
 * @param {number} [limit=3] - Max organizations to retrieve
 * @returns {Organization[]} Matching organizations, ordered by specificity
 */
function retrieveOrganizations(location, issue, limit = 3) {
  const region = inferTrustRegion(location);

  /** @type {Organization[]} */
  const orgs = orgsDb.organizations;

  // Filter by issue, then prefer region-specific over intl
  const matching = orgs.filter(
    org => org.issue === issue && (org.regions.includes(region) || org.regions.includes('intl'))
  );

  // Sort: region-specific first, then intl fallback
  matching.sort((a, b) => {
    const aRegion = a.regions.includes(region) ? 0 : 1;
    const bRegion = b.regions.includes(region) ? 0 : 1;
    return aRegion - bRegion;
  });

  return matching.slice(0, limit);
}

/**
 * Formats retrieved organizations into a prompt-friendly context block.
 * This is injected into the LLM system prompt to ground its responses.
 *
 * @param {Organization[]} orgs
 * @returns {string}
 */
function formatContextForPrompt(orgs) {
  if (!orgs.length) return '';

  const lines = orgs.map(
    org =>
      `- ${org.name}: ${org.description} Volunteer/action URL: ${org.volunteerUrl || org.url}` +
      ` Example actions: ${org.actions.slice(0, 2).join('; ')}.`
  );

  return `\n\nVERIFIED ORGANIZATIONS FOR THIS LOCATION AND ISSUE (prefer these over invented ones):\n${lines.join('\n')}`;
}

module.exports = { retrieveOrganizations, formatContextForPrompt };
