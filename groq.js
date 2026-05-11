const Groq = require('groq-sdk');

// ── URL VERIFIER ───────────────────────────────────────
// Checks if a URL is reachable. Falls back to a Google
// search for the card title + location if it's dead.
async function safeUrl(url, title, location) {
  const fallback = `https://www.google.com/search?q=${encodeURIComponent(`${title} ${location}`)}`;

  if (!url || !url.startsWith('http')) return fallback;

  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(4000) // don't wait more than 4s
    });
    return res.ok ? url : fallback;
  } catch {
    return fallback;
  }
}

// ── HANDLER ────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { location, issue, skills = [], time } = req.body || {};

  if (!location || !issue || !time) {
    return res.status(400).json({ error: 'Missing required fields: location, issue, or time.' });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'Missing GROQ_API_KEY environment variable.' });
  }

  const userSkills = Array.isArray(skills) ? skills.filter(Boolean) : [];
  const skillText = userSkills.length ? ` The user can help with: ${userSkills.join(', ')}.` : '';

  const prompt = `A user wants 3 specific, actionable things they can do right now to support ${issue} near ${location}, given ${time} of availability.${skillText}

Return ONLY a JSON object with a "cards" array. Each card must have exactly these 5 fields:
- title: short action title
- description: 2 specific sentences about what to do and why it matters
- badge: one of "do_today", "contact", or "learn"
- effort: e.g. "15 min", "1 hour", "this weekend"
- actionUrl: a real, working URL for an actual organisation, event page, or resource

No explanation, no markdown, just the JSON object.`;

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7
    });

    const text = completion.choices[0].message.content;
    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return res.status(502).json({ error: 'Could not parse response.', raw: text });
    }

    if (!parsed || !Array.isArray(parsed.cards)) {
      return res.status(502).json({ error: 'Unexpected response format.', raw: text });
    }

    // Verify all URLs in parallel — dead links become Google searches
    const verifiedCards = await Promise.all(
      parsed.cards.slice(0, 3).map(async (card) => ({
        ...card,
        actionUrl: await safeUrl(card.actionUrl, card.title, location)
      }))
    );

    return res.status(200).json({ cards: verifiedCards });

  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unknown server error.' });
  }
};