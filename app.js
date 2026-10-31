'use strict';
(() => {
const $ = (s, el = document) => el.querySelector(s);
const SAVE_KEY = 'tatami.sudoku.v1';
// Same one-time move as in common.js (the Sudoku page may load before the hub has run it)
try {
  const old = localStorage.getItem('sudokuQuest.save.v1');
  if (old !== null && localStorage.getItem(SAVE_KEY) === null) {
    localStorage.setItem(SAVE_KEY, old);
    if (localStorage.getItem(SAVE_KEY) === old) localStorage.removeItem('sudokuQuest.save.v1');
  }
} catch (e) {}
const { ROW, COL, POP } = Sudoku;
const STAGES = 10; // per realm; the last one is the boss
const VARIANTS = [Sudoku.CLASSIC, Sudoku.DIAGONAL].map(v => ({ ...v, PEER_SET: v.PEERS.map(p => new Set(p)) }));
const V = g => VARIANTS[g && g.diag ? 1 : 0]; // peers/units for the current game

/* ---------- Game data ---------- */
const DIFFS = {
  novice: { name: 'Novice', gold: 10, xp: 20, color: '#4ade80', blurb: 'Gentle warm-up, plenty of clues' },
  easy:   { name: 'Easy',   gold: 15, xp: 30, color: '#22d3ee', blurb: 'Every step is in plain sight' },
  medium: { name: 'Medium', gold: 25, xp: 50, color: '#a78bfa', blurb: 'Hunt for hidden singles' },
  hard:   { name: 'Hard',   gold: 40, xp: 80, color: '#fb923c', blurb: 'Needs pairs and deeper logic' },
  expert: { name: 'Expert', gold: 60, xp: 120, color: '#f43f5e', blurb: 'Sparse, cruel and beautiful' },
};
const DIFF_KEYS = Object.keys(DIFFS);

const REALMS = [
  { name: 'Bamboo Grove',     diff: 'novice', icon: '🎋', boss: 'The Grove Tanuki',     bossIcon: '🦝', hue: '#7fb069', lore: 'Wind whispers through the stalks. Every path is clear here.' },
  { name: 'Misty Mountains',  diff: 'easy',   icon: '🗻', boss: 'The Mountain Oni',     bossIcon: '👹', hue: '#8fb8c8', lore: 'Clouds wrap the slopes. Look closely and the way appears.' },
  { name: 'Fox Shrine',       diff: 'medium', icon: '⛩️', boss: 'The Nine-Tailed Kitsune', bossIcon: '🦊', hue: '#e8743b', lore: 'A thousand red gates. The answers hide between them.' },
  { name: "Dragon's Peak",    diff: 'hard',   icon: '⛰️', boss: 'The Storm Dragon',     bossIcon: '🐉', hue: '#9b7fd1', lore: 'Thunder rolls over the summit. Only the patient survive the climb.' },
  { name: 'Celestial Palace', diff: 'expert', icon: '🏯', boss: 'The Moon Emperor',     bossIcon: '🌕', hue: '#e8c06a', lore: 'Above the clouds, the final grids are written in moonlight.' },
];

// One twist per boss, by realm index
const TWISTS = [
  { id: 'shuffle',  icon: '🍃', name: "Tanuki's Trick",      desc: 'The tanuki has shuffled the keys on your number pad. Read carefully before you tap.' },
  { id: 'fog',      icon: '🌫️', name: 'Mountain Fog',        desc: 'Fog hides some of the given numbers. Solve a square in a box to clear the fog there.' },
  { id: 'illusion', icon: '🦊', name: 'Fox-Fire Illusions',  desc: 'Four numbers on the board are illusions. Spot the duplicates and write over them.' },
  { id: 'storm',    icon: '⚡', name: 'Racing the Storm',    desc: 'The storm breaks in 25 minutes. Finish the grid before it does.' },
  { id: 'diagonal', icon: '🌕', name: 'Celestial Diagonals', desc: 'Both long diagonals must also contain 1 to 9, just like rows, columns and boxes.' },
];
const STORM_LIMIT = 25 * 60;

const KANJI = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const NUMERALS = [
  { id: 'arabic', name: 'Arabic', price: 0,   desc: 'Classic 1 to 9' },
  { id: 'kanji',  name: 'Kanji',  price: 200, desc: 'Brushed 一 to 九' },
];
const glyph = d => (S.numerals === 'kanji' ? KANJI[d] : String(d));

const THEMES = [
  { id: 'lacquer',   name: 'Lacquer',   price: 0,    desc: 'Ink, vermilion and gold', meta: '#140d0b' },
  { id: 'parchment', name: 'Washi',     price: 0,    desc: 'Rice paper and red ink', meta: '#efe6d4' },
  { id: 'midnight',  name: 'Midnight',  price: 0,    desc: 'Violet dusk',            meta: '#0d0e22' },
  { id: 'sakura',    name: 'Sakura',    price: 150,  desc: 'Cherry blossom calm',    meta: '#ffeef4' },
  { id: 'abyss',     name: 'Abyss',     price: 250,  desc: 'Deep-sea glow',          meta: '#03131a' },
  { id: 'ember',     name: 'Ember',     price: 350,  desc: 'Forged in fire',         meta: '#140705' },
  { id: 'neon',      name: 'Neon',      price: 500,  desc: 'Synthwave nights',       meta: '#07010f' },
  { id: 'aurora',    name: 'Aurora',    price: 750,  desc: 'Living northern lights', meta: '#040a16' },
  { id: 'gilded',    name: 'Gilded',    price: 1000, desc: 'Black and gold, for legends', meta: '#0a0805' },
];

const TITLES = [[1, 'Pilgrim'], [3, 'Student'], [5, 'Apprentice'], [8, 'Disciple'], [12, 'Scholar'], [16, 'Sensei'], [20, 'Master'], [30, 'Grandmaster']];

const ACH_GOLD = 50;
const ACHIEVEMENTS = [
  { id: 'first',    icon: '🖌️', name: 'First Brushstroke', desc: 'Solve your first puzzle' },
  { id: 'flawless', icon: '💠', name: 'Flawless',       desc: 'Solve with no mistakes or hints' },
  { id: 'swift',    icon: '⚡', name: 'Swift Mind',     desc: 'Solve Medium or harder in under 8 min' },
  ...REALMS.map((r, i) => ({ id: 'boss' + i, icon: r.bossIcon, name: r.name + ' Cleared', desc: 'Defeat ' + r.boss })),
  { id: 'daily3',   icon: '🔥', name: 'Kindled',        desc: 'Reach a 3-day daily streak' },
  { id: 'daily7',   icon: '☄️', name: 'Eternal Flame',  desc: 'Reach a 7-day daily streak' },
  { id: 'solve25',  icon: '📜', name: 'Scholar',        desc: 'Solve 25 puzzles' },
  { id: 'solve100', icon: '📚', name: 'Loremaster',     desc: 'Solve 100 puzzles' },
  { id: 'collector', icon: '🪭', name: 'Collector',     desc: 'Own 5 themes' },
  { id: 'allseeing', icon: '👁️', name: 'All-Seeing',    desc: 'Solve an Expert puzzle flawlessly' },
  { id: 'stars100', icon: '⭐', name: 'Star Gatherer',  desc: 'Collect 100 quest stars' },
];

const ICON = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M9 5v14M15 5v14"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path class="fill" d="M8 5l11 7-11 7z"/></svg>',
  undo: '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
  erase: '<svg viewBox="0 0 24 24"><path d="M20 20H9l-5-5a2 2 0 0 1 0-2.8L13.2 3a2 2 0 0 1 2.8 0L21 8a2 2 0 0 1 0 2.8L12 20"/><path d="M8 11l6 6"/></svg>',
  pencil: '<svg viewBox="0 0 24 24"><path d="M4 20l1-5L16 4l4 4L9 19z"/><path d="M14 6l4 4"/></svg>',
  bulb: '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/></svg>',
  coin: '<svg viewBox="0 0 24 24" class="coin"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v9M9.5 10h3.8a1.4 1.4 0 0 1 0 2.8h-2.6a1.4 1.4 0 0 0 0 2.8h3.8" stroke-width="1.4"/></svg>',
  // ink-wash mountain ridges behind the home title
  mountains: `<svg class="mountains" viewBox="0 0 400 110" preserveAspectRatio="none" style="stroke:none">
    <path class="far" d="M0 70 L40 48 L70 60 L120 22 L160 52 L200 38 L250 64 L300 30 L340 55 L400 40 V110 H0z"/>
    <path class="near" d="M0 92 L50 66 L95 84 L150 56 L210 88 L260 70 L310 90 L360 62 L400 80 V110 H0z"/>
    <path class="mist" d="M0 98 Q100 86 200 98 T400 96 V110 H0z"/>
  </svg>`,
  grid: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/><path d="M5.5 5.5h1M11.5 11.5h1M17.5 17.5h1" stroke-width="2.4"/></svg>',
};

/* ---------- Save data ---------- */
function defaultSave() {
  return {
    version: 1, xp: 0, gold: 0,
    theme: 'lacquer', owned: ['lacquer', 'parchment', 'midnight'], numerals: 'arabic',
    settings: { sound: true, peers: true, same: true, autoNotes: true, timer: true },
    quest: {},        // "realm-stage" -> { stars, best, clears }
    daily: {},        // "YYYY-MM-DD" -> { time, stars }
    stats: { solved: 0, flawless: 0, timePlayed: 0, streak: 0, bestStreak: 0, lastDaily: null, swift: false, allseeing: false, byDiff: {} },
    ach: {},          // id -> timestamp
    current: null,    // puzzle in progress
  };
}
function load() {
  const d = defaultSave();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return d;
    const s = JSON.parse(raw);
    // saves from before the Lacquer theme existed: grant it and switch to it once
    if (s.owned && !s.owned.includes('lacquer')) { s.owned.unshift('lacquer'); s.theme = 'lacquer'; }
    return { ...d, ...s, settings: { ...d.settings, ...s.settings }, stats: { ...d.stats, ...s.stats } };
  } catch (e) { return d; }
}
let S = load();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

/* ---------- Helpers ---------- */
const qkey = (r, s) => r + '-' + s;
const fmtTime = sec => {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
};
const dayKey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const prevDayKey = key => { const [y, m, d] = key.split('-').map(Number); return dayKey(new Date(y, m - 1, d - 1)); };
const DAILY_DIFF = ['expert', 'easy', 'medium', 'medium', 'hard', 'medium', 'hard']; // Sun..Sat
const dailyDiff = (d = new Date()) => DAILY_DIFF[d.getDay()];
const needXp = L => 50 * (L - 1) * L;
function levelInfo(xp) {
  let L = 1;
  while (xp >= needXp(L + 1)) L++;
  return { level: L, cur: xp - needXp(L), span: needXp(L + 1) - needXp(L) };
}
const titleFor = L => TITLES.filter(t => L >= t[0]).pop()[1];
const starStr = n => '<b>' + '★'.repeat(n) + '</b>' + '★'.repeat(3 - n);
const realmUnlocked = r => r === 0 || !!S.quest[qkey(r - 1, STAGES - 1)];
const stageUnlocked = (r, s) => realmUnlocked(r) && (s === 0 || !!S.quest[qkey(r, s - 1)]);
const stageLabel = s => s === STAGES - 1 ? 'Boss' : 'Stage ' + (s + 1);
const totalStars = () => Object.values(S.quest).reduce((a, q) => a + (q.stars || 0), 0);
function nextQuestStage() {
  for (let r = 0; r < REALMS.length; r++)
    for (let s = 0; s < STAGES; s++)
      if (stageUnlocked(r, s) && !S.quest[qkey(r, s)]) return { r, s };
  return null;
}
function currentStreak() {
  const st = S.stats, t = dayKey();
  return st.lastDaily === t || st.lastDaily === prevDayKey(t) ? st.streak : 0;
}
function applyTheme() {
  document.body.dataset.theme = S.theme;
  const t = THEMES.find(x => x.id === S.theme) || THEMES[0];
  $('meta[name="theme-color"]').setAttribute('content', t.meta);
}

/* ---------- Sound (Web Audio, unlocked by the first tap for iOS) ---------- */
let ac = null;
function audio() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
document.addEventListener('pointerdown', () => { if (S.settings.sound) audio(); }, { passive: true });
function tone(freq, dur, type = 'sine', vol = 0.12, delay = 0) {
  if (!S.settings.sound) return;
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
  place: () => tone(660, 0.12, 'triangle', 0.1),
  note: () => tone(880, 0.05, 'sine', 0.04),
  error: () => { tone(160, 0.22, 'square', 0.07); tone(120, 0.25, 'square', 0.05, 0.08); },
  unit: () => [784, 988, 1175].forEach((f, i) => tone(f, 0.18, 'triangle', 0.08, i * 0.07)),
  win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i === 5 ? 0.6 : 0.2, 'triangle', 0.11, i * 0.12)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.35, 'sawtooth', 0.05, i * 0.18)),
  coin: () => { tone(988, 0.08, 'square', 0.05); tone(1319, 0.25, 'square', 0.05, 0.08); },
};

/* ---------- UI primitives ---------- */
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
const topbar = (title, sub, right = '') => `<div class="topbar">
  <button class="icon-btn" data-go="home" aria-label="Back">${ICON.back}</button>
  <div class="tb-title"><div>${title}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
  ${right || '<div style="width:42px"></div>'}</div>`;
const goldPill = () => `<div class="pill" style="color:var(--gold)">${ICON.coin}${S.gold}</div>`;

/* ---------- Home ---------- */
const PETALS = '<div class="petals">' + Array.from({ length: 14 }, () =>
  `<i style="left:${(Math.random() * 100).toFixed(1)}%;animation-duration:${(9 + Math.random() * 9).toFixed(1)}s;animation-delay:-${(Math.random() * 18).toFixed(1)}s;width:${(6 + Math.random() * 7).toFixed(0)}px;height:${(5 + Math.random() * 5).toFixed(0)}px"></i>`).join('') + '</div>';
function describeGame(g) {
  if (g.mode === 'quest') return REALMS[g.realm].name + ' · ' + stageLabel(g.stage);
  if (g.mode === 'daily') return 'Daily Challenge · ' + DIFFS[g.diff].name;
  return 'Quick Play · ' + DIFFS[g.diff].name;
}
function renderHome() {
  const li = levelInfo(S.xp), next = nextQuestStage(), dk = dayKey(), dailyDone = S.daily[dk], g = S.current, streak = currentStreak();
  $('#screen-home').innerHTML = `
    ${PETALS}
    <button class="icon-btn hub-back" data-go="hub" aria-label="All games">${ICON.back}</button>
    <div class="hero"><div class="sun"></div>${ICON.mountains}<div class="seal">数</div><h1>Sudoku Quest</h1><p class="jp">数独の旅</p><p class="tag">Master the grid. Climb the mountain. Reach the Celestial Palace.</p></div>
    <div class="card player">
      <div class="avatar"><span>${li.level}</span></div>
      <div class="pinfo">
        <div class="ptitle">${titleFor(li.level)}<small>Lv ${li.level}</small></div>
        <div class="xpbar"><i style="width:${(li.cur / li.span * 100).toFixed(1)}%"></i></div>
        <div class="xptext">${li.cur} / ${li.span} XP · ⭐ ${totalStars()}</div>
      </div>
      <div class="gold-big">${ICON.coin}${S.gold}</div>
    </div>
    ${g ? `<button class="big primary" data-go="resume"><span class="bi">▶️</span><span><b>Continue</b><small>${describeGame(g)} · ${fmtTime(g.elapsed)}</small></span><span class="chev">›</span></button>` : ''}
    <button class="big" data-go="map"><span class="bi">🏯</span><span><b>Quest</b><small>${next ? REALMS[next.r].icon + ' ' + REALMS[next.r].name + ' · ' + stageLabel(next.s) : '🌕 Every realm conquered!'}</small></span><span class="chev">›</span></button>
    <button class="big" data-go="daily" ${dailyDone ? 'disabled' : ''}><span class="bi">🏮</span><span><b>Daily Challenge</b><small>${dailyDone ? `Solved in ${fmtTime(dailyDone.time)} · back tomorrow` : DIFFS[dailyDiff()].name + ' · bonus gold'}${streak ? ` · <span class="streak">🔥 ${streak}</span>` : ''}</small></span><span class="chev">${dailyDone ? '✓' : '›'}</span></button>
    <button class="big" data-go="quick"><span class="bi">🎴</span><span><b>Quick Play</b><small>Any difficulty, no hearts</small></span><span class="chev">›</span></button>
    <div class="mini-row">
      <button data-go="shop">🪭<span>Themes</span></button>
      <button data-go="journal">📜<span>Journal</span></button>
      <button data-go="settings">⚙️<span>Settings</span></button>
    </div>`;
}

/* ---------- Quest map ---------- */
let mapRealm = 0;
function renderMap() {
  const R = REALMS[mapRealm], unlocked = realmUnlocked(mapRealm);
  const stars = Array.from({ length: STAGES }, (_, s) => (S.quest[qkey(mapRealm, s)] || {}).stars || 0);
  const got = stars.reduce((a, b) => a + b, 0);
  const tabs = REALMS.map((r, i) => `<button class="rtab ${i === mapRealm ? 'on' : ''} ${realmUnlocked(i) ? '' : 'locked'}" data-realm="${i}" style="--hue:${r.hue}">${realmUnlocked(i) ? r.icon : '🔒'}</button>`).join('');
  let body;
  if (!unlocked) {
    body = `<div class="card locked-note"><div>🔒</div>Defeat <b>${REALMS[mapRealm - 1].boss}</b> in ${REALMS[mapRealm - 1].name} to open this realm.</div>`;
  } else {
    const pts = Array.from({ length: STAGES }, (_, s) => ({ x: 50 + Math.sin(s * 1.1 + 0.5) * 27, y: 52 + s * 100 }));
    pts[STAGES - 1].y += 14;
    const H = pts[STAGES - 1].y + 70;
    const seg = (a, b) => ` C${a.x} ${a.y + 50} ${b.x} ${b.y - 50} ${b.x} ${b.y}`;
    let d = `M${pts[0].x} ${pts[0].y}`, dDone = d;
    let lastDone = -1;
    for (let s = 0; s < STAGES; s++) if (S.quest[qkey(mapRealm, s)]) lastDone = s;
    for (let s = 1; s < STAGES; s++) {
      d += seg(pts[s - 1], pts[s]);
      if (s <= lastDone + 1) dDone += seg(pts[s - 1], pts[s]); // lit trail reaches the next open stage
    }
    const nodes = pts.map((p, s) => {
      const boss = s === STAGES - 1, done = !!S.quest[qkey(mapRealm, s)], open = stageUnlocked(mapRealm, s);
      const cls = done ? 'done' : open ? 'current' : 'locked';
      const label = boss ? R.bossIcon : open || done ? s + 1 : '🔒';
      return `<button class="node ${cls} ${boss ? 'boss' : ''}" style="left:${p.x}%;top:${p.y}px" data-stage="${s}">${label}${done ? `<span class="nstars">${starStr(stars[s])}</span>` : ''}</button>`;
    }).join('');
    const decos = pts.filter((_, s) => s % 2 === 1 && s < STAGES - 1).map(p => `<span class="deco" style="left:${100 - p.x}%;top:${p.y}px">${R.icon}</span>`).join('');
    body = `<div class="trail-wrap" style="height:${H}px">
      <svg class="trail" viewBox="0 0 100 ${H}" preserveAspectRatio="none" style="height:${H}px"><path class="t-bg" d="${d}"/>${lastDone >= 0 ? `<path class="t-done" d="${dDone}"/>` : ''}</svg>
      ${decos}${nodes}</div>`;
  }
  $('#screen-map').style.setProperty('--hue', R.hue);
  $('#screen-map').innerHTML = `${topbar('Quest Map', '⭐ ' + totalStars() + ' / ' + REALMS.length * STAGES * 3, goldPill())}
    <div class="rtabs">${tabs}</div>
    <div class="card realm-head"><div class="ri">${R.icon}</div>
      <div><h2>${R.name}</h2><p>${R.lore}</p><span class="chip">${DIFFS[R.diff].name}</span></div>
      <div class="rstars">${got}<small>/ ${STAGES * 3} ★</small></div></div>
    ${body}`;
}
function openMap(r) {
  if (r == null) { const n = nextQuestStage(); r = n ? n.r : REALMS.length - 1; }
  mapRealm = r; renderMap(); show('map');
}
$('#screen-map').addEventListener('click', e => {
  const t = e.target.closest('[data-realm]');
  if (t) { sfx.tap(); mapRealm = +t.dataset.realm; renderMap(); return; }
  const n = e.target.closest('[data-stage]');
  if (n) stageModal(mapRealm, +n.dataset.stage);
});
function stageModal(r, s) {
  if (!stageUnlocked(r, s)) { toast('Clear the previous stage first'); return; }
  const R = REALMS[r], boss = s === STAGES - 1, rec = S.quest[qkey(r, s)], D = DIFFS[R.diff];
  const maxGold = D.gold * 3 * (boss ? 2 : 1);
  modal(`<div class="m-icon">${boss ? R.bossIcon : R.icon}</div>
    <h2>${boss ? R.boss : stageLabel(s)}</h2>
    <p class="muted">${R.name} · ${D.name}${boss ? ' · Boss' : ''}</p>
    <p>${boss ? 'A guardian bars the way. Fewer clues, only <b>1 reveal</b>, and three hearts. Win to open the next realm.' : 'Three hearts, three reveals. Finish without mistakes or reveals for ★★★.'}</p>
    ${boss ? `<div class="banner" style="text-align:left">${TWISTS[r].icon} <b>${TWISTS[r].name}</b><br><span class="muted">${TWISTS[r].desc}</span></div>` : ''}
    ${rec ? `<div class="stars-row" style="margin:8px 0 0">${[1, 2, 3].map(k => `<span class="star ${k <= rec.stars ? 'on' : ''}" style="font-size:28px;animation:none">★</span>`).join('')}</div><p class="muted" style="margin-top:0">Best ${fmtTime(rec.best)} · replay for a new puzzle</p>` : `<p class="muted">Reward: up to <b style="color:var(--gold)">${maxGold}</b> gold</p>`}
    <div class="m-btns"><button class="btn primary" data-act="go">${rec ? 'Replay' : boss ? 'Face the guardian' : 'Begin'}</button><button class="btn" data-act="close">Not yet</button></div>`,
    { go: () => { closeModal(); startQuest(r, s); } });
}
function startQuest(r, s) {
  const rec = S.quest[qkey(r, s)];
  startGame({ mode: 'quest', realm: r, stage: s, diff: REALMS[r].diff, boss: s === STAGES - 1, seed: Sudoku.hash(`quest:${r}:${s}:${rec ? rec.clears : 0}`) });
}

/* ---------- Starting games ---------- */
const sameGame = (a, b) => a.mode === b.mode && a.seed === b.seed;
const hasProgress = g => g.elapsed > 15 || g.values.some((v, i) => v !== g.puzzle[i]);
function startGame(opts) {
  const g = S.current;
  if (g && sameGame(g, opts)) return openGame();
  if (g && hasProgress(g)) {
    return confirmModal('Abandon puzzle?', `Your ${describeGame(g)} in progress will be lost.`, 'Abandon & start', () => createGame(opts), true);
  }
  createGame(opts);
}
function createGame(opts) {
  $('#loading').classList.remove('hidden');
  setTimeout(() => {
    const twist = opts.mode === 'quest' && opts.boss ? TWISTS[opts.realm].id : null;
    const { puzzle, solution } = Sudoku.generate(opts.diff, opts.seed, { boss: opts.boss, diag: twist === 'diagonal' });
    S.current = {
      ...opts, puzzle, solution, values: puzzle.slice(), notes: new Array(81).fill(0),
      mistakes: 0, lives: opts.mode === 'quick' ? null : 3, hints: opts.boss ? 1 : 3, hintsUsed: 0, elapsed: 0, history: [],
    };
    if (twist) applyTwist(S.current, twist);
    persist();
    $('#loading').classList.add('hidden');
    openGame();
  }, 60);
}
function applyTwist(g, id) {
  const r = Sudoku.rng(g.seed ^ 0x9e3779b9);
  g.twist = id;
  if (id === 'diagonal') g.diag = true;
  if (id === 'shuffle') g.padOrder = Sudoku.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], r);
  if (id === 'storm') g.timeLimit = STORM_LIMIT;
  if (id === 'fog') g.fog = Sudoku.pickFog(g.puzzle, g.seed + 1, 10);
  if (id === 'illusion') {
    // decoys sit in empty squares and always duplicate a visible given, so a sharp eye can catch them
    g.illusions = {};
    for (const i of Sudoku.shuffle(Array.from({ length: 81 }, (_, k) => k).filter(k => !g.puzzle[k]), r)) {
      if (Object.keys(g.illusions).length >= 4) break;
      const seen = [...new Set(V(g).PEERS[i].map(p => g.puzzle[p]).filter(d => d && d !== g.solution[i]))];
      if (seen.length) g.illusions[i] = seen[Math.floor(r() * seen.length)];
    }
  }
}
function startDaily() {
  const dk = dayKey();
  if (S.daily[dk]) { toast('Already solved today 🎉'); return; }
  startGame({ mode: 'daily', diff: dailyDiff(), seed: Sudoku.hash('daily:' + dk), dateKey: dk });
}
function quickModal() {
  modal(`<div class="m-icon">🎴</div><h2>Quick Play</h2><p class="muted">Free play: no hearts, half gold.</p>
    <div class="diff-list">${DIFF_KEYS.map(k => {
      const b = (S.stats.byDiff[k] || {}).best;
      return `<button class="diff-btn" data-act="pick" data-k="${k}" style="--hue:${DIFFS[k].color}"><div><b>${DIFFS[k].name}</b><small>${DIFFS[k].blurb}</small></div><span>${b ? '🏁 ' + fmtTime(b) : ''}</span></button>`;
    }).join('')}</div>
    <div class="m-btns"><button class="btn" data-act="close">Cancel</button></div>`,
    { pick: el => { closeModal(); startGame({ mode: 'quick', diff: el.dataset.k, seed: (Math.random() * 2 ** 32) >>> 0 }); } });
}

/* ---------- Game screen ---------- */
let cells = [], keys = [], selected = -1, notesMode = false, paused = false;
let sensei = null; // current hint step: { kind, cell, digit, unit, text }; not saved
function buildGameScreen() {
  const el = $('#screen-game');
  el.innerHTML = `<div class="topbar">
      <button class="icon-btn" id="g-back" aria-label="Back">${ICON.back}</button>
      <div class="tb-title"><div id="g-name"></div><div class="sub" id="g-sub"></div></div>
      <button class="icon-btn" id="g-pause" aria-label="Pause">${ICON.pause}</button></div>
    <div class="sensei hidden" id="sensei"><span class="ss-seal" id="ss-seal">師</span><p id="ss-text"></p><button class="ss-x" id="ss-x" aria-label="Close">×</button></div>
    <div class="g-stats"><div id="g-lives"></div><div id="g-timer">0:00</div></div>
    <div class="board-wrap"><div class="board" id="board"></div>
      <div class="paused-cover hidden" id="paused-cover"><button id="g-resume">${ICON.play} Resume</button></div></div>
    <div class="tools">
      <button class="tool" id="t-undo">${ICON.undo}<span>Undo</span></button>
      <button class="tool" id="t-erase">${ICON.erase}<span>Erase</span></button>
      <button class="tool" id="t-notes">${ICON.pencil}<span>Notes</span><em id="notes-badge">OFF</em></button>
      <button class="tool" id="t-fill">${ICON.grid}<span>Fill notes</span></button>
      <button class="tool" id="t-hint">${ICON.bulb}<span id="hint-label">Hint</span><em id="hint-badge">3</em></button>
    </div>
    <div class="numpad" id="numpad"></div>`;
  const board = $('#board');
  for (let i = 0; i < 81; i++) {
    const c = document.createElement('div');
    c.className = 'cell';
    c.innerHTML = '<span class="v"></span><div class="notes">' + '<i></i>'.repeat(9) + '</div>';
    c.dataset.i = i;
    board.appendChild(c); cells.push(c);
  }
  const pad = $('#numpad');
  for (let d = 1; d <= 9; d++) {
    const k = document.createElement('button');
    k.className = 'key'; k.dataset.d = d;
    k.innerHTML = '<span></span><small></small>';
    pad.appendChild(k); keys.push(k);
  }
  board.addEventListener('click', e => {
    const c = e.target.closest('.cell'); if (!c || paused) return;
    selected = +c.dataset.i; sfx.tap(); renderBoard();
  });
  pad.addEventListener('click', e => { const k = e.target.closest('.key'); if (k) input(+k.dataset.d); });
  $('#t-undo').onclick = undo;
  $('#t-erase').onclick = erase;
  $('#t-notes').onclick = () => { notesMode = !notesMode; sfx.tap(); renderTools(); };
  $('#t-fill').onclick = fillNotes;
  $('#t-hint').onclick = hint;
  $('#ss-x').onclick = () => { clearSensei(); renderBoard(); renderTools(); };
  $('#g-pause').onclick = () => setPaused(!paused);
  $('#g-resume').onclick = () => setPaused(false);
  $('#g-back').onclick = leaveGame;
}
function leaveGame() {
  const g = S.current; persist();
  if (g && g.mode === 'quest') openMap(g.realm); else goHome();
}
function setPaused(p) {
  paused = p;
  $('#board').classList.toggle('blur', p);
  $('#paused-cover').classList.toggle('hidden', !p);
  $('#g-pause').innerHTML = p ? ICON.play : ICON.pause;
  persist();
}
function openGame() {
  const g = S.current; if (!g) return goHome();
  selected = -1; notesMode = false; clearSensei();
  const name = $('#g-name'), sub = $('#g-sub'), twist = g.twist && TWISTS.find(t => t.id === g.twist);
  if (g.mode === 'quest') {
    const R = REALMS[g.realm];
    name.textContent = R.icon + ' ' + R.name;
    sub.textContent = g.boss ? 'Boss · ' + (twist ? twist.icon + ' ' + twist.name : R.boss) : stageLabel(g.stage) + ' · ' + DIFFS[g.diff].name;
    $('#screen-game').style.setProperty('--hue', R.hue);
  } else {
    name.textContent = g.mode === 'daily' ? '🏮 Daily Challenge' : '🎴 Quick Play';
    sub.textContent = DIFFS[g.diff].name + (g.mode === 'daily' ? ' · ' + g.dateKey : '');
    $('#screen-game').style.setProperty('--hue', DIFFS[g.diff].color);
  }
  const order = g.padOrder || [1, 2, 3, 4, 5, 6, 7, 8, 9];
  keys.forEach((k, j) => { k.dataset.d = order[j]; });
  cells.forEach((c, i) => c.classList.toggle('diag', !!g.diag && (ROW[i] === COL[i] || ROW[i] + COL[i] === 8)));
  show('game');
  setPaused(false);
  if (twist && !g.history.length && g.elapsed < 3) {
    sensei = { kind: 'info' };
    showSensei(`<b>${twist.name}.</b> ${twist.desc}`, twist.icon);
  }
  renderGame();
}

/* What the player can see: fog hides givens, illusions show fake numbers */
const fogged = (g, i) => !!(g.fog && g.fog.includes(i));
const illusion = (g, i) => (g.illusions && g.illusions[i]) || 0;
const shown = (g, i) => fogged(g, i) ? 0 : g.values[i] || illusion(g, i);
const knownVal = (g, i) => { const v = g.values[i]; return v && v === g.solution[i] && !fogged(g, i) ? v : 0; };
function candidates(g, i) {
  let m = Sudoku.ALL;
  for (const p of V(g).PEERS[i]) { const x = knownVal(g, p); if (x) m &= ~(1 << x); }
  return m;
}

function renderGame() { renderBoard(); renderPad(); renderTools(); renderStats(); }
function renderBoard() {
  const g = S.current; if (!g) return;
  const sel = selected, sv = sel >= 0 ? shown(g, sel) : 0, peers = V(g).PEER_SET;
  const hu = sensei && sensei.unit ? new Set(sensei.unit) : null;
  const hc = sensei && (sensei.kind === 'naked' || sensei.kind === 'deep') ? sensei.cell : -1;
  $('#board').classList.toggle('kanji', S.numerals === 'kanji');
  for (let i = 0; i < 81; i++) {
    const c = cells[i], v = g.values[i], fog = fogged(g, i), fake = !v && illusion(g, i), cl = c.classList;
    const given = !!g.puzzle[i] && !fog, d = shown(g, i);
    cl.toggle('given', given || !!fake);
    cl.toggle('fog', fog);
    cl.toggle('user', !g.puzzle[i] && !!v);
    cl.toggle('wrong', !g.puzzle[i] && !!v && v !== g.solution[i]);
    cl.toggle('sel', i === sel);
    cl.toggle('peer', S.settings.peers && sel >= 0 && peers[sel].has(i));
    cl.toggle('same', S.settings.same && !!sv && d === sv && i !== sel);
    cl.toggle('hint-unit', !!hu && hu.has(i));
    cl.toggle('hint-cell', i === hc);
    c.firstChild.textContent = d ? glyph(d) : '';
    const n = d ? 0 : g.notes[i], ns = c.lastChild.children;
    for (let k = 1; k <= 9; k++) {
      const on = !!(n & (1 << k)), el = ns[k - 1];
      el.textContent = on ? k : '';
      el.classList.toggle('hl', on && k === sv);
    }
  }
}
function renderPad() {
  const g = S.current, counts = new Array(10).fill(0);
  g.values.forEach((v, i) => { if (knownVal(g, i)) counts[v]++; });
  keys.forEach(k => {
    const d = +k.dataset.d, left = 9 - counts[d];
    k.classList.toggle('done', left === 0);
    k.firstChild.textContent = glyph(d);
    k.lastChild.textContent = left;
  });
  $('#numpad').classList.toggle('notes-mode', notesMode);
  $('#numpad').classList.toggle('kanji', S.numerals === 'kanji');
}
function renderTools() {
  const g = S.current, revealing = sensei && sensei.kind !== 'info';
  $('#t-notes').classList.toggle('on', notesMode);
  $('#notes-badge').textContent = notesMode ? 'ON' : 'OFF';
  $('#hint-label').textContent = revealing ? 'Reveal' : 'Hint';
  $('#t-hint').classList.toggle('on', !!revealing);
  $('#hint-badge').textContent = g.hints;
  $('#numpad').classList.toggle('notes-mode', notesMode);
}
function renderStats() {
  const g = S.current, t = $('#g-timer');
  $('#g-lives').innerHTML = g.lives != null
    ? [0, 1, 2].map(k => `<span class="heart ${k < g.lives ? '' : 'lost'}">♥</span>`).join('')
    : `<span class="muted">Mistakes: ${g.mistakes}</span>`;
  if (g.timeLimit) {
    const left = g.timeLimit - g.elapsed;
    t.textContent = '⚡ ' + fmtTime(left) + ' left';
    t.classList.toggle('storm', left <= 120);
  } else {
    t.textContent = S.settings.timer ? '⏱ ' + fmtTime(g.elapsed) : '';
    t.classList.remove('storm');
  }
}

/* ---------- Sensei hints ---------- */
function showSensei(html, seal = '師') {
  $('#ss-seal').textContent = seal;
  $('#ss-text').innerHTML = html;
  $('#sensei').classList.remove('hidden');
}
function clearSensei() { sensei = null; $('#sensei').classList.add('hidden'); }
// Finds the easiest next step a person could spot: hidden single in a box, then a naked
// single, then hidden singles in rows/columns/diagonals. Falls back to the most constrained square.
function findStep(g) {
  const v = V(g), open = i => !knownVal(g, i), target = i => open(i) && !g.puzzle[i];
  const cand = Array.from({ length: 81 }, (_, i) => open(i) ? candidates(g, i) : 0);
  const unitName = u => u < 9 ? 'row' : u < 18 ? 'column' : u < 27 ? 'box' : 'diagonal';
  const where = v.diag ? 'row, column, box or diagonal' : 'row, column or box';
  const hidden = units => {
    for (const u of units) {
      const cellsIn = v.UNITS[u];
      for (let d = 1; d <= 9; d++) {
        if (cellsIn.some(i => knownVal(g, i) === d)) continue;
        const spots = cellsIn.filter(i => open(i) && (cand[i] & (1 << d)));
        if (spots.length === 1 && target(spots[0])) {
          return { kind: 'hidden', cell: spots[0], digit: d, unit: cellsIn,
            text: `Look at the glowing ${unitName(u)}. There is only <b>one</b> square where <b>${glyph(d)}</b> can go. Can you find it?` };
        }
      }
    }
    return null;
  };
  const naked = i => ({ kind: 'naked', cell: i, digit: g.solution[i], unit: v.PEERS[i],
    text: `Study the bright square. Every number but one already appears in its ${where}. Which one is left?` });
  const range = (a, b) => Array.from({ length: b - a }, (_, k) => a + k);

  if (selected >= 0 && target(selected) && POP[cand[selected]] === 1) return naked(selected);
  const box = hidden(range(18, 27));
  if (box) return box;
  for (let i = 0; i < 81; i++) if (target(i) && POP[cand[i]] === 1) return naked(i);
  const line = hidden([...range(0, 18), ...range(27, v.UNITS.length)]);
  if (line) return line;
  let best = -1, bn = 10;
  for (let i = 0; i < 81; i++) if (target(i) && POP[cand[i]] < bn) { bn = POP[cand[i]]; best = i; }
  if (best < 0) return null;
  return { kind: 'deep', cell: best, digit: g.solution[best], unit: [best],
    text: `No simple step here. The bright square has only <b>${bn}</b> possible numbers. Try notes, or tap Reveal.` };
}
function hint() {
  const g = S.current; if (!g || paused) return;
  if (!sensei || sensei.kind === 'info') {
    // first tap: a free nudge that explains where to look
    const step = findStep(g);
    if (!step) return;
    sensei = step;
    showSensei(step.text);
    tone(784, 0.15, 'sine', 0.06); tone(1175, 0.25, 'sine', 0.05, 0.1);
    renderBoard(); renderTools();
    return;
  }
  // second tap: reveal the answer, which costs a hint
  if (g.hints <= 0) { toast(g.boss ? 'The guardian allows only one reveal' : 'No reveals left. Sensei can still guide you'); return; }
  const i = sensei.cell, d = sensei.digit;
  clearSensei();
  pushHistory([i, ...peersWithNote(i, d)]);
  g.values[i] = d; g.notes[i] = 0;
  clearPeerNotes(i, d);
  dispel(i);
  g.hints--; g.hintsUsed++;
  selected = i;
  popCell(i);
  if (!afterCorrect(i)) tone(1047, 0.2, 'sine', 0.08);
  if (checkWin()) return;
  persist(); renderGame();
}
function fillNotes() {
  const g = S.current; if (!g || paused) return;
  const changed = [], next = {};
  for (let i = 0; i < 81; i++) {
    if (g.values[i] || g.puzzle[i]) continue;
    const m = candidates(g, i);
    if (g.notes[i] !== m) { changed.push(i); next[i] = m; }
  }
  if (!changed.length) { toast('Notes are already complete'); return; }
  pushHistory(changed);
  changed.forEach(i => { g.notes[i] = next[i]; });
  clearSensei();
  sfx.note(); toast('Notes filled in ✍️');
  persist(); renderGame();
}

function pushHistory(idx) {
  const g = S.current;
  g.history.push(idx.map(i => [i, g.values[i], g.notes[i]]));
  if (g.history.length > 250) g.history.shift();
}
function clearPeerNotes(i, d, affected) {
  const g = S.current, bit = 1 << d;
  for (const p of V(g).PEERS[i]) if (g.notes[p] & bit) { if (affected) affected.push(p); g.notes[p] &= ~bit; }
}
function peersWithNote(i, d) { const g = S.current; return V(g).PEERS[i].filter(p => g.notes[p] & (1 << d)); }
const isLocked = i => { const g = S.current; return !!g.puzzle[i] || (g.values[i] && g.values[i] === g.solution[i]); };
// writing into an illusion square breaks the illusion for good
function dispel(i) {
  const g = S.current;
  if (illusion(g, i)) { delete g.illusions[i]; toast('🦊 An illusion fades…'); }
}

function input(d) {
  const g = S.current;
  if (!g || paused || modalOpen()) return;
  const i = selected;
  if (i < 0) { toast('Tap a square first'); return; }
  if (fogged(g, i)) { toast('🌫️ Fog hides this square. Solve nearby to clear it'); return; }
  if (isLocked(i)) { sfx.tap(); return; }
  clearSensei();
  if (notesMode) {
    if (g.values[i]) return;
    pushHistory([i]);
    g.notes[i] ^= 1 << d;
    dispel(i);
    sfx.note();
  } else {
    if (g.values[i] === d) return;
    pushHistory(S.settings.autoNotes ? [i, ...peersWithNote(i, d)] : [i]);
    g.values[i] = d; g.notes[i] = 0;
    dispel(i);
    popCell(i);
    if (d !== g.solution[i]) {
      g.mistakes++;
      sfx.error();
      cells[i].classList.remove('shake'); void cells[i].offsetWidth; cells[i].classList.add('shake');
      if (g.lives != null) {
        g.lives--;
        if (g.lives <= 0) { persist(); renderGame(); setTimeout(lose, 450); return; }
      }
    } else {
      if (S.settings.autoNotes) clearPeerNotes(i, d);
      if (!afterCorrect(i)) sfx.place();
      if (checkWin()) return;
    }
  }
  persist(); renderGame();
}
function popCell(i) { const c = cells[i]; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
function flashCells(list) {
  list.forEach((j, k) => {
    const c = cells[j];
    c.classList.remove('flash'); void c.offsetWidth;
    c.style.setProperty('--fd', (k * 0.04) + 's');
    c.classList.add('flash');
    setTimeout(() => c.classList.remove('flash'), 1000);
  });
}
// After a correct number: lift fog in that box and celebrate finished units. True if anything happened.
function afterCorrect(i) {
  const g = S.current, v = V(g);
  let any = false;
  if (g.fog && g.fog.length) {
    const lifted = g.fog.filter(f => Sudoku.BOX[f] === Sudoku.BOX[i]);
    if (lifted.length) {
      g.fog = g.fog.filter(f => Sudoku.BOX[f] !== Sudoku.BOX[i]);
      flashCells(lifted); any = true;
    }
  }
  v.CU[i].forEach(u => {
    const unit = v.UNITS[u];
    if (!unit.every(j => g.values[j] === g.solution[j])) return;
    any = true;
    flashCells(unit);
  });
  if (any) sfx.unit();
  return any;
}
function undo() {
  const g = S.current; if (!g || paused) return;
  const h = g.history.pop();
  if (!h) { toast('Nothing to undo'); return; }
  h.forEach(([i, v, n]) => { g.values[i] = v; g.notes[i] = n; });
  selected = h[0][0];
  clearSensei();
  sfx.tap(); persist(); renderGame();
}
function erase() {
  const g = S.current; if (!g || paused) return;
  const i = selected;
  if (i < 0 || isLocked(i) || (!g.values[i] && !g.notes[i])) return;
  pushHistory([i]);
  g.values[i] = 0; g.notes[i] = 0;
  clearSensei();
  sfx.tap(); persist(); renderGame();
}
function checkWin() {
  const g = S.current;
  if (!g.values.every((v, i) => v === g.solution[i])) return false;
  if (g.fog) g.fog = [];
  renderGame();
  setTimeout(win, 650);
  return true;
}

/* ---------- Win / lose ---------- */
function win() {
  const g = S.current; if (!g) return;
  S.current = null;
  const D = DIFFS[g.diff], st = S.stats, before = levelInfo(S.xp).level;
  const stars = g.mistakes === 0 && g.hintsUsed === 0 ? 3 : g.mistakes + g.hintsUsed <= 2 ? 2 : 1;
  const xp = Math.round(D.xp * (g.boss ? 2 : 1) * (1 + (stars - 1) * 0.25));
  let gold = 0, extra = '';

  if (g.mode === 'quest') {
    const k = qkey(g.realm, g.stage), prev = S.quest[k];
    const mult = g.boss ? 2 : 1;
    gold = D.gold * mult * Math.max(0, stars - (prev ? prev.stars : 0)) + (prev ? Math.round(D.gold * 0.2) : 0);
    S.quest[k] = { stars: Math.max(stars, prev ? prev.stars : 0), best: prev ? Math.min(prev.best, g.elapsed) : g.elapsed, clears: (prev ? prev.clears : 0) + 1 };
    if (g.boss && !prev) {
      extra += `<div class="banner gold">${REALMS[g.realm].bossIcon} ${REALMS[g.realm].boss} has fallen!${g.realm + 1 < REALMS.length ? `<br>${REALMS[g.realm + 1].icon} <b>${REALMS[g.realm + 1].name}</b> is now open.` : '<br>👑 You have conquered every realm!'}</div>`;
    }
  } else if (g.mode === 'quick') {
    gold = Math.round(D.gold * stars * 0.5);
  } else if (g.mode === 'daily' && !S.daily[g.dateKey]) {
    st.streak = st.lastDaily === prevDayKey(g.dateKey) ? st.streak + 1 : 1;
    st.lastDaily = g.dateKey;
    st.bestStreak = Math.max(st.bestStreak, st.streak);
    S.daily[g.dateKey] = { time: g.elapsed, stars };
    const bonus = 10 * Math.min(st.streak, 7);
    gold = Math.round(D.gold * stars * 1.5) + bonus;
    extra += `<div class="banner">🔥 Daily streak: <b>${st.streak}</b> day${st.streak > 1 ? 's' : ''} (+${bonus} bonus gold)</div>`;
  }

  st.solved++;
  st.timePlayed += g.elapsed;
  if (stars === 3) st.flawless++;
  if (g.elapsed < 480 && ['medium', 'hard', 'expert'].includes(g.diff)) st.swift = true;
  if (stars === 3 && g.diff === 'expert') st.allseeing = true;
  const bd = st.byDiff[g.diff] || (st.byDiff[g.diff] = { solved: 0, best: 0, total: 0 });
  const newBest = !bd.best || g.elapsed < bd.best;
  bd.solved++; bd.total += g.elapsed; if (newBest) bd.best = g.elapsed;

  S.xp += xp; S.gold += gold;
  const newAch = checkAchievements();
  const after = levelInfo(S.xp).level;
  if (after > before) {
    const newTitle = titleFor(after) !== titleFor(before) ? ` You are now a <b>${titleFor(after)}</b>.` : '';
    extra = `<div class="banner">⬆️ Level ${after}!${newTitle}</div>` + extra;
  }
  extra += newAch.map(a => `<div class="banner gold">${a.icon} Achievement: <b>${a.name}</b> (+${ACH_GOLD} gold)</div>`).join('');
  persist();

  sfx.win(); confetti();
  const R = g.mode === 'quest' ? REALMS[g.realm] : null;
  let btns;
  if (g.mode === 'quest') {
    const next = g.stage < STAGES - 1 ? { r: g.realm, s: g.stage + 1 } : g.realm + 1 < REALMS.length ? { r: g.realm + 1, s: 0 } : null;
    btns = (next ? `<button class="btn primary" data-act="next">${next.s === STAGES - 1 ? 'Face the boss ' + REALMS[next.r].bossIcon : next.s === 0 ? 'Enter ' + REALMS[next.r].name : 'Next stage'}</button>` : '') +
      `<button class="btn" data-act="map">Quest map</button>`;
    modalAfterWin(g, stars, xp, gold, extra, btns, {
      next: () => { closeModal(); startQuest(next.r, next.s); },
      map: () => { closeModal(); openMap(g.realm); },
    }, R, newBest);
  } else {
    btns = (g.mode === 'quick' ? `<button class="btn primary" data-act="again">New ${DIFFS[g.diff].name} puzzle</button>` : '') + `<button class="btn" data-act="home">Home</button>`;
    modalAfterWin(g, stars, xp, gold, extra, btns, {
      again: () => { closeModal(); startGame({ mode: 'quick', diff: g.diff, seed: (Math.random() * 2 ** 32) >>> 0 }); },
      home: () => { closeModal(); goHome(); },
    }, R, newBest);
  }
}
function modalAfterWin(g, stars, xp, gold, extra, btns, handlers, R, newBest) {
  modal(`<div class="m-icon">${g.boss ? '🏆' : g.mode === 'daily' ? '🏮' : '🖌️'}</div>
    <h2>${g.boss ? 'Victory!' : 'Grid mastered!'}</h2>
    <p class="muted" style="margin-top:0">${describeGame(g)}</p>
    <div class="stars-row">${[1, 2, 3].map(k => `<span class="star ${k <= stars ? 'on' : ''}" style="animation-delay:${0.15 + k * 0.25}s">★</span>`).join('')}</div>
    <div class="win-stats"><div><b>${fmtTime(g.elapsed)}</b><small>${newBest ? '🏁 New best' : 'Time'}</small></div><div><b>${g.mistakes}</b><small>Mistakes</small></div><div><b>${g.hintsUsed}</b><small>Hints</small></div></div>
    <div class="rewards"><span class="xp">+${xp} XP</span><span class="g">${ICON.coin}+${gold}</span></div>
    ${extra}
    <div class="m-btns">${btns}</div>`, handlers, false);
}
function lose(reason) {
  const g = S.current; if (!g) return;
  S.current = null; persist();
  clearSensei();
  sfx.lose();
  const R = g.mode === 'quest' ? REALMS[g.realm] : null;
  const retry = { mode: g.mode, realm: g.realm, stage: g.stage, diff: g.diff, boss: g.boss, seed: g.seed, dateKey: g.dateKey };
  modal(`<div class="m-icon">${reason === 'storm' ? '⛈️' : g.boss ? R.bossIcon : '💔'}</div>
    <h2>${reason === 'storm' ? 'The storm broke' : g.boss ? R.boss + ' prevails' : 'Out of hearts'}</h2>
    <p class="muted">${reason === 'storm' ? 'The Storm Dragon swept you from the peak. ' : ''}Fall seven times, stand up eight. Every attempt sharpens the mind.</p>
    <div class="m-btns"><button class="btn primary" data-act="retry">Try again</button><button class="btn" data-act="leave">${g.mode === 'quest' ? 'Quest map' : 'Home'}</button></div>`,
    {
      retry: () => { closeModal(); createGame(retry); },
      leave: () => { closeModal(); if (g.mode === 'quest') openMap(g.realm); else goHome(); },
    }, false);
}
function checkAchievements() {
  const st = S.stats, ok = {
    first: st.solved >= 1, flawless: st.flawless >= 1, swift: st.swift,
    daily3: st.bestStreak >= 3, daily7: st.bestStreak >= 7, solve25: st.solved >= 25, solve100: st.solved >= 100,
    collector: S.owned.filter(id => THEMES.some(t => t.id === id)).length >= 5, allseeing: st.allseeing, stars100: totalStars() >= 100,
  };
  REALMS.forEach((_, i) => { ok['boss' + i] = !!S.quest[qkey(i, STAGES - 1)]; });
  const got = ACHIEVEMENTS.filter(a => ok[a.id] && !S.ach[a.id]);
  got.forEach(a => { S.ach[a.id] = Date.now(); S.gold += ACH_GOLD; });
  return got;
}

/* ---------- Confetti ---------- */
function confetti() {
  const cv = $('#confetti'), ctx = cv.getContext('2d'), dpr = window.devicePixelRatio || 1;
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.scale(dpr, dpr);
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

/* ---------- Theme shop ---------- */
function renderShop() {
  $('#screen-shop').innerHTML = `${topbar('Themes', 'Earn gold on the quest to unlock more', goldPill())}
    <div class="theme-grid">${THEMES.map(t => {
      const own = S.owned.includes(t.id), eq = S.theme === t.id;
      return `<button class="tcard ${eq ? 'equipped' : ''}" data-theme-id="${t.id}">
        <div class="tpreview" data-theme="${t.id}"><div class="mini"><span>5</span><span class="p"></span><span class="u">3</span><span class="p">8</span><span class="s">7</span><span class="p"></span><span class="u">1</span><span class="p">9</span><span>2</span></div></div>
        <div><div class="tname">${t.name}</div><div class="tdesc">${t.desc}</div></div>
        <div class="tprice ${eq ? 'eq' : own ? 'own' : ''}">${eq ? '✓ Equipped' : own ? 'Owned · tap to equip' : ICON.coin + t.price}</div></button>`;
    }).join('')}</div>
    <h3 class="section-title">Numerals</h3>
    <div class="theme-grid">${NUMERALS.map(n => {
      const own = n.price === 0 || S.owned.includes('num-' + n.id), eq = (S.numerals || 'arabic') === n.id;
      const show = d => n.id === 'kanji' ? KANJI[d] : d;
      return `<button class="tcard ${eq ? 'equipped' : ''}" data-num-id="${n.id}">
        <div class="tpreview"><div class="mini ${n.id}"><span>${show(5)}</span><span class="p"></span><span class="u">${show(3)}</span><span class="p">${show(8)}</span><span class="s">${show(7)}</span><span class="p"></span><span class="u">${show(1)}</span><span class="p">${show(9)}</span><span>${show(2)}</span></div></div>
        <div><div class="tname">${n.name}</div><div class="tdesc">${n.desc}</div></div>
        <div class="tprice ${eq ? 'eq' : own ? 'own' : ''}">${eq ? '✓ Equipped' : own ? 'Owned · tap to equip' : ICON.coin + n.price}</div></button>`;
    }).join('')}</div>`;
}
// Buys or equips an item; returns false if the player can't afford it
function buy(ownKey, price, name) {
  if (price === 0 || S.owned.includes(ownKey)) { sfx.tap(); return true; }
  if (S.gold < price) { toast(`Need ${price - S.gold} more gold`); sfx.error(); return false; }
  S.gold -= price; S.owned.push(ownKey); sfx.coin();
  toast(`Unlocked ${name}!`);
  checkAchievements().forEach(a => setTimeout(() => toast(`${a.icon} ${a.name} (+${ACH_GOLD} gold)`), 1200));
  return true;
}
$('#screen-shop').addEventListener('click', e => {
  const tc = e.target.closest('[data-theme-id]'), nc = e.target.closest('[data-num-id]');
  if (tc) {
    const t = THEMES.find(x => x.id === tc.dataset.themeId);
    if (!buy(t.id, S.owned.includes(t.id) ? 0 : t.price, t.name)) return;
    S.theme = t.id;
  } else if (nc) {
    const n = NUMERALS.find(x => x.id === nc.dataset.numId);
    if (!buy('num-' + n.id, n.price, n.name + ' numerals')) return;
    S.numerals = n.id;
  } else return;
  persist(); applyTheme(); renderShop();
});

/* ---------- Journal ---------- */
function renderJournal() {
  const st = S.stats, achCount = Object.keys(S.ach).length;
  $('#screen-journal').innerHTML = `${topbar('Journal', `${achCount} / ${ACHIEVEMENTS.length} achievements`)}
    <div class="stat-grid">
      <div class="stat"><b>${st.solved}</b><small>Solved</small></div>
      <div class="stat"><b>${st.flawless}</b><small>Flawless</small></div>
      <div class="stat"><b>${totalStars()}</b><small>Quest ★</small></div>
      <div class="stat"><b>${currentStreak()}</b><small>Streak 🔥</small></div>
      <div class="stat"><b>${st.bestStreak}</b><small>Best streak</small></div>
      <div class="stat"><b>${fmtTime(st.timePlayed).split(':').slice(0, -1).join(':') || 0}</b><small>${st.timePlayed >= 3600 ? 'Hours played' : 'Minutes played'}</small></div>
    </div>
    <div class="card"><table class="dtable"><tr><th>Difficulty</th><th>Solved</th><th>Best</th><th>Average</th></tr>
      ${DIFF_KEYS.map(k => { const b = st.byDiff[k] || {}; return `<tr><td><span class="dot" style="background:${DIFFS[k].color}"></span>${DIFFS[k].name}</td><td>${b.solved || 0}</td><td>${b.best ? fmtTime(b.best) : '–'}</td><td>${b.solved ? fmtTime(b.total / b.solved) : '–'}</td></tr>`; }).join('')}
    </table></div>
    <h3 class="section-title">Achievements</h3>
    <div class="ach-grid">${ACHIEVEMENTS.map(a => `<div class="ach ${S.ach[a.id] ? '' : 'locked'}"><span class="ai">${a.icon}</span><div><b>${a.name}</b><small>${a.desc}</small></div></div>`).join('')}</div>`;
}

/* ---------- Settings ---------- */
const SETTING_ROWS = [['sound', 'Sound effects'], ['peers', 'Highlight row, column & box'], ['same', 'Highlight matching numbers'], ['autoNotes', 'Auto-clear notes'], ['timer', 'Show timer']];
function settingsModal() {
  modal(`<h2>Settings</h2>
    <div class="set-list">${SETTING_ROWS.map(([k, l]) => `<div class="set-row" data-act="toggle" data-k="${k}"><span>${l}</span><span class="switch ${S.settings[k] ? 'on' : ''}"></span></div>`).join('')}</div>
    <p class="muted" style="font-size:12px;margin-top:14px">Backups and resets cover all three games, so they live in the main menu's settings.</p>
    <div class="m-btns">
      <button class="btn" data-go="hub-settings">Backup &amp; reset</button>
      <button class="btn primary" data-act="close">Done</button>
    </div>`, {
    toggle: el => {
      const k = el.dataset.k; S.settings[k] = !S.settings[k]; persist();
      el.querySelector('.switch').classList.toggle('on', S.settings[k]);
      if (k === 'sound' && S.settings.sound) sfx.coin();
    },
  });
}

/* ---------- Navigation ---------- */
function goHome() { renderHome(); show('home'); }
document.addEventListener('click', e => {
  const t = e.target.closest('[data-go]'); if (!t) return;
  if (modalOpen()) closeModal();
  sfx.tap();
  switch (t.dataset.go) {
    case 'home': if (openedShop && activeScreen() === 'screen-shop') location.href = './'; else goHome(); break;
    case 'hub': location.href = './'; break;
    case 'hub-settings': location.href = './#settings'; break;
    case 'map': openMap(); break;
    case 'resume': openGame(); break;
    case 'daily': startDaily(); break;
    case 'quick': quickModal(); break;
    case 'shop': renderShop(); show('shop'); break;
    case 'journal': renderJournal(); show('journal'); break;
    case 'settings': settingsModal(); break;
  }
});

/* ---------- Timer & lifecycle ---------- */
setInterval(() => {
  const g = S.current;
  if (!g || paused || modalOpen() || activeScreen() !== 'screen-game' || document.visibilityState !== 'visible') return;
  g.elapsed++;
  renderStats();
  if (g.timeLimit && g.elapsed >= g.timeLimit && !g.values.every((v, i) => v === g.solution[i])) { lose('storm'); return; }
  if (g.elapsed % 5 === 0) persist();
}, 1000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    if (S.current && activeScreen() === 'screen-game') setPaused(true);
    persist();
  }
});
window.addEventListener('pagehide', persist);

document.addEventListener('keydown', e => {
  if (activeScreen() !== 'screen-game' || modalOpen() || !S.current) return;
  const k = e.key;
  if (/^[1-9]$/.test(k)) input(+k);
  else if (k === 'Backspace' || k === 'Delete' || k === '0') erase();
  else if (k === 'n' || k === 'N') { notesMode = !notesMode; renderTools(); }
  else if (k === 'z' || k === 'u') undo();
  else if (k === 'h') hint();
  else if (k === 'f') fillNotes();
  else if (k === ' ' || k === 'Escape') setPaused(!paused);
  else if (k.startsWith('Arrow')) {
    if (selected < 0) selected = 40;
    else {
      let r = ROW[selected], c = COL[selected];
      if (k === 'ArrowUp') r = (r + 8) % 9; if (k === 'ArrowDown') r = (r + 1) % 9;
      if (k === 'ArrowLeft') c = (c + 8) % 9; if (k === 'ArrowRight') c = (c + 1) % 9;
      selected = r * 9 + c;
    }
    renderBoard();
  } else return;
  e.preventDefault();
});

/* ---------- Boot ---------- */
if (S.current && !(S.current.puzzle && S.current.puzzle.length === 81)) S.current = null;
applyTheme();
buildGameScreen();
// The hub links straight to the theme shop; its back button then returns to the hub
const openedShop = location.hash === '#shop';
if (openedShop) { history.replaceState(null, '', location.pathname); renderShop(); show('shop'); } else goHome();
// A page restored from the back/forward cache holds a stale save; reload so gold earned in other games isn't overwritten
window.addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
window.__sq = { get state() { return S; }, input, select: i => { selected = i; } }; // handy for debugging
})();
