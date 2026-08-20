'use strict';

const Groq = require('groq-sdk');
const logger = require('../utils/logger');
const { isValidHttpUrl } = require('../utils/validation');
const { retrieveOrganizations, formatContextForPrompt } = require('./retrievalService');

// ── RESPONSE SCHEMA ────────────────────────────────────
const BADGE_VALUES = ['do_today', 'contact', 'learn'];

/**
 * Validates the parsed AI response against the expected card schema.
 * @param {unknown} parsed
 * @returns {{ valid: true, cards: object[] } | { valid: false, reason: string }}
 */
function validateAiResponse(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, reason: 'Response is not an object' };
  }
  if (!Array.isArray(parsed.cards)) {
    return { valid: false, reason: 'Missing cards array' };
  }
  if (parsed.cards.length === 0) {
    return { valid: false, reason: 'cards array is empty' };
  }

  const validCards = parsed.cards
    .slice(0, 3)
    .filter(card => {
      if (!card || typeof card !== 'object') return false;
      if (typeof card.title !== 'string' || !card.title.trim()) return false;
      if (typeof card.description !== 'string' || !card.description.trim()) return false;
      if (!BADGE_VALUES.includes(card.badge)) return false;
      if (typeof card.effort !== 'string' || !card.effort.trim()) return false;
      return true;
    });

  if (validCards.length === 0) {
    return { valid: false, reason: 'No valid cards passed schema validation' };
  }

  return { valid: true, cards: validCards };
}

// ── PROMPT BUILDER ─────────────────────────────────────
/**
 * Constructs an improved, RAG-grounded system + user prompt.
 * @param {string} location
 * @param {string} issue
 * @param {string} time
 * @param {string[]} skills
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function buildPrompt(location, issue, time, skills) {
  const skillText = skills.length
    ? ` The user can offer: ${skills.join(', ')}.`
    : '';

  // Retrieve grounding context from the RAG database
  const orgs = retrieveOrganizations(location, issue);
  const context = formatContextForPrompt(orgs);

  const systemPrompt =
    `You are a knowledgeable civic action assistant. Your job is to return 3 specific, local, actionable recommendations for someone who wants to help with ${issue}.${context}

RULES:
1. Prefer the verified organizations listed above. Use their real URLs.
2. If you recommend an organization not in the list, you MUST be confident it is real and operating.
3. Do NOT invent organizations or websites.
4. Every actionUrl must be a plausible real URL — not a placeholder.
5. Descriptions must be concrete (mention specific program names, steps, contact methods).
6. Return ONLY a JSON object. No markdown, no prose, no explanation.

JSON SCHEMA:
{
  "cards": [
    {
      "title": "short action title (max 8 words)",
      "description": "2 specific sentences about what to do and why it matters locally",
      "badge": "do_today | contact | learn",
      "effort": "e.g. 15 min, 1 hour, this weekend",
      "actionUrl": "real working URL"
    }
  ]
}`;

  const userPrompt =
    `Location: ${location}
Issue: ${issue}
Time available: ${time}${skillText}

Return 3 actionable recommendations as the JSON schema above.`;

  return { systemPrompt, userPrompt };
}

// ── MAIN SERVICE FUNCTION ──────────────────────────────
/**
 * Calls Groq API to generate civic action recommendations.
 * Includes retry logic and response validation.
 *
 * @param {object} params
 * @param {string} params.location
 * @param {string} params.issue
 * @param {string} params.time
 * @param {string[]} params.skills
 * @param {number} [params.maxRetries=2]
 * @returns {Promise<object[]>} Array of validated action cards (before URL verification)
 */
async function generateActions({ location, issue, time, skills = [], maxRetries = 2 }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const groq = new Groq({ apiKey });
  const { systemPrompt, userPrompt } = buildPrompt(location, issue, time, skills);

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info({ attempt, location, issue }, 'Calling Groq API');

      const completion = await groq.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.6,  // Slightly lower for more consistent outputs
        max_tokens: 1024
      });

      const rawText = completion.choices?.[0]?.message?.content;
      if (!rawText) {
        throw new Error('Empty response from Groq API');
      }

      let parsed;
      try {
        // Strip any accidental markdown fences
        const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        throw new Error(`JSON parse failed: ${rawText.slice(0, 200)}`);
      }

      const validation = validateAiResponse(parsed);
      if (!validation.valid) {
        throw new Error(`Schema validation failed: ${validation.reason}`);
      }

      logger.info({ attempt, cardsReturned: validation.cards.length }, 'Groq API success');
      return validation.cards;

    } catch (err) {
      lastError = err;
      logger.warn({ attempt, error: err.message }, 'Groq API attempt failed');

      if (attempt < maxRetries) {
        // Brief backoff before retry
        await new Promise(r => setTimeout(r, 500 * attempt));
      }
    }
  }

  throw lastError || new Error('Failed to generate actions after retries');
}

module.exports = { generateActions, validateAiResponse, buildPrompt };