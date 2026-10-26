'use strict';
// Shared pieces for the hub, Solitaire and Mahjong pages. The player profile (XP, gold, themes, sound)
// lives in the Sudoku save, so every game feeds the same level and wallet and the theme shop covers all three.
const Common = (() => {
const $ = (s, el = document) => el.querySelector(s);
const PROFILE_KEY = 'sudokuQuest.save.v1';
const SOL_KEY = 'tatami.solitaire.v1';
const MJ_KEY = 'tatami.mahjong.v1';

const readJSON = k => { try { return JSON.parse(localStorage.getItem(k)) || null; } catch (e) { return null; } };
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

/* ---------- Profile ---------- */
// Always read-modify-write, never cache: another page may have changed it since this one loaded
const profile = () => readJSON(PROFILE_KEY) || {};
function award(gold, xp) {
  const p = profile();
  const before = levelInfo(p.xp || 0).level;
  p.gold = (p.gold || 0) + gold; p.xp = (p.xp || 0) + xp;
  writeJSON(PROFILE_KEY, p);
  const after = levelInfo(p.xp).level;
  return { profile: p, levelUp: after > before ? after : 0 };
}
const needXp = L => 50 * (L - 1) * L;
function levelInfo(xp) {
  let L = 1; while (xp >= needXp(L + 1)) L++;
  return { level: L, cur: xp - needXp(L), span: needXp(L + 1) - needXp(L) };
}
const TITLES = [[1, 'Pilgrim'], [3, 'Student'], [5, 'Apprentice'], [8, 'Disciple'], [12, 'Scholar'], [16, 'Sensei'], [20, 'Master'], [30, 'Grandmaster']];
const titleFor = L => TITLES.filter(t => L >= t[0]).pop()[1];

const THEME_META = { lacquer: '#140d0b', parchment: '#efe6d4', midnight: '#0d0e22', sakura: '#ffeef4', abyss: '#03131a', ember: '#140705', neon: '#07010f', aurora: '#040a16', gilded: '#0a0805' };
function applyTheme() {
  const t = THEME_META[profile().theme] ? profile().theme : 'lacquer';
  document.body.dataset.theme = t;
  $('meta[name="theme-color"]').setAttribute('content', THEME_META[t]);
}
const soundOn = () => { const s = profile().settings; return !s || s.sound !== false; };
function setSound(on) {
  const p = profile();
  p.settings = { ...(p.settings || {}), sound: on };
  writeJSON(PROFILE_KEY, p); soundCache = on;
}
let soundCache = soundOn();

/* ---------- Sound (Web Audio, unlocked by the first tap for iOS) ---------- */
let ac = null;
function audio() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
document.addEventListener('pointerdown', () => { if (soundCache) audio(); }, { passive: true });
function tone(freq, dur, type = 'sine', vol = 0.12, delay = 0) {
  if (!soundCache) return;
  const a = audio(); if (!a) return;
  const t0 = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(a.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
const sfx = {
  tap: () => tone(520, 0.06, 'sine', 0.05),
  card: () => { tone(1400, 0.03, 'triangle', 0.04); tone(700, 0.05, 'sine', 0.04, 0.01); },
  flip: () => tone(980, 0.05, 'triangle', 0.05),
  place: () => tone(660, 0.12, 'triangle', 0.1),
  clack: () => { tone(1800, 0.025, 'square', 0.03); tone(420, 0.08, 'triangle', 0.08, 0.01); },
  match: () => [784, 1175].forEach((f, i) => tone(f, 0.14, 'triangle', 0.08, i * 0.06)),
  error: () => { tone(160, 0.22, 'square', 0.07); tone(120, 0.25, 'square', 0.05, 0.08); },
  win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i === 5 ? 0.6 : 0.2, 'triangle', 0.11, i * 0.12)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.35, 'sawtooth', 0.05, i * 0.18)),
  coin: () => { tone(988, 0.08, 'square', 0.05); tone(1319, 0.25, 'square', 0.05, 0.08); },
};

/* ---------- UI primitives ---------- */
const ICON = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  undo: '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
  bulb: '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M12 8v8M8 12h8"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
  bolt: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
  coin: '<svg viewBox="0 0 24 24" class="coin"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v9M9.5 10h3.8a1.4 1.4 0 0 1 0 2.8h-2.6a1.4 1.4 0 0 0 0 2.8h3.8" stroke-width="1.4"/></svg>',
  mountains: `<svg class="mountains" viewBox="0 0 400 110" preserveAspectRatio="none" style="stroke:none">
    <path class="far" d="M0 70 L40 48 L70 60 L120 22 L160 52 L200 38 L250 64 L300 30 L340 55 L400 40 V110 H0z"/>
    <path class="near" d="M0 92 L50 66 L95 84 L150 56 L210 88 L260 70 L310 90 L360 62 L400 80 V110 H0z"/>
    <path class="mist" d="M0 98 Q100 86 200 98 T400 96 V110 H0z"/>
  </svg>`,
};
const fmtTime = sec => {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
};
function show(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.toggle('active', el.id === 'screen-' + id));
  window.scrollTo(0, 0);
}
const activeScreen = () => (document.querySelector('.screen.active') || {}).id;
let modalHandlers = {}, modalDismiss = true;
function modal(html, handlers = {}, dismiss = true) {
  $('#modal-card').innerHTML = html;
  $('#modal').classList.remove('hidden');
  modalHandlers = handlers; modalDismiss = dismiss;
}
function closeModal() { $('#modal').classList.add('hidden'); modalHandlers = {}; }
const modalOpen = () => !$('#modal').classList.contains('hidden');
$('#modal').addEventListener('click', e => {
  const a = e.target.closest('[data-act]');
  if (a) {
    const h = modalHandlers[a.dataset.act];
    if (h) h(a); else if (a.dataset.act === 'close') closeModal();
    return;
  }
  if (e.target.id === 'modal' && modalDismiss) closeModal();
});
function confirmModal(title, text, okLabel, onOk, danger) {
  modal(`<h2>${title}</h2><p class="muted">${text}</p>
    <div class="m-btns"><button class="btn ${danger ? 'danger' : 'primary'}" data-act="ok">${okLabel}</button><button class="btn" data-act="close">Cancel</button></div>`,
    { ok: () => { closeModal(); onOk(); } });
}
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}
const topbar = (title, sub, right = '', back = 'hub') => `<div class="topbar">
  <button class="icon-btn" data-go="${back}" aria-label="Back">${ICON.back}</button>
  <div class="tb-title"><div>${title}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
  ${right || '<div style="width:42px"></div>'}</div>`;
const goHub = () => { location.href = './'; };

// Win modal shared by Solitaire and Mahjong
function winModal({ icon, title, sub, stars, stats, gold, xp, levelUp, extra = '', btns, handlers }) {
  modal(`<div class="m-icon">${icon}</div><h2>${title}</h2><p class="muted" style="margin-top:0">${sub}</p>
    ${stars ? `<div class="stars-row">${[1, 2, 3].map(k => `<span class="star ${k <= stars ? 'on' : ''}" style="animation-delay:${0.15 + k * 0.25}s">★</span>`).join('')}</div>` : ''}
    <div class="win-stats" style="margin-top:12px">${stats.map(([v, l]) => `<div><b>${v}</b><small>${l}</small></div>`).join('')}</div>
    <div class="rewards"><span class="xp">+${xp} XP</span><span class="g">${ICON.coin}+${gold}</span></div>
    ${levelUp ? `<div class="banner">⬆️ Level ${levelUp}! You are a <b>${titleFor(levelUp)}</b>.</div>` : ''}${extra}
    <div class="m-btns">${btns}</div>`, handlers, false);
}

/* ---------- Confetti ---------- */
function confetti() {
  const cv = $('#confetti'), ctx = cv.getContext('2d'), dpr = window.devicePixelRatio || 1;
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cs = getComputedStyle(document.body);
  const colors = ['--accent', '--accent2', '--gold', '--good'].map(v => cs.getPropertyValue(v).trim());
  const parts = Array.from({ length: 140 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 80, y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 13, vy: -Math.random() * 13 - 4,
    s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const t0 = performance.now();
  (function frame(t) {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const alpha = Math.max(0, 1 - (t - t0) / 2800);
    parts.forEach(p => {
      p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
    });
    if (alpha > 0) requestAnimationFrame(frame); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })(t0);
}

const shuffle = (a, rnd = Math.random) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// A page restored from the back/forward cache holds a stale copy of the profile; reload it instead
window.addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});

return {
  $, PROFILE_KEY, SOL_KEY, MJ_KEY, readJSON, writeJSON, profile, award, levelInfo, titleFor, applyTheme, soundOn, setSound,
  sfx, ICON, fmtTime, show, activeScreen, modal, closeModal, modalOpen, confirmModal, toast, topbar, goHub, winModal, confetti, shuffle,
};
})();
