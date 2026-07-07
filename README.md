# Action Now

Turn concern into action. Tell it where you are, what you care about, and how much time you have — Action Now uses AI to surface 3 specific, local, real things you can do today.

![Node](https://img.shields.io/badge/Node.js-Express-green)
![Groq](https://img.shields.io/badge/LLM-Groq%20Llama%203.3-blueviolet)

---

## Overview

Most calls to action ("volunteer more," "reduce your footprint") never tell you *how* or *what to do today*. Action Now asks for three inputs — your location, the cause you care about, and your available time — and returns three concrete, actionable suggestions, each tagged as something to do today, someone to contact, or something to learn.

Every suggested link is verified server-side before being shown: if the URL is dead or unreachable, the app falls back to a Google search for that organization/event instead of showing a broken link.

---

## Features

- AI-generated, personalized action suggestions via Groq's Llama 3.3 70B
- Three categories per result: **Do today**, **Contact someone**, **Learn something**
- Live link verification with automatic fallback to a search query for dead links
- Optional skills input to tailor suggestions to what the user can offer
- No account or sign-up required
- Landing page + interactive app, both static HTML/CSS/JS served by a small Express backend

---

## Project Structure

```
action-now/
├── index.html          # Landing page
├── app.html             # Interactive form + results app
├── script.js            # Front-end logic for app.html
├── style.css             # Styles for app.html
├── server.js            # Express server, static file hosting, /api/actions route
├── groq.js               # Groq API call, prompt construction, URL verification
├── backgrounds/          # Hero video/icon assets
└── package.json
```

---

## Setup

```bash
git clone https://github.com/samia-anita/action-now.git
cd action-now
npm install
```

Create a `.env` file in the project root with a [Groq API key](https://console.groq.com):

```
GROQ_API_KEY=your_key_here
```

Then start the server:

```bash
npm start
```

Visit `http://localhost:3000` for the landing page, or `http://localhost:3000/app.html` to go straight to the tool.

---

## How It Works

1. The user submits a location, a cause/issue, available time, and optionally a list of skills.
2. The server sends a structured prompt to Groq (`llama-3.3-70b-versatile`), requesting a JSON object with exactly 3 action "cards" (title, description, badge type, effort estimate, and a source URL).
3. Each returned URL is checked with a `HEAD` request; if it's missing, invalid, or unreachable within 4 seconds, it's replaced with a Google search link for that title + location instead.
4. The verified cards are returned to the front end and rendered.

---

## API

**`POST /api/actions`**

Request body:
```json
{
  "location": "Toronto, ON",
  "issue": "food insecurity",
  "time": "1 hour",
  "skills": ["cooking", "driving"]
}
```

Response:
```json
{
  "cards": [
    {
      "title": "...",
      "description": "...",
      "badge": "do_today | contact | learn",
      "effort": "1 hour",
      "actionUrl": "https://..."
    }
  ]
}
```

---

## Limitations

- Suggestions are only as good as the LLM's world knowledge of local organizations — it can hallucinate plausible-sounding but incorrect details even when the fallback link itself resolves correctly.
- Link verification checks reachability, not relevance — a live URL isn't guaranteed to be the *correct* organization.
- No caching, so repeated identical requests hit the Groq API every time.

---

## Next Steps

- [ ] Cache repeated location/issue/time combinations to cut API calls
- [ ] Add automated tests for `groq.js`'s URL verification and JSON parsing paths
- [ ] Surface a "why this suggestion" explanation from the model
- [ ] Deploy a live demo link

---

## Tech Stack

- Node.js + Express — server and static hosting
- Groq SDK (Llama 3.3 70B) — action generation
- Vanilla HTML/CSS/JS — front end
- dotenv — environment variable management
