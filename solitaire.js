'use strict';
(() => {
const { $, SOL_KEY, readJSON, writeJSON, profile, award, applyTheme, sfx, ICON, fmtTime, modal, closeModal, modalOpen, confirmModal, toast, topbar, goHub, winModal, confetti, shuffle } = Common;

/* ---------- Cards ---------- */
// A card is 0..51: suit = c / 13 (spades, hearts, diamonds, clubs), rank = c % 13 + 1.
// U+FE0E keeps iOS from drawing the suits as emoji.
const SUITS = ['♠︎', '♥︎', '♦︎', '♣︎'];
const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const COURT = { 11: '侍', 12: '姫', 13: '王' };
const suit = c => Math.floor(c / 13), rank = c => c % 13 + 1, red = c => suit(c) === 1 || suit(c) === 2;
const REWARD = { 1: { gold: 20, xp: 40 }, 3: { gold: 35, xp: 70 } };
const FAST = 300, FAST_GOLD = 10;

/* ---------- Save ---------- */
function load() {
  const d = { draw: 1, stats: { played: 0, won: 0, streak: 0, bestStreak: 0, time: 0, best: {} }, current: null };
  const s = readJSON(SOL_KEY);
  return s ? { ...d, ...s, stats: { ...d.stats, ...s.stats } } : d;
}
let S = load();
const persist = () => writeJSON(SOL_KEY, S);

function newDeal(draw) {
  const deck = shuffle(Array.from({ length: 52 }, (_, i) => i));
  const tab = [], hid = [];
  for (let c = 0; c < 7; c++) { tab.push(deck.splice(0, c + 1)); hid.push(c); }
  return { draw, stock: deck, waste: [], found: [[], [], [], []], tab, hid, moves: 0, elapsed: 0, counted: false };
}
let G = null, history = [], busy = false;

/* ---------- Screen ---------- */
$('#app').innerHTML = `<section id="screen-game" class="screen active sol-screen">
  ${topbar('Solitaire', '', `<div class="pill" style="color:var(--gold)" id="sol-gold"></div>`)}
  <div class="play-stats"><span id="sol-time">0:00</span><span id="sol-moves">0 moves</span><span id="sol-draw"></span></div>
  <div class="sol-board" id="board"></div>
  <div class="tools four">
    <button class="tool" data-tool="undo">${ICON.undo}<span>Undo</span></button>
    <button class="tool" data-tool="hint">${ICON.bulb}<span>Hint</span></button>
    <button class="tool" data-tool="auto">${ICON.bolt}<span>Finish</span></button>
    <button class="tool" data-tool="new">${ICON.plus}<span>New deal</span></button>
  </div></section>`;
const board = $('#board');
board.innerHTML = '<div class="slot stock-slot" data-slot="stock"><span>↻</span></div>' +
  SUITS.map((s, i) => `<div class="slot found-slot ${i === 1 || i === 2 ? 'red' : ''}" data-slot="found" data-col="${i}"><span>${s}</span></div>`).join('') +
  Array.from({ length: 7 }, (_, i) => `<div class="slot tab-slot" data-slot="tab" data-col="${i}"><span>王</span></div>`).join('') +
  Array.from({ length: 52 }, (_, c) => `<div class="pc" data-id="${c}"><div class="pc-in">
    <div class="pc-face ${red(c) ? 'red' : ''}"><span class="pr">${RANKS[rank(c)]}</span><span class="ps">${SUITS[suit(c)]}</span><span class="pm ${COURT[rank(c)] ? 'court' : ''}">${COURT[rank(c)] || SUITS[suit(c)]}</span></div>
    <div class="pc-back"></div></div></div>`).join('');
const cardEl = Array.from(board.querySelectorAll('.pc'));
const slotEl = { stock: $('[data-slot="stock"]', board), found: [...board.querySelectorAll('[data-slot="found"]')], tab: [...board.querySelectorAll('[data-slot="tab"]')] };

/* ---------- Layout ---------- */
let M = null; // metrics
const pos = new Array(52); // current resting {x, y} per card
const pileOf = new Array(52); // where each card sat at the last layout, to spot cards that moved
function metrics() {
  const W = board.clientWidth, H = board.clientHeight;
  const gap = Math.max(4, Math.round(W * 0.014));
  const cw = Math.floor((W - gap * 6) / 7), ch = Math.round(cw * 1.4);
  board.style.setProperty('--cw', cw + 'px'); board.style.setProperty('--ch', ch + 'px');
  return { W, H, gap, cw, ch, tabY: ch + Math.round(gap * 2.5), x: i => i * (cw + gap) };
}
function place(el, x, y, z) { el.style.transform = `translate3d(${x}px,${y}px,0)`; el.style.zIndex = z; }
function layout(opts = {}) {
  M = metrics();
  const { x, cw, ch, tabY } = M;
  place(slotEl.stock, x(0), 0, 0);
  slotEl.found.forEach((el, i) => place(el, x(3 + i), 0, 0));
  slotEl.tab.forEach((el, i) => place(el, x(i), tabY, 0));
  const spots = [];
  G.stock.forEach((c, i) => spots.push([c, x(0), 0, 10 + i, true, 's']));
  const fanFrom = G.draw === 3 ? Math.max(0, G.waste.length - 3) : G.waste.length;
  G.waste.forEach((c, i) => spots.push([c, x(1) + (i >= fanFrom ? (i - fanFrom) * Math.round(cw * 0.36) : 0), 0, 100 + i, false, 'w']));
  G.found.forEach((p, f) => p.forEach((c, i) => spots.push([c, x(3 + f), 0, 200 + i, false, 'f' + f])));
  const avail = M.H - tabY - 2;
  G.tab.forEach((col, ci) => {
    const h = G.hid[ci], up = col.length - h;
    let dOff = ch * 0.11, uOff = ch * 0.3;
    // squeeze long columns so the whole column stays on screen
    if (up > 1 && h * dOff + (up - 1) * uOff + ch > avail) uOff = Math.max(ch * 0.17, (avail - ch - h * dOff) / (up - 1));
    if (h && h * dOff + Math.max(0, up - 1) * uOff + ch > avail) dOff = Math.max(ch * 0.05, (avail - ch - Math.max(0, up - 1) * uOff) / h);
    let y = tabY;
    col.forEach((c, i) => { spots.push([c, x(ci), Math.round(y), 300 + i, i < h, 't' + ci]); y += i < h ? dOff : uOff; });
  });
  spots.forEach(([c, px, py, z, down, pile], k) => {
    const el = cardEl[c];
    if (el.classList.contains('down') && !down && !opts.deal) { el.classList.remove('flip'); void el.offsetWidth; el.classList.add('flip'); setTimeout(() => el.classList.remove('flip'), 300); }
    el.classList.toggle('down', down);
    el.classList.remove('dragging');
    const moved = pileOf[c] !== undefined && pileOf[c] !== pile;
    pos[c] = { x: px, y: py, z };
    if (opts.deal) el.style.transitionDelay = (k * 0.018).toFixed(3) + 's';
    place(el, px, py, moved ? 1000 + z : z);
    if (moved) setTimeout(() => { if (pileOf[c] === pile) el.style.zIndex = pos[c].z; }, 260);
    pileOf[c] = pile;
  });
  if (opts.deal) setTimeout(() => cardEl.forEach(el => { el.style.transitionDelay = ''; }), 1200);
  renderStats();
}
function renderStats() {
  $('#sol-time').textContent = '⏱ ' + fmtTime(G.elapsed);
  $('#sol-moves').textContent = G.moves + (G.moves === 1 ? ' move' : ' moves');
  $('#sol-draw').textContent = 'Draw ' + G.draw;
  $('#sol-gold').innerHTML = ICON.coin + (profile().gold || 0);
  $('[data-tool="auto"]').classList.toggle('ready', canAutoFinish());
  $('[data-tool="undo"]').disabled = !history.length;
}

/* ---------- Rules ---------- */
function locate(c) {
  if (G.stock.includes(c)) return { pile: 'stock' };
  let i = G.waste.indexOf(c); if (i >= 0) return { pile: 'waste', idx: i };
  for (let f = 0; f < 4; f++) { i = G.found[f].indexOf(c); if (i >= 0) return { pile: 'found', col: f, idx: i }; }
  for (let t = 0; t < 7; t++) { i = G.tab[t].indexOf(c); if (i >= 0) return { pile: 'tab', col: t, idx: i }; }
  return null;
}
const pileArr = loc => loc.pile === 'waste' ? G.waste : loc.pile === 'found' ? G.found[loc.col] : G.tab[loc.col];
// The cards a touch at `loc` would pick up, or null if they can't be moved
function pickable(loc) {
  if (!loc || loc.pile === 'stock') return null;
  const arr = pileArr(loc);
  if (loc.pile === 'tab') return loc.idx >= G.hid[loc.col] ? arr.slice(loc.idx) : null;
  return loc.idx === arr.length - 1 ? [arr[loc.idx]] : null;
}
const canFound = c => G.found[suit(c)].length === rank(c) - 1;
function canTab(c, t) {
  const col = G.tab[t];
  if (!col.length) return rank(c) === 13;
  const top = col[col.length - 1];
  return red(top) !== red(c) && rank(top) === rank(c) + 1;
}
function canMove(loc, to, ids) {
  if (to.pile === 'found') return ids.length === 1 && loc.pile !== 'found' && canFound(ids[0]);
  return !(loc.pile === 'tab' && loc.col === to.col) && canTab(ids[0], to.col);
}
const snapshot = () => { history.push(JSON.stringify(G)); if (history.length > 200) history.shift(); };
function touched() {
  if (!G.counted) { G.counted = true; S.stats.played++; }
  G.moves++;
}
function doMove(loc, to, ids) {
  snapshot();
  pileArr(loc).splice(loc.idx);
  if (to.pile === 'found') G.found[suit(ids[0])].push(ids[0]); else G.tab[to.col].push(...ids);
  let flipped = false;
  if (loc.pile === 'tab') {
    const col = G.tab[loc.col];
    if (col.length && G.hid[loc.col] >= col.length) { G.hid[loc.col] = col.length - 1; flipped = true; }
  }
  touched();
  to.pile === 'found' ? sfx.place() : sfx.card();
  if (flipped) setTimeout(sfx.flip, 120);
  afterMove();
}
function drawStock() {
  if (!G.stock.length && !G.waste.length) return;
  snapshot();
  if (!G.stock.length) { G.stock = G.waste.reverse(); G.waste = []; sfx.flip(); }
  else { for (let k = 0; k < G.draw && G.stock.length; k++) G.waste.push(G.stock.pop()); sfx.card(); }
  touched();
  afterMove();
}
function afterMove() {
  persist(); layout();
  if (G.found.every(f => f.length === 13)) return setTimeout(win, 350);
  if (canAutoFinish()) setTimeout(autoFinish, 450);
}
const canAutoFinish = () => !!G && !busy && !G.stock.length && !G.waste.length && G.hid.every(h => h === 0) && G.tab.some(c => c.length);

// Tap: send the cards to the most useful legal spot
function smartMove(loc) {
  const ids = pickable(loc);
  if (!ids) return false;
  if (ids.length === 1 && loc.pile !== 'found' && canFound(ids[0])) { doMove(loc, { pile: 'found' }, ids); return true; }
  const targets = [0, 1, 2, 3, 4, 5, 6].filter(t => canMove(loc, { pile: 'tab', col: t }, ids));
  // a king already at the bottom of a column gains nothing by moving to another empty one
  const useful = targets.filter(t => G.tab[t].length || !(loc.pile === 'tab' && loc.idx === 0));
  const best = useful.find(t => G.tab[t].length) ?? useful[0];
  if (best === undefined) return false;
  doMove(loc, { pile: 'tab', col: best }, ids);
  return true;
}

function autoFinish() {
  if (!canAutoFinish()) return;
  busy = true;
  (function step() {
    let pick = -1;
    G.tab.forEach((col, t) => {
      const c = col[col.length - 1];
      if (col.length && canFound(c) && (pick < 0 || rank(c) < rank(G.tab[pick][G.tab[pick].length - 1]))) pick = t;
    });
    if (pick < 0) { busy = false; persist(); layout(); if (G.found.every(f => f.length === 13)) setTimeout(win, 350); return; }
    const c = G.tab[pick].pop();
    G.found[suit(c)].push(c); G.moves++;
    sfx.place(); layout();
    setTimeout(step, 90);
  })();
}

function hint() {
  const tops = [...G.tab.map((col, t) => col.length ? { pile: 'tab', col: t, idx: col.length - 1 } : null), G.waste.length ? { pile: 'waste', idx: G.waste.length - 1 } : null].filter(Boolean);
  const show = (ids, target) => {
    ids.forEach(c => cardEl[c].classList.add('hint'));
    if (target) target.classList.add('hint');
    setTimeout(() => { ids.forEach(c => cardEl[c].classList.remove('hint')); if (target) target.classList.remove('hint'); }, 1400);
  };
  const topEl = t => G.tab[t].length ? cardEl[G.tab[t][G.tab[t].length - 1]] : slotEl.tab[t];
  for (const loc of tops) { const c = pileArr(loc)[loc.idx]; if (canFound(c)) return show([c], G.found[suit(c)].length ? cardEl[G.found[suit(c)].slice(-1)[0]] : slotEl.found[suit(c)]); }
  // runs that uncover a face-down card
  for (let t = 0; t < 7; t++) {
    const h = G.hid[t]; if (!h || h >= G.tab[t].length) continue;
    const loc = { pile: 'tab', col: t, idx: h }, ids = pickable(loc);
    const to = [0, 1, 2, 3, 4, 5, 6].find(d => canMove(loc, { pile: 'tab', col: d }, ids));
    if (to !== undefined) return show(ids, topEl(to));
  }
  if (G.waste.length) {
    const loc = { pile: 'waste', idx: G.waste.length - 1 }, ids = pickable(loc);
    const to = [0, 1, 2, 3, 4, 5, 6].find(d => canMove(loc, { pile: 'tab', col: d }, ids));
    if (to !== undefined) return show(ids, topEl(to));
  }
  if (G.stock.length || G.waste.length) return show([], G.stock.length ? cardEl[G.stock[G.stock.length - 1]] : slotEl.stock);
  toast('No moves left. Try a new deal');
}

function undo() {
  if (busy || !history.length) return;
  G = JSON.parse(history.pop());
  G.moves++; sfx.tap(); persist(); layout();
}

/* ---------- Touch: tap to auto-move, or drag ---------- */
let drag = null;
board.addEventListener('pointerdown', e => {
  if (busy || modalOpen() || drag) return;
  const el = e.target.closest('.pc, .slot'); if (!el) return;
  if (el.dataset.slot === 'stock' || (el.classList.contains('pc') && locate(+el.dataset.id).pile === 'stock')) { drag = { stock: true, x0: e.clientX, y0: e.clientY }; return; }
  if (!el.classList.contains('pc')) return;
  const loc = locate(+el.dataset.id), ids = pickable(loc);
  if (!ids) return;
  drag = { loc, ids, x0: e.clientX, y0: e.clientY, moved: false };
  try { board.setPointerCapture(e.pointerId); } catch (err) {}
});
board.addEventListener('pointermove', e => {
  if (!drag || drag.stock) return;
  const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
  if (!drag.moved && Math.hypot(dx, dy) < 8) return;
  drag.moved = true;
  drag.ids.forEach((c, k) => {
    const el = cardEl[c];
    el.classList.add('dragging');
    el.style.transform = `translate3d(${pos[c].x + dx}px,${pos[c].y + dy}px,0)`;
    el.style.zIndex = 3000 + k;
  });
});
function dropTarget(c, dx, dy) {
  const cx = pos[c].x + dx + M.cw / 2, cy = pos[c].y + dy + M.ch * 0.35;
  const col = Math.max(0, Math.min(6, Math.round((cx - M.cw / 2) / (M.cw + M.gap))));
  if (cy < M.tabY - M.gap) return col >= 3 ? { pile: 'found' } : null;
  return { pile: 'tab', col };
}
board.addEventListener('pointerup', e => {
  const d = drag; drag = null;
  if (!d) return;
  if (d.stock) { if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 12) drawStock(); return; }
  if (!d.moved) { if (!smartMove(d.loc)) { sfx.error(); shake(d.ids); } return; }
  const to = dropTarget(d.ids[0], e.clientX - d.x0, e.clientY - d.y0);
  if (to && canMove(d.loc, to, d.ids)) doMove(d.loc, to, d.ids);
  else layout();
});
board.addEventListener('pointercancel', () => { if (drag) { drag = null; layout(); } });
function shake(ids) {
  ids.forEach(c => { const el = cardEl[c]; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 400); });
}

/* ---------- Winning & new deals ---------- */
function win() {
  if (!G) return;
  const g = G, st = S.stats, r = REWARD[g.draw];
  const fast = g.elapsed < FAST, gold = r.gold + (fast ? FAST_GOLD : 0);
  const key = 'd' + g.draw, newBest = !st.best[key] || g.elapsed < st.best[key];
  st.won++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); st.time += g.elapsed;
  if (newBest) st.best[key] = g.elapsed;
  S.current = null; history = [];
  persist();
  const { levelUp } = award(gold, r.xp);
  sfx.win(); confetti(); renderStats();
  winModal({
    icon: '🎴', title: 'Solved!', sub: `Klondike · Draw ${g.draw}`,
    stats: [[fmtTime(g.elapsed), newBest ? '🏁 New best' : 'Time'], [g.moves, 'Moves'], [st.streak, 'Win streak']],
    gold, xp: r.xp, levelUp, extra: fast ? `<div class="banner gold">⚡ Under ${FAST / 60} minutes: +${FAST_GOLD} bonus gold</div>` : '',
    btns: `<button class="btn primary" data-act="again">New deal</button><button class="btn" data-act="hub">All games</button>`,
    handlers: { again: () => { closeModal(); start(g.draw); }, hub: goHub },
  });
}
function start(draw) {
  // walking away from a deal you'd started counts as a loss for the streak
  if (G && G.counted && S.current) { S.stats.streak = 0; S.stats.time += G.elapsed; }
  S.draw = draw;
  G = S.current = newDeal(draw); history = [];
  persist();
  pileOf.fill(undefined);
  // gather everything on the stock, then deal out with a stagger
  M = metrics();
  cardEl.forEach(el => { el.classList.add('down', 'instant'); place(el, M.x(0), 0, 10); });
  void board.offsetWidth;
  cardEl.forEach(el => el.classList.remove('instant'));
  layout({ deal: true });
  sfx.card();
}
function newDealModal() {
  const row = (d, t) => `<button class="diff-btn" data-act="deal" data-draw="${d}"><div><b>Draw ${d}</b><small>${t}</small></div><span>${ICON.coin}${REWARD[d].gold}${S.stats.best['d' + d] ? ' · best ' + fmtTime(S.stats.best['d' + d]) : ''}</span></button>`;
  modal(`<h2>New deal</h2><p class="muted">${G && G.counted ? 'This deal will be abandoned and your win streak reset.' : 'Klondike solitaire. Build each suit from ace to king.'}</p>
    <div class="diff-list">${row(1, 'Turn one card at a time')}${row(3, 'Turn three, the classic challenge')}</div>
    <div class="m-btns"><button class="btn" data-act="rules">How to play</button><button class="btn" data-act="close">Cancel</button></div>`, {
    deal: el => { closeModal(); start(+el.dataset.draw); },
    rules: rulesModal,
  });
}
function rulesModal() {
  modal(`<h2>How to play</h2><div class="rules">
    <p>Move every card onto the four <b>foundations</b> at the top right, building each suit up from ace to king.</p>
    <p>In the columns, stack cards <b>down in alternating colours</b> (a red 6 on a black 7). Only a king can fill an empty column.</p>
    <p><b>Tap</b> a card to send it to the best spot, or <b>drag</b> it where you want. Tap the deck to turn cards; when it runs out, tap again to turn the pile back over.</p>
    <p>Once every card is face up, the game finishes itself.</p></div>
    <div class="m-btns"><button class="btn primary" data-act="close">Got it</button></div>`);
}

/* ---------- Tools, timer, lifecycle ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-tool], [data-go]'); if (!t) return;
  if (t.dataset.go === 'hub') { persist(); return goHub(); }
  if (busy) return;
  switch (t.dataset.tool) {
    case 'undo': undo(); break;
    case 'hint': sfx.tap(); hint(); break;
    case 'auto': if (canAutoFinish()) autoFinish(); else { sfx.tap(); toast('Turn every card face up first'); } break;
    case 'new': sfx.tap(); newDealModal(); break;
  }
});
setInterval(() => {
  if (!G || !G.moves || busy || modalOpen() || !S.current || document.visibilityState !== 'visible') return;
  G.elapsed++; renderStats();
  if (G.elapsed % 5 === 0) persist();
}, 1000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persist(); });
window.addEventListener('pagehide', persist);
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { cardEl.forEach(el => el.classList.add('instant')); layout(); requestAnimationFrame(() => cardEl.forEach(el => el.classList.remove('instant'))); }, 80); });

/* ---------- Boot ---------- */
applyTheme();
const valid = g => g && Array.isArray(g.tab) && g.tab.length === 7 && [g.stock, g.waste, ...g.found, ...g.tab].reduce((n, p) => n + p.length, 0) === 52;
if (valid(S.current)) {
  G = S.current;
  cardEl.forEach(el => el.classList.add('instant'));
  layout();
  requestAnimationFrame(() => cardEl.forEach(el => el.classList.remove('instant')));
} else {
  S.current = null;
  start(S.draw || 1);
  if (!S.stats.played) setTimeout(rulesModal, 700);
}
})();
