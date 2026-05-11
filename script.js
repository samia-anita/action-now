// ── STATE ──────────────────────────────────────────────
const state = {
  location: '',
  issue: '',
  skills: [],
  time: ''
};

// ── ELEMENTS ───────────────────────────────────────────
const formScreen    = document.getElementById('form-screen');
const loadingScreen = document.getElementById('loading-screen');
const resultsScreen = document.getElementById('results-screen');
const errorScreen   = document.getElementById('error-screen');

const locationInput = document.getElementById('location');
const submitBtn     = document.getElementById('submit-btn');
const cardsGrid     = document.getElementById('cards-grid');
const resultsCtx    = document.getElementById('results-context');
const loadingText   = document.getElementById('loading-text');
const errorMsg      = document.getElementById('error-msg');

// ── SCREEN SWITCHER ────────────────────────────────────
function show(screen) {
  [formScreen, loadingScreen, resultsScreen, errorScreen].forEach(s => s.classList.remove('active'));
  screen.classList.add('active');
}

// ── VALIDATE — enable submit only when all fields filled ─
function validate() {
  const ok = state.location.trim() && state.issue && state.time;
  submitBtn.disabled = !ok;
}

// ── LOCATION INPUT ─────────────────────────────────────
locationInput.addEventListener('input', e => {
  state.location = e.target.value;
  validate();
});

// ── ISSUE TAGS (single select) ─────────────────────────
document.getElementById('issue-tags').addEventListener('click', e => {
  const tag = e.target.closest('.tag');
  if (!tag) return;

  document.querySelectorAll('#issue-tags .tag').forEach(t => t.classList.remove('selected'));
  tag.classList.add('selected');
  state.issue = tag.dataset.value;
  validate();
});

// ── SKILL TAGS (multi select) ──────────────────────────
document.getElementById('skill-tags').addEventListener('click', e => {
  const tag = e.target.closest('.tag');
  if (!tag) return;

  tag.classList.toggle('selected');
  const val = tag.dataset.value;

  if (tag.classList.contains('selected')) {
    state.skills.push(val);
  } else {
    state.skills = state.skills.filter(s => s !== val);
  }
});

// ── TIME BUTTONS (single select) ──────────────────────
document.getElementById('time-buttons').addEventListener('click', e => {
  const btn = e.target.closest('.time-btn');
  if (!btn) return;

  document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  state.time = btn.dataset.value;
  validate();
});

// ── LOADING MESSAGES ───────────────────────────────────
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
    loadingText.style.opacity = 0;
    setTimeout(() => {
      loadingText.textContent = loadingMessages[i];
      loadingText.style.opacity = 1;
    }, 300);
  }, 2200);
}

// ── BADGE CONFIG ───────────────────────────────────────
const badgeConfig = {
  do_today:  { label: '✦ Do it today',     cls: 'badge-do' },
  contact:   { label: '✉ Contact someone', cls: 'badge-contact' },
  learn:     { label: '◎ Learn something', cls: 'badge-learn' },
  // fallback for any other value Groq returns
  default:   { label: '✦ Take action',     cls: 'badge-do' }
};

function getBadge(raw) {
  if (!raw) return badgeConfig.default;
  const key = raw.toLowerCase().replace(/\s+/g, '_');
  return badgeConfig[key] || { label: raw, cls: 'badge-do' };
}

// ── RENDER CARDS ───────────────────────────────────────
function renderCards(cards) {
  cardsGrid.innerHTML = '';

  cards.forEach((card, i) => {
    const badge = getBadge(card.badge);
    const hasLink = card.actionUrl && card.actionUrl.startsWith('http');

    const el = document.createElement('article');
    el.className = 'action-card';
    el.style.animationDelay = `${i * 0.08}s`;
    el.style.animation = 'fadeUp 0.5s ease both';

    el.innerHTML = `
      <div class="card-top">
        <span class="card-badge ${badge.cls}">${badge.label}</span>
        <span class="card-effort">${card.effort || ''}</span>
      </div>
      <h3 class="card-title">${card.title || 'Action'}</h3>
      <p class="card-desc">${card.description || ''}</p>
      ${hasLink
        ? `<a class="card-link" href="${card.actionUrl}" target="_blank" rel="noopener">Get started</a>`
        : ''}
    `;

    cardsGrid.appendChild(el);
  });
}

// ── SUBMIT ─────────────────────────────────────────────
submitBtn.addEventListener('click', async () => {
  show(loadingScreen);
  const interval = cycleLoadingMessages();

  try {
    const res = await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: state.location.trim(),
        issue:    state.issue,
        skills:   state.skills,
        time:     state.time
      })
    });

    clearInterval(interval);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server error ${res.status}`);
    }

    const data = await res.json();

    if (!data.cards || data.cards.length === 0) {
      throw new Error('No actions returned. Try again.');
    }

    resultsCtx.textContent = `${state.issue} · ${state.location} · ${state.time}`;
    renderCards(data.cards);
    show(resultsScreen);

  } catch (err) {
    clearInterval(interval);
    errorMsg.textContent = err.message || 'Something went wrong. Please try again.';
    show(errorScreen);
  }
});

// ── BACK / RETRY ───────────────────────────────────────
function resetToForm() {
  show(formScreen);
}

document.getElementById('back-btn').addEventListener('click', resetToForm);
document.getElementById('retry-btn').addEventListener('click', resetToForm);
document.getElementById('error-back-btn').addEventListener('click', resetToForm);