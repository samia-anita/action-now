'use strict';

const { isValidHttpUrl } = require('./validation');

/**
 * Verifies that a URL is reachable. Returns a verified URL or a targeted
 * Google-search fallback if the URL is dead, unreachable, or malformed.
 *
 * @param {string|undefined} url - The URL to verify
 * @param {string} title - Card title (used in fallback search query)
 * @param {string} location - User location (used in fallback search query)
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=4000] - Fetch timeout in milliseconds
 * @returns {Promise<string>} Verified URL or fallback Google search URL
 */
async function verifyUrl(url, title, location, opts = {}) {
  const { timeoutMs = 4000 } = opts;
  const fallback = `https://www.google.com/search?q=${encodeURIComponent(`${title} ${location}`)}`;

  if (!isValidHttpUrl(url)) return fallback;

  // Block javascript: and data: schemes defensively (belt-and-suspenders over isValidHttpUrl)
  const lower = url.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:')) return fallback;

  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow'
    });
    return res.ok ? url : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Verifies an array of card URLs in parallel.
 * @param {Array<{actionUrl?: string, title?: string, [key: string]: unknown}>} cards
 * @param {string} location
 * @returns {Promise<Array>} Cards with verified actionUrl values
 */
async function verifyCardUrls(cards, location) {
  return Promise.all(
    cards.map(async (card) => ({
      ...card,
      actionUrl: await verifyUrl(card.actionUrl, card.title || '', location)
    }))
  );
}

module.exports = { verifyUrl, verifyCardUrls };
