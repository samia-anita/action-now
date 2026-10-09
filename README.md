# Action Now

> An AI-powered civic action recommender — transforms concern into local, actionable steps in under a minute.

[GitHub](https://github.com/samia-anita/action-now)

---

## What It Does

Action Now takes three inputs:

- **Where you are** — your city or region
- **What you care about** — up to 3 issues (climate, food insecurity, housing, mental health, social justice, education, gender equity, animal welfare)
- **What you have** — time availability and optional skills

It returns **three specific, local, real actions** you can take right now, grounded in a curated database of verified organizations. Every link is verified server-side before it reaches you.

---

## Architecture

```
┌─────────────────────────┐         ┌─────────────────────────────────────────┐
│   Browser (static)      │  POST   │   Express server (Node.js)              │
│                         │ ──────► │                                         │
│  public/index.html      │         │  POST /api/actions                      │
│  public/app.html        │ ◄────── │   ├── Input validation (hand-rolled)    │
│  public/style.css       │  JSON   │   ├── In-memory cache (TTL: 5 min)      │
│  public/script.js       │         │   ├── retrievalService (RAG layer)      │
└─────────────────────────┘         │   │    └── organizations.json (DB)      │
                                    │   ├── groqService                       │
                                    │   │    ├── qwen/qwen3.6-27b (via Groq)  │
                                    │   │    ├── Response validation           │
                                    │   │    └── Retry logic (2 attempts)     │
                                    │   └── urlVerifier (parallel HEAD checks)│
                                    │                                         │
                                    │  GET /health                            │
                                    └─────────────────────────────────────────┘
```

### Project Structure

```
action-now/
├── src/
│   ├── server.js              # Express app + middleware wiring
│   ├── routes/
│   │   ├── actions.js         # POST /api/actions handler
│   │   └── health.js          # GET /health endpoint
│   ├── services/
│   │   ├── groqService.js     # Groq AI calls, prompt building, retry
│   │   └── retrievalService.js # RAG retrieval from org database
│   ├── middleware/
│   │   ├── errorHandler.js    # Centralized error handling
│   │   └── rateLimiter.js     # Hand-rolled in-memory rate limiting
│   ├── utils/
│   │   ├── validation.js      # Input validation, sanitization, enum checks
│   │   ├── locationInference.js # Region detection from free-text
│   │   ├── urlVerifier.js     # Parallel HEAD checks + fallback
│   │   ├── cache.js           # In-memory TTL cache
│   │   └── logger.js          # Structured JSON logging (hand-rolled)
│   └── data/
│       └── organizations.json # Curated verified org database (RAG source)
├── public/                    # Static frontend (served by Express)
│   ├── index.html             # Landing page
│   ├── app.html                # Application UI
│   ├── script.js               # Frontend logic
│   ├── style.css               # Styles
│   └── backgrounds/            # Static assets
├── tests/
│   ├── unit/
│   │   ├── validation.test.js
│   │   ├── locationInference.test.js
│   │   ├── cache.test.js
│   │   ├── urlVerifier.test.js
│   │   ├── groqService.test.js
│   │   └── retrievalService.test.js
│   └── api/
│       └── actions.test.js    # HTTP-level integration tests
├── .github/workflows/ci.yml   # GitHub Actions CI pipeline
├── Dockerfile
├── .env.example
└── package.json
```

---

## RAG Architecture

This project implements a retrieval step to ground generation and reduce hallucinations.

### The Problem with Pure LLM

A bare language model asked for local volunteering opportunities will confidently invent organizations, fabricate URLs, and produce plausible-sounding but unverifiable recommendations. This is the core hallucination problem.

### The Retrieval + Generation Flow

```
User Input
    │
    ▼
┌─────────────────────────────────────────┐
│  RETRIEVAL LAYER (retrievalService.js)  │
│                                         │
│  1. Infer region from location string   │
│  2. Query organizations.json by         │
│     (issue × region)                    │
│  3. Rank: region-specific > intl        │
│  4. Return top 3 matching orgs          │
└─────────────────────────────────────────┘
    │
    │ Inject verified org context
    ▼
┌─────────────────────────────────────────┐
│  GENERATION LAYER (groqService.js)      │
│                                         │
│  System prompt includes:                │
│  "VERIFIED ORGANIZATIONS:               │
│   - Feeding America: ... URL: ...       │
│   - Food Banks Canada: ... URL: ..."    │
│                                         │
│  Rule: prefer retrieved orgs,           │
│  do not invent organizations            │
└─────────────────────────────────────────┘
    │
    │ AI-generated cards (may use real orgs)
    ▼
┌─────────────────────────────────────────┐
│  VALIDATION + URL VERIFICATION          │
│                                         │
│  Schema validate every card             │
│  HEAD-check every URL in parallel       │
│  Dead links → Google search fallback    │
└─────────────────────────────────────────┘
    │
    ▼
  Response
```

**Note on retrieval:** matching is currently done by exact `issue` string and inferred region tag (a filtered lookup), not embedding-based semantic search. It's effective at grounding responses in real, verified organizations, but it isn't vector similarity retrieval.

### Knowledge Source

`src/data/organizations.json` contains 23 curated organizations across:
- 8 issue categories
- 4 regions (US, CA, UK, International)
- Each with: name, description, verified URLs, example actions

This database is intentionally small and hand-verified. Expanding it — and/or moving to embedding-based retrieval — is the highest-leverage improvement to recommendation quality.

---

## API

### `POST /api/actions`

Generate civic action recommendations.

**Request body:**
```json
{
  "location": "Toronto, ON",
  "issue": "food insecurity",
  "time": "about 1 hour",
  "skills": ["I can drive", "I can cook or bake"]
}
```

**Valid values:**
- `issue`: `climate & environment` | `food insecurity` | `housing & homelessness` | `mental health` | `gender-based violence` | `social justice` | `education access` | `animal welfare`
- `time`: `15 minutes` | `about 1 hour` | `a few hours this weekend` | `ongoing commitment`
- `skills`: any subset of the 8 skill options (optional)

**Response `200`:**
```json
{
  "cards": [
    {
      "title": "Volunteer at the Daily Bread Food Bank",
      "description": "Daily Bread has open volunteer slots for sorting and distribution this week. Show up and make an immediate difference.",
      "badge": "do_today",
      "effort": "1 hour",
      "actionUrl": "https://www.dailybread.ca/get-involved/volunteer/"
    }
  ],
  "cached": false,
  "durationMs": 2847
}
```

**Error responses:**
- `400` — validation error (invalid input)
- `429` — rate limited
- `500` — server or AI service error

### `GET /health`

Returns service status, uptime, memory, and cache stats. Use for load balancer health checks.

```json
{
  "status": "ok",
  "environment": "production",
  "uptime": { "ms": 86400000, "human": "1d 0h" },
  "memory": { "heapUsedMB": 48, "heapTotalMB": 72, "rssMB": 95 },
  "cache": { "size": 12, "hits": 47, "misses": 18, "hitRate": "72.3%" },
  "services": { "groq": "configured" }
}
```

---

## Security

| Measure | Implementation |
|---|---|
| Input validation | Strict enum checks on `issue`/`time`/`skills` — no free-text passed to the model unvalidated |
| Rate limiting | 60 req/min general, 10 req/min for AI generation endpoint (in-memory, per-IP) |
| Request size limit | `express.json({ limit: '10kb' })` |
| Security headers | `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Content-Security-Policy` |
| XSS prevention | All user-supplied values escaped via `textContent` before DOM insertion |
| URL safety | `safeHref()` rejects non-http/https schemes; server-side scheme checks |
| No secrets in frontend | API key used only server-side; never exposed to browser |
| Structured logging | JSON logs with sensitive headers redacted |
| Non-root Docker | Container runs as `appuser` (uid 1001), not root |

---

## Performance

- **Caching**: Identical requests (same location + issue + time + skills) are served from an in-memory TTL cache (5-minute expiry, 100-entry LRU). Cache hit rate reported in `/health`.
- **Parallel URL verification**: All 3 card URLs are HEAD-checked concurrently via `Promise.all`. Total latency = slowest single check, not sum of all three.
- **Static asset caching**: `Cache-Control: max-age=86400` for static files in production.

---

## Testing

```bash
# Run all tests
npm test

# Unit tests only
npm run test:unit

# API integration tests only
npm run test:api
```

### What's tested

| Test file | Coverage |
|---|---|
| `validation.test.js` | All valid/invalid inputs, every enum value, edge cases |
| `locationInference.test.js` | US/CA/UK/intl detection, case-insensitivity, 30+ cities |
| `cache.test.js` | TTL expiry, LRU eviction, stats, key determinism |
| `urlVerifier.test.js` | Live/dead URLs, network errors, XSS schemes, parallel verification |
| `groqService.test.js` | Response schema validation, all badge values, card filtering |
| `retrievalService.test.js` | Region-specific retrieval, international fallback, limit param |
| `actions.test.js` | Full API integration: 200/400/429/500 paths, caching, security headers |

Tests use Node's built-in `node:test` runner. The Groq API and `fetch` are mocked — no real API calls or network requests in the test suite.

---

## Setup & Running

### Prerequisites

- Node.js 18+
- A [Groq API key](https://console.groq.com/keys) (free tier available)

### Local development

```bash
# 1. Clone
git clone https://github.com/samia-anita/action-now.git
cd action-now

# 2. Install
npm install

# 3. Configure
cp .env.example .env
# Edit .env and add your GROQ_API_KEY

# 4. Run
npm run dev    # node --watch (auto-restarts on file changes)
# or
npm start

# Open: http://localhost:3000
```

### Docker

```bash
# Build
docker build -t action-now .

# Run
docker run -p 3000:3000 -e GROQ_API_KEY=your_key action-now

# With env file
docker run -p 3000:3000 --env-file .env action-now
```

---

## Extending the Organization Database

The retrieval layer (`src/data/organizations.json`) is the highest-leverage thing to improve. Each org entry follows this schema:

```json
{
  "id": "unique-slug",
  "name": "Organization Name",
  "issue": "food insecurity",
  "regions": ["us"],
  "cities": [],
  "url": "https://org-homepage.org",
  "volunteerUrl": "https://org-homepage.org/volunteer",
  "description": "One sentence about what they do and how to get involved.",
  "actions": ["specific action 1", "specific action 2"],
  "verified": true
}
```

Valid regions: `us`, `ca`, `uk`, `intl`. City-specific entries can go in `cities: ["Toronto", "Chicago"]` for future city-level retrieval.

---

## Scalability Notes

The current architecture handles hundreds of concurrent users on a single Node.js process. For higher scale:

- **Cache**: Replace the in-memory `Cache` class with Redis (`ioredis`) — the `cache.get/set` interface is already abstracted
- **Database**: Migrate `organizations.json` to SQLite (`better-sqlite3`) or PostgreSQL for larger org datasets and city-level queries
- **Retrieval**: Move from exact-match filtering to embedding-based similarity search for genuine semantic retrieval
- **Queue**: Add a job queue (e.g. BullMQ) for rate-limiting expensive Groq calls under sustained load
- **Observability**: The logger already emits structured JSON — pipe to Datadog, Grafana Loki, or AWS CloudWatch with no code changes
