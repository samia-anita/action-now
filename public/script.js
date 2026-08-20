/* ══════════════════════════════════════════════════════════
   Action Now — script.js  (v2.0 production)
   ══════════════════════════════════════════════════════════ */

'use strict';

// ── STATE ──────────────────────────────────────────────────
const state = {
  location: '',
  issues: [],          // Multi-select (up to 3)
  skills: [],
  time: '',
  lastResults: null    // Cache last results for share/feedback
};

const MAX_ISSUES = 3;

// ── ELEMENTS ───────────────────────────────────────────────
const formScreen    = document.getElementById('form-screen');
const loadingScreen = document.getElementById('loading-screen');
const resultsScreen = document.getElementById('results-screen');
const errorScreen   = document.getElementById('error-screen');

const locationInput  = document.getElementById('location');
const submitBtn      = document.getElementById('submit-btn');
const cardsGrid      = document.getElementById('cards-grid');
const resultsCtx     = document.getElementById('results-context');
const loadingText    = document.getElementById('loading-text');
const errorMsg       = document.getElementById('error-msg');
const trustedLine    = document.getElementById('trusted-line');
const darkToggle     = document.getElementById('dark-toggle');
const issueLimitMsg  = document.getElementById('issue-limit-msg');

// ── DARK MODE ──────────────────────────────────────────────
(function initTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && prefersDark)) {
    document.body.classList.add('dark');
  }
  if (darkToggle) {
    const on = document.body.classList.contains('dark');
    darkToggle.textContent = on ? '☀' : '☾';
    darkToggle.setAttribute('aria-pressed', String(on));
  }
})();

if (darkToggle) {
  darkToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const on = document.body.classList.contains('dark');
    localStorage.setItem('theme', on ? 'dark' : 'light');
    darkToggle.textContent = on ? '☀' : '☾';
    darkToggle.setAttribute('aria-pressed', String(on));
  });
}

// ── SCREEN SWITCHER ────────────────────────────────────────
function show(screen) {
  [formScreen, loadingScreen, resultsScreen, errorScreen].forEach(s => {
    s.classList.remove('active');
    s.setAttribute('aria-hidden', 'true');
  });
  screen.classList.add('active');
  screen.removeAttribute('aria-hidden');
  // Move focus to first heading in new screen for screen readers
  const heading = screen.querySelector('h1, h2, [role="status"]');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
}

// ── VALIDATION — enable submit only when required fields filled ─
function validate() {
  const ok = state.location.trim().length >= 2 && state.issues.length > 0 && state.time;
  submitBtn.disabled = !ok;
  submitBtn.setAttribute('aria-disabled', String(!ok));
}

// ── LOCATION INPUT ─────────────────────────────────────────
locationInput.addEventListener('input', e => {
  state.location = e.target.value;
  validate();
});

// ── ISSUE TAGS (multi-select, up to MAX_ISSUES) ─────────────
document.getElementById('issue-tags').addEventListener('click', e => {
  const tag = e.target.closest('.tag');
  if (!tag) return;

  const val = tag.dataset.value;
  const alreadySelected = state.issues.includes(val);

  if (alreadySelected) {
    // Deselect
    state.issues = state.issues.filter(v => v !== val);
    tag.classList.remove('selected');
    tag.setAttribute('aria-pressed', 'false');
  } else {
    // Select if under limit
    if (state.issues.length >= MAX_ISSUES) {
      if (issueLimitMsg) {
        issueLimitMsg.style.display = 'block';
        setTimeout(() => { issueLimitMsg.style.display = 'none'; }, 3000);
      }
      return;
    }
    state.issues.push(val);
    tag.classList.add('selected');
    tag.setAttribute('aria-pressed', 'true');
  }

  if (issueLimitMsg) issueLimitMsg.style.display = 'none';
  validate();
});

// ── SKILL TAGS (multi-select) ──────────────────────────────
document.getElementById('skill-tags').addEventListener('click', e => {
  const tag = e.target.closest('.tag');
  if (!tag) return;

  tag.classList.toggle('selected');
  const val = tag.dataset.value;
  const selected = tag.classList.contains('selected');
  tag.setAttribute('aria-pressed', String(selected));

  if (selected) {
    if (!state.skills.includes(val)) state.skills.push(val);
  } else {
    state.skills = state.skills.filter(s => s !== val);
  }
});

// ── TIME BUTTONS (single select) ──────────────────────────
document.getElementById('time-buttons').addEventListener('click', e => {
  const btn = e.target.closest('.time-btn');
  if (!btn) return;

  document.querySelectorAll('.time-btn').forEach(b => {
    b.classList.remove('selected');
    b.setAttribute('aria-pressed', 'false');
  });
  btn.classList.add('selected');
  btn.setAttribute('aria-pressed', 'true');
  state.time = btn.dataset.value;
  validate();
});

// ── LOADING MESSAGES ───────────────────────────────────────
const loadingMessages = [
  'Searching for opportunities near you...',
  'Finding local organisations...',
  'Looking up real events and contacts...',
  'Almost there...'
];

function cycleLoadingMessages() {
  let i = 0;
  loadingText.textContent = loadingMessages[0];
  return setInterval(() => {
    i = (i + 1) % loadingMessages.length;
    loadingText.style.opacity = '0';
    setTimeout(() => {
      loadingText.textContent = loadingMessages[i];
      loadingText.style.opacity = '1';
    }, 300);
  }, 2200);
}

// ── BADGE CONFIG ───────────────────────────────────────────
const badgeConfig = {
  do_today: { label: '✦ Do it today',     cls: 'badge-do' },
  contact:  { label: '✉ Contact someone', cls: 'badge-contact' },
  learn:    { label: '◎ Learn something', cls: 'badge-learn' },
  default:  { label: '✦ Take action',     cls: 'badge-do' }
};

function normalizeBadgeKey(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.toLowerCase().trim();
  if (s.includes('do_today') || s.includes('do it') || /^do[\s_-]*today/.test(s)) return 'do_today';
  if (s.includes('contact')) return 'contact';
  if (s.includes('learn')) return 'learn';
  return null;
}

function getBadge(raw) {
  const key = normalizeBadgeKey(raw);
  if (key && badgeConfig[key]) return badgeConfig[key];
  return badgeConfig.default;
}

// ── XSS-SAFE HTML ESCAPE ───────────────────────────────────
function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t == null ? '' : String(t);
  return d.innerHTML;
}

// ── SAFE URL ───────────────────────────────────────────────
function safeHref(url) {
  if (!url || typeof url !== 'string') return '#';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '#';
    return parsed.href;
  } catch {
    return '#';
  }
}

// ── RENDER CARDS ───────────────────────────────────────────
function renderCards(cards) {
  cardsGrid.innerHTML = '';

  cards.forEach((card, i) => {
    const badge = getBadge(card.badge);
    const href = safeHref(card.actionUrl);
    const hasLink = href !== '#';

    const el = document.createElement('article');
    el.className = 'action-card';
    el.setAttribute('role', 'listitem');
    el.style.animationDelay = `${i * 0.08}s`;
    el.style.animation = 'fadeUp 0.5s ease both';

    // Reduced-motion: skip animation if user prefers it
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.style.animation = 'none';
      el.style.opacity = '1';
    }

    el.innerHTML = `
      <div class="card-top">
        <span class="card-badge ${badge.cls}">${badge.label}</span>
        <span class="card-effort">${escapeHtml(card.effort || '')}</span>
      </div>
      <h3 class="card-title">${escapeHtml(card.title || 'Action')}</h3>
      <p class="card-desc">${escapeHtml(card.description || '')}</p>
      ${hasLink
        ? `<a class="card-link" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="Get started: ${escapeHtml(card.title || 'Action')} (opens in new tab)">Get started</a>`
        : ''}
    `;

    cardsGrid.appendChild(el);
  });
}

// ── TRUSTED RESOURCE LAYER ─────────────────────────────────
function inferTrustRegion(location) {
  const s = (location || '').trim().toLowerCase();
  if (!s) return 'intl';

  if (
    /\bcanada\b/.test(s) ||
    /\b(on|bc|ab|sk|mb|qc|nl|ns|pe|nb|nt|yt|nu)\b/.test(s) ||
    /\b(toronto|montreal|calgary|ottawa|winnipeg|edmonton|mississauga|hamilton|halifax|saskatoon|regina|kelowna|charlottetown|fredericton|whitehorse|iqaluit)\b/.test(s) ||
    /\b(quebec city|québec)\b/.test(s) ||
    /\blondon\s*,\s*on\b/i.test(s)
  ) return 'ca';

  if (
    /\b(united kingdom|great britain|england|scotland|wales|northern ireland)\b/.test(s) ||
    /,[\s]*uk\s*$/i.test(location.trim()) ||
    /^uk\s*,/i.test(location.trim())
  ) return 'uk';

  if (
    /\b(united states|usa)\b/.test(s) ||
    /,[\s]*(al|ak|az|ar|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy|dc|pr|vi|gu|as)\b/i.test(location) ||
    /,[\s]*ca\b/i.test(location)
  ) return 'us';

  if (
    /\b(new york|los angeles|chicago|houston|phoenix|philadelphia|san antonio|san diego|dallas|san jose|austin|jacksonville|fort worth|columbus|charlotte|indianapolis|seattle|denver|boston|detroit|nashville|portland|oklahoma city|las vegas|milwaukee|atlanta|minneapolis|tampa|baltimore|orlando|sacramento|miami|raleigh|omaha|tucson|fresno|honolulu|anchorage)\b/.test(s)
  ) return 'us';

  return 'intl';
}

const TRUSTED_BY_REGION = {
  us: {
    'mental health': { text: 'In the United States, 988 connects to the Suicide & Crisis Lifeline (24/7). SAMHSA publishes official crisis and treatment information.', url: 'https://www.samhsa.gov/find-help/988', linkLabel: 'SAMHSA: 988 Lifeline' },
    'food insecurity': { text: 'Feeding America runs a public directory of member food banks — a common starting point before volunteering or donating.', url: 'https://www.feedingamerica.org/find-your-local-foodbank', linkLabel: 'Feeding America locator' },
    'climate & environment': { text: 'The U.S. Environmental Protection Agency publishes vetted overviews of climate change and practical responses.', url: 'https://www.epa.gov/climatechange', linkLabel: 'EPA climate resources' },
    'housing & homelessness': { text: 'The U.S. Interagency Council on Homelessness publishes federal policy and program resources on homelessness.', url: 'https://www.usich.gov/', linkLabel: 'USICH.gov' },
    'gender-based violence': { text: 'The National Domestic Violence Hotline offers 24/7 phone and chat and safety-planning basics.', url: 'https://www.thehotline.org/', linkLabel: 'The Hotline' },
    'social justice': { text: 'USA.gov explains how to find and contact elected officials at federal, state, and local levels.', url: 'https://www.usa.gov/elected-officials', linkLabel: 'USA.gov: elected officials' },
    'education access': { text: 'The U.S. Department of Education publishes family-facing information on public school rights and programs.', url: 'https://www.ed.gov/parents', linkLabel: 'ED.gov for parents' },
    'animal welfare': { text: 'The Humane Society of the United States publishes national guidance on adoption, fostering, and volunteering.', url: 'https://www.humanesociety.org/', linkLabel: 'HumaneSociety.org' },
    _default: { text: 'USA.gov links to official U.S. federal resources and how to find local government services.', url: 'https://www.usa.gov/', linkLabel: 'USA.gov' }
  },
  ca: {
    'mental health': { text: 'In Canada, 988 routes to suicide prevention responders. The federal government also lists mental health services and supports.', url: 'https://988.ca/', linkLabel: '988.ca (Canada)' },
    'food insecurity': { text: 'Food Banks Canada coordinates the national network and publishes a food bank finder.', url: 'https://foodbankscanada.ca/', linkLabel: 'Food Banks Canada' },
    'climate & environment': { text: 'The Government of Canada publishes official environment and climate change information and programs.', url: 'https://www.canada.ca/en/services/environment.html', linkLabel: 'Canada.ca: environment' },
    'housing & homelessness': { text: 'The Canadian Observatory on Homelessness (Homeless Hub) curates research and policy resources used across Canada.', url: 'https://www.homelesshub.ca/', linkLabel: 'Homeless Hub' },
    'gender-based violence': { text: 'Women and Gender Equality Canada publishes official information on gender-based violence and federal initiatives.', url: 'https://www.canada.ca/en/women-gender-equality/gender-based-violence.html', linkLabel: 'Canada.ca: GBV' },
    'social justice': { text: 'The Government of Canada explains rights, multiculturalism, and anti-discrimination resources at the federal level.', url: 'https://www.canada.ca/en/services/culture.html', linkLabel: 'Canada.ca: culture & justice' },
    'education access': { text: 'The Government of Canada outlines how education works and where to find provincial and territorial information.', url: 'https://www.canada.ca/en/services/education.html', linkLabel: 'Canada.ca: education' },
    'animal welfare': { text: 'Humane Canada is the national federation representing SPCAs and humane societies across the country.', url: 'https://humane.ca/', linkLabel: 'Humane Canada' },
    _default: { text: 'Canada.ca is the official federal portal for programs and services.', url: 'https://www.canada.ca/en.html', linkLabel: 'Canada.ca' }
  },
  uk: {
    'mental health': { text: 'The NHS publishes England-wide mental health information, including how to access urgent help.', url: 'https://www.nhs.uk/mental-health/', linkLabel: 'NHS mental health' },
    'food insecurity': { text: 'The Trussell Trust supports a UK-wide network of food banks and publishes how to find help or volunteer.', url: 'https://www.trusselltrust.org/', linkLabel: 'Trussell Trust' },
    'climate & environment': { text: 'GOV.UK hosts official UK government guidance on energy, environment, and net-zero policy.', url: 'https://www.gov.uk/government/organisations/department-for-energy-security-and-net-zero', linkLabel: 'GOV.UK: DESNZ' },
    'housing & homelessness': { text: 'The UK government publishes official guidance for local authorities on homelessness duties and prevention.', url: 'https://www.gov.uk/government/collections/homelessness-guidance-for-local-authorities', linkLabel: 'GOV.UK: homelessness guidance' },
    'gender-based violence': { text: 'The NHS explains how to get help after rape or sexual assault, including national support services.', url: 'https://www.nhs.uk/live-well/sexual-health/help-after-rape-and-sexual-assault/', linkLabel: 'NHS: help after assault' },
    'social justice': { text: 'GOV.UK is the official portal for UK government services, rights, and how to contact authorities.', url: 'https://www.gov.uk/', linkLabel: 'GOV.UK' },
    'education access': { text: 'GOV.UK lists official information on schools, further education, and student finance in the UK.', url: 'https://www.gov.uk/browse/education', linkLabel: 'GOV.UK: education' },
    'animal welfare': { text: 'The RSPCA is a major UK charity publishing guidance on animal welfare, adoption, and reporting cruelty.', url: 'https://www.rspca.org.uk/', linkLabel: 'RSPCA' },
    _default: { text: 'GOV.UK links to official UK government departments and services.', url: 'https://www.gov.uk/', linkLabel: 'GOV.UK' }
  },
  intl: {
    'mental health': { text: 'The World Health Organization publishes evidence-based mental health overviews that apply in any country.', url: 'https://www.who.int/teams/mental-health-and-substance-use', linkLabel: 'WHO mental health' },
    'food insecurity': { text: 'The World Food Programme is the UN agency leading global work on hunger and food assistance.', url: 'https://www.wfp.org/', linkLabel: 'World Food Programme' },
    'climate & environment': { text: 'The United Nations hosts official climate science summaries and international climate action context.', url: 'https://www.un.org/en/climatechange', linkLabel: 'UN: climate change' },
    'housing & homelessness': { text: 'UN-Habitat is the UN programme focused on sustainable cities and adequate shelter worldwide.', url: 'https://unhabitat.org/', linkLabel: 'UN-Habitat' },
    'gender-based violence': { text: 'UN Women coordinates global policy resources on ending violence against women and girls.', url: 'https://www.unwomen.org/en/what-we-do/ending-violence-against-women', linkLabel: 'UN Women' },
    'social justice': { text: 'The UN Office of the High Commissioner for Human Rights publishes international human rights standards and bodies.', url: 'https://www.ohchr.org/en/human-rights', linkLabel: 'OHCHR' },
    'education access': { text: 'UNESCO is the UN agency for education, literacy, and global education goals.', url: 'https://www.unesco.org/en/education', linkLabel: 'UNESCO education' },
    'animal welfare': { text: 'The International Fund for Animal Welfare works across many countries on wildlife and domestic animal protection.', url: 'https://www.ifaw.org/', linkLabel: 'IFAW' },
    _default: { text: 'The United Nations portal links to official global programmes and country-level UN presence.', url: 'https://www.un.org/en/globalissues', linkLabel: 'UN global issues' }
  }
};

function getTrustedRow(issue, region) {
  const reg = TRUSTED_BY_REGION[region] ? region : 'intl';
  const table = TRUSTED_BY_REGION[reg];
  return table[issue] || table._default || TRUSTED_BY_REGION.intl._default;
}

function renderTrustedLine(issues, location) {
  if (!trustedLine) return;
  trustedLine.innerHTML = '';
  if (!issues.length) return;

  // Use the first issue for the trusted resource line
  const region = inferTrustRegion(location);
  const row = getTrustedRow(issues[0], region);

  const span = document.createElement('span');
  span.textContent = `${row.text} `;

  const a = document.createElement('a');
  a.href = row.url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.className = 'trust-line__link';
  a.textContent = row.linkLabel;

  trustedLine.appendChild(span);
  trustedLine.appendChild(a);
}

// ── SHARE FUNCTIONALITY ────────────────────────────────────
function buildShareUrl(issues, location, time) {
  const params = new URLSearchParams({
    issues: issues.join(','),
    location,
    time
  });
  return `${window.location.origin}/app.html?${params.toString()}`;
}

function buildShareText(cards, issues, location, time) {
  const header = `My civic actions for ${issues.join(' & ')} in ${location} (${time}):`;
  const cardLines = cards.map((c, i) =>
    `${i + 1}. ${c.title} — ${c.actionUrl}`
  ).join('\n');
  return `${header}\n\n${cardLines}\n\nfind yours at ${window.location.origin}`;
}

function showShareConfirm(msg) {
  const el = document.getElementById('share-confirm');
  if (!el) return;
  el.textContent = msg;
  setTimeout(() => { el.textContent = ''; }, 2500);
}

document.getElementById('copy-link-btn')?.addEventListener('click', () => {
  const url = buildShareUrl(state.issues, state.location, state.time);
  navigator.clipboard.writeText(url)
    .then(() => showShareConfirm('✓ Link copied!'))
    .catch(() => showShareConfirm('Could not copy — try manually'));
});

document.getElementById('copy-text-btn')?.addEventListener('click', () => {
  if (!state.lastResults) return;
  const text = buildShareText(state.lastResults, state.issues, state.location, state.time);
  navigator.clipboard.writeText(text)
    .then(() => showShareConfirm('✓ Text copied!'))
    .catch(() => showShareConfirm('Could not copy — try manually'));
});

// ── FEEDBACK COLLECTION ────────────────────────────────────
function showFeedbackConfirm(msg) {
  const el = document.getElementById('feedback-confirm');
  if (!el) return;
  el.textContent = msg;
  setTimeout(() => { el.textContent = ''; }, 2500);
}

function storeFeedback(value) {
  try {
    const existing = JSON.parse(localStorage.getItem('action-now-feedback') || '[]');
    existing.push({
      value,
      issues: state.issues,
      location: state.location,
      time: state.time,
      ts: Date.now()
    });
    // Keep only last 50 feedback entries
    const trimmed = existing.slice(-50);
    localStorage.setItem('action-now-feedback', JSON.stringify(trimmed));
  } catch {
    // localStorage may not be available — fail silently
  }
}

document.getElementById('feedback-yes')?.addEventListener('click', function() {
  storeFeedback('helpful');
  showFeedbackConfirm('Thanks! 🙏');
  document.getElementById('feedback-yes').disabled = true;
  document.getElementById('feedback-no').disabled = true;
});

document.getElementById('feedback-no')?.addEventListener('click', function() {
  storeFeedback('not_helpful');
  showFeedbackConfirm('Thanks for the feedback.');
  document.getElementById('feedback-yes').disabled = true;
  document.getElementById('feedback-no').disabled = true;
});

// ── PERSISTENCE — save and restore last results ────────────
function saveLastSession(data) {
  try {
    localStorage.setItem('action-now-last', JSON.stringify({
      ...data,
      ts: Date.now()
    }));
  } catch { /* fail silently */ }
}

// ── SUBMIT ─────────────────────────────────────────────────
submitBtn.addEventListener('click', async () => {
  show(loadingScreen);
  const interval = cycleLoadingMessages();

  // Re-enable feedback buttons for fresh results
  const fbYes = document.getElementById('feedback-yes');
  const fbNo = document.getElementById('feedback-no');
  if (fbYes) fbYes.disabled = false;
  if (fbNo) fbNo.disabled = false;

  try {
    // Use first issue for the API call (primary issue for single-issue API)
    // Multi-issue: combine into comma-separated string for the prompt
    const issueStr = state.issues.join(' and ');

    const res = await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: state.location.trim(),
        issue: state.issues[0],          // Primary issue for RAG/validation
        skills: state.skills,
        time: state.time
      })
    });

    clearInterval(interval);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.error || `Server error ${res.status}`;
      // Don't expose raw internal errors to the user
      throw new Error(res.status >= 500 ? 'The server encountered an error. Please try again in a moment.' : msg);
    }

    const data = await res.json();

    if (!data.cards || data.cards.length === 0) {
      throw new Error('No actions returned. Please try again.');
    }

    state.lastResults = data.cards;

    resultsCtx.textContent = `${issueStr} · ${state.location} · ${state.time}`;
    renderTrustedLine(state.issues, state.location.trim());
    renderCards(data.cards);
    show(resultsScreen);

    // Persist session
    saveLastSession({
      cards: data.cards,
      issues: state.issues,
      location: state.location,
      time: state.time
    });

  } catch (err) {
    clearInterval(interval);
    errorMsg.textContent = err.message || 'Something went wrong. Please try again.';
    show(errorScreen);
  }
});

// ── BACK / RETRY ───────────────────────────────────────────
function resetToForm() {
  show(formScreen);
  locationInput.focus();
}

document.getElementById('back-btn')?.addEventListener('click', resetToForm);
document.getElementById('retry-btn')?.addEventListener('click', resetToForm);
document.getElementById('error-back-btn')?.addEventListener('click', resetToForm);

// ── KEYBOARD NAVIGATION ────────────────────────────────────
// Allow Enter to activate tag buttons (they're already buttons so this is
// handled natively, but ensure focus styles are visible)
document.querySelectorAll('.tag, .time-btn').forEach(btn => {
  btn.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      btn.click();
    }
  });
});

// ── SCREEN READER ONLY STYLES (added via JS to avoid FOUC) ──
if (!document.getElementById('sr-only-style')) {
  const style = document.createElement('style');
  style.id = 'sr-only-style';
  style.textContent = `
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0,0,0,0);
      white-space: nowrap;
      border-width: 0;
    }
    .skip-link {
      position: absolute;
      top: -100%;
      left: 0;
      background: #000;
      color: #fff;
      padding: 8px 16px;
      z-index: 9999;
      text-decoration: none;
      font-size: 0.875rem;
    }
    .skip-link:focus {
      top: 0;
    }
  `;
  document.head.appendChild(style);
}
