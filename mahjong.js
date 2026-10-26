'use strict';
(() => {
const { $, MJ_KEY, readJSON, writeJSON, profile, award, applyTheme, sfx, ICON, fmtTime, show, activeScreen, modal, closeModal, modalOpen, confirmModal, toast, topbar, goHub, winModal, confetti } = Common;
const { LAYOUTS, build, isFree, matches, deal, reshuffle, freePairs } = Mahjong;
const BOARDS = Object.fromEntries(LAYOUTS.map(L => [L.id, build(L)]));
const layoutById = id => LAYOUTS.find(L => L.id === id);
const newSeed = () => (Math.random() * 2 ** 32) >>> 0;

/* ---------- Tile faces ---------- */
const GREEN = '#15803d', RED = '#c0392b', BLUE = '#1d4ed8';
const DOT_C = [BLUE, GREEN, RED];
// [cx, cy, r, colour] in a 30 x 40 box
const DOTS = [
  [[15, 20, 10, 2]],
  [[15, 11, 6.5, 1], [15, 29, 6.5, 0]],
  [[7.5, 8.5, 5.5, 0], [15, 20, 5.5, 2], [22.5, 31.5, 5.5, 1]],
  [[9, 11, 5.5, 0], [21, 11, 5.5, 1], [9, 29, 5.5, 1], [21, 29, 5.5, 0]],
  [[8, 9, 5, 0], [22, 9, 5, 1], [15, 20, 5, 2], [8, 31, 5, 1], [22, 31, 5, 0]],
  [[9, 8, 4.8, 1], [21, 8, 4.8, 1], [9, 20, 4.8, 2], [21, 20, 4.8, 2], [9, 32, 4.8, 2], [21, 32, 4.8, 2]],
  [[6, 6, 4, 1], [15, 10, 4, 1], [24, 14, 4, 1], [9, 25, 4, 2], [21, 25, 4, 2], [9, 35, 4, 2], [21, 35, 4, 2]],
  [6, 15, 24, 33].flatMap(y => [[9, y, 4.2, 0], [21, y, 4.2, 0]]),
  [8, 20, 32].flatMap((y, r) => [6, 15, 24].map(x => [x, y, 4.2, r === 1 ? 2 : r === 0 ? 0 : 1])),
];
// [cx, cy, height, red?]
const STICKS = [
  null,
  [[15, 11, 13], [15, 29, 13]],
  [[15, 11, 13], [9, 29, 13], [21, 29, 13]],
  [[9, 11, 13], [21, 11, 13], [9, 29, 13], [21, 29, 13]],
  [[8, 11, 13], [22, 11, 13], [15, 20, 13, 1], [8, 29, 13], [22, 29, 13]],
  [7, 15, 23].flatMap(x => [[x, 11, 13], [x, 29, 13]]),
  [[15, 7, 10, 1], ...[7, 15, 23].flatMap(x => [[x, 20, 10], [x, 33, 10]])],
  [5.5, 12, 18, 24.5].flatMap(x => [[x, 11, 13], [x, 29, 13]]),
  [7, 15, 23].flatMap(x => [7, 20, 33].map(y => [x, y, 10, x === 15 ? 1 : 0])),
];
const svg = body => `<svg viewBox="0 0 30 40" class="mt-svg">${body}</svg>`;
const pip = ([cx, cy, r, c]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${DOT_C[c]}"/><circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="#fffaf0"/><circle cx="${cx}" cy="${cy}" r="${r * 0.25}" fill="${DOT_C[c]}"/>`;
const stick = ([cx, cy, h, r]) => `<rect x="${cx - 2.2}" y="${cy - h / 2}" width="4.4" height="${h}" rx="2.2" fill="${r ? RED : GREEN}"/><rect x="${cx - 2.6}" y="${cy - 0.7}" width="5.2" height="1.4" rx=".7" fill="${r ? '#7f1d1d' : '#14532d'}"/>`;
const NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const HONOURS = [['東', '#1e293b'], ['南', '#1e293b'], ['西', '#1e293b'], ['北', '#1e293b'], ['中', RED], ['發', GREEN]];
const BONUS = [['梅', '#db2777'], ['蘭', '#7c3aed'], ['菊', '#d97706'], ['竹', GREEN], ['春', GREEN], ['夏', RED], ['秋', '#d97706'], ['冬', BLUE]];
const FACE_NAME = f => f < 9 ? `${f + 1} of dots` : f < 18 ? `${f - 8} of bamboo` : f < 27 ? `${f - 17} of characters` : f < 31 ? ['East', 'South', 'West', 'North'][f - 27] + ' wind' : f < 34 ? ['Red', 'Green', 'White'][f - 31] + ' dragon' : f < 38 ? 'Flower' : 'Season';
function faceHTML(f) {
  if (f < 9) return svg(DOTS[f].map(pip).join('') + (f === 0 ? `<circle cx="15" cy="20" r="12.5" fill="none" stroke="${GREEN}" stroke-width="1.2" stroke-dasharray="2 1.6"/>` : ''));
  if (f < 18) {
    if (f === 9) return svg(`<rect x="11.5" y="9" width="7" height="27" rx="3.5" fill="${GREEN}"/><rect x="10.8" y="17" width="8.4" height="1.6" rx=".8" fill="#14532d"/><rect x="10.8" y="27" width="8.4" height="1.6" rx=".8" fill="#14532d"/><circle cx="15" cy="7" r="4.5" fill="${RED}"/><circle cx="15" cy="7" r="1.6" fill="#fffaf0"/>`);
    return svg(STICKS[f - 9].map(stick).join(''));
  }
  if (f < 27) return `<span class="mt-num">${NUM[f - 18]}</span><span class="mt-wan">萬</span>`;
  if (f === 33) return '<span class="mt-white"></span>';
  if (f < 33) { const [g, c] = HONOURS[f - 27]; return `<span class="mt-big" style="color:${c}">${g}</span>`; }
  const [g, c] = BONUS[f - 34];
  return `<span class="mt-big mt-bonus" style="color:${c}">${g}</span><span class="mt-tag" style="background:${c}">${f < 38 ? '花' : '季'}</span>`;
}

/* ---------- Save ---------- */
function load() {
  const d = { dim: true, stats: { played: 0, won: 0, streak: 0, bestStreak: 0, time: 0, best: {}, wins: {} }, current: null };
  const s = readJSON(MJ_KEY);
  return s ? { ...d, ...s, stats: { ...d.stats, ...s.stats, best: { ...(s.stats && s.stats.best) }, wins: { ...(s.stats && s.stats.wins) } } } : d;
}
let S = load();
const persist = () => writeJSON(MJ_KEY, S);
const validGame = g => g && BOARDS[g.layout] && Array.isArray(g.faces) && g.faces.length === BOARDS[g.layout].tiles.length && Array.isArray(g.history);
if (!validGame(S.current)) S.current = null;

/* ---------- Screens ---------- */
$('#app').innerHTML = `<section id="screen-menu" class="screen active"></section>
  <section id="screen-game" class="screen mj-screen">
    <div id="mj-top"></div>
    <div class="play-stats"><span id="mj-time">0:00</span><span id="mj-left"></span><span id="mj-pairs"></span></div>
    <div class="mj-board" id="board"></div>
    <div class="tools four">
      <button class="tool" data-tool="undo">${ICON.undo}<span>Undo</span></button>
      <button class="tool" data-tool="hint">${ICON.bulb}<span>Hint</span></button>
      <button class="tool" data-tool="shuffle">${ICON.shuffle}<span>Shuffle</span></button>
      <button class="tool" data-tool="new">${ICON.plus}<span>New board</span></button>
    </div>
  </section>`;
const board = $('#board');

function renderMenu() {
  const g = S.current, st = S.stats;
  $('#screen-menu').innerHTML = `${topbar('Mahjong', 'Match free pairs to clear the board', `<div class="pill" style="color:var(--gold)">${ICON.coin}${profile().gold || 0}</div>`)}
    <div class="mj-hero"><div class="mj-hero-tiles">${[31, 4, 27].map(f => `<div class="mt demo"><div class="mt-face">${faceHTML(f)}</div></div>`).join('')}</div></div>
    ${g ? `<button class="big primary" data-go="resume"><span class="bi">▶️</span><span><b>Continue</b><small>${layoutById(g.layout).name} · ${g.faces.filter(f => f >= 0).length} tiles left · ${fmtTime(g.elapsed)}</small></span><span class="chev">›</span></button>` : ''}
    ${LAYOUTS.map(L => `<button class="big" data-layout="${L.id}"><span class="bi">${L.icon}</span><span><b>${L.name}</b><small>${L.level} · ${BOARDS[L.id].tiles.length} tiles${st.best[L.id] ? ` · best ${fmtTime(st.best[L.id])}` : ''}${st.wins[L.id] ? ` · ${st.wins[L.id]} won` : ''}</small></span><span class="chev reward">${ICON.coin}${L.gold}</span></button>`).join('')}
    <div class="set-list card" style="margin-top:0;padding:4px 14px">
      <div class="set-row" data-go="dim" style="border:0"><span>Dim tiles that can't be picked</span><span class="switch ${S.dim ? 'on' : ''}"></span></div>
    </div>
    <div class="mini-row two"><button data-go="rules">📖<span>How to play</span></button><button data-go="stats">📜<span>Records</span></button></div>`;
}

/* ---------- Game ---------- */
let G = null, B = null, tileEl = [], sel = -1, busy = false;
function startBoard(id) {
  const B0 = BOARDS[id], seed = newSeed();
  const faces = deal(B0, seed);
  if (S.current && S.current.history.length) { S.stats.streak = 0; S.stats.time += S.current.elapsed; }
  G = S.current = { layout: id, faces, history: [], elapsed: 0, hints: 0, shuffles: 0, counted: false };
  persist(); openGame(true);
}
function openGame(fresh) {
  G = S.current; B = BOARDS[G.layout]; sel = -1;
  const L = layoutById(G.layout);
  $('#mj-top').innerHTML = topbar(L.name, L.level + ' · ' + B.tiles.length + ' tiles', `<div class="pill" style="color:var(--gold)">${ICON.coin}${L.gold}</div>`, 'menu');
  board.innerHTML = B.tiles.map((t, i) => `<div class="mt" data-i="${i}"><div class="mt-face"></div></div>`).join('');
  tileEl = [...board.querySelectorAll('.mt')];
  show('game');
  drawFaces(); layout(); refresh();
  if (fresh) tileEl.forEach((el, i) => { el.style.animationDelay = (B.tiles[i].z * 0.12 + Math.random() * 0.25).toFixed(2) + 's'; el.classList.add('drop'); });
}
function drawFaces() {
  tileEl.forEach((el, i) => {
    const f = G.faces[i];
    el.classList.toggle('gone', f < 0);
    if (f >= 0 && el.dataset.f !== String(f)) { el.firstChild.innerHTML = faceHTML(f); el.dataset.f = f; el.setAttribute('aria-label', FACE_NAME(f)); }
  });
}
function layout() {
  if (!B) return;
  const W = board.clientWidth, H = board.clientHeight;
  const maxX = Math.max(...B.tiles.map(t => t.x)) + 2, maxY = Math.max(...B.tiles.map(t => t.y)) + 2, maxZ = Math.max(...B.tiles.map(t => t.z));
  const AR = 1.3, DEP = 0.11;
  const tw = Math.min(64, W / (maxX / 2 + (maxZ + 1) * DEP), H / (maxY / 2 * AR + (maxZ + 1) * DEP));
  const th = tw * AR, d = tw * DEP;
  const bw = maxX / 2 * tw + (maxZ + 1) * d, bh = maxY / 2 * th + (maxZ + 1) * d;
  const ox = (W - bw) / 2, oy = Math.max(0, (H - bh) / 2);
  board.style.setProperty('--tw', tw + 'px'); board.style.setProperty('--th', th + 'px'); board.style.setProperty('--d', d + 'px');
  B.tiles.forEach((t, i) => {
    const el = tileEl[i];
    el.style.left = (ox + t.x / 2 * tw + (maxZ - t.z) * d).toFixed(1) + 'px';
    el.style.top = (oy + t.y / 2 * th + (maxZ - t.z) * d).toFixed(1) + 'px';
    // later rows and columns overlap the side of the tile before them; higher layers sit on top
    el.style.zIndex = t.z * 1000 + t.y * 20 + t.x;
  });
}
const presentArr = () => G.faces.map(f => f >= 0);
function refresh() {
  const present = presentArr();
  tileEl.forEach((el, i) => {
    el.classList.toggle('blocked', present[i] && !isFree(B, i, present));
    el.classList.toggle('sel', i === sel);
  });
  board.classList.toggle('dim', S.dim);
  const left = present.filter(Boolean).length, pairs = freePairs(B, G.faces).length;
  $('#mj-time').textContent = '⏱ ' + fmtTime(G.elapsed);
  $('#mj-left').textContent = left + ' tiles';
  $('#mj-pairs').textContent = pairs + (pairs === 1 ? ' match' : ' matches') + ' open';
  $('[data-tool="undo"]').disabled = !G.history.length;
}
function tap(i) {
  if (busy || G.faces[i] < 0) return;
  if (!isFree(B, i, presentArr())) {
    sfx.error();
    const el = tileEl[i]; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    return;
  }
  if (sel === i) { sel = -1; sfx.tap(); return refresh(); }
  if (sel >= 0 && matches(G.faces[sel], G.faces[i])) return removePair(sel, i);
  sel = i; sfx.clack(); refresh();
}
function removePair(a, b) {
  if (!G.counted) { G.counted = true; S.stats.played++; }
  G.history.push([a, b, G.faces[a], G.faces[b]]);
  G.faces[a] = G.faces[b] = -1; sel = -1;
  sfx.match();
  [a, b].forEach(i => tileEl[i].classList.add('pop-out'));
  setTimeout(() => { [a, b].forEach(i => tileEl[i].classList.remove('pop-out')); drawFaces(); }, 260);
  persist(); refresh();
  if (G.faces.every(f => f < 0)) return setTimeout(win, 450);
  if (!freePairs(B, G.faces).length) setTimeout(stuck, 500);
}
function undo() {
  const h = G.history.pop(); if (!h) return;
  if (h.length === 4) { G.faces[h[0]] = h[2]; G.faces[h[1]] = h[3]; } else G.faces = h[0].slice();
  sel = -1; sfx.tap(); persist(); drawFaces(); refresh();
}
function doShuffle(free) {
  const out = reshuffle(B, G.faces, newSeed());
  if (!out) return false;
  G.history.push([G.faces.slice()]);
  G.faces = out; sel = -1;
  if (!free) G.shuffles++;
  sfx.flip(); persist(); drawFaces(); refresh();
  tileEl.forEach(el => { if (!el.classList.contains('gone')) { el.classList.remove('shuffled'); void el.offsetWidth; el.classList.add('shuffled'); } });
  return true;
}
function stuck() {
  if (!G || modalOpen()) return;
  const canShuffle = !!reshuffle(B, G.faces, newSeed());
  sfx.lose();
  modal(`<div class="m-icon">🀄</div><h2>No matches left</h2>
    <p class="muted">${canShuffle ? 'Every free tile is unique. A free reshuffle mixes the tiles still on the board so you can carry on.' : 'The tiles left are stacked so they can\'t all be cleared. Undo a few moves and try another line.'}</p>
    <div class="m-btns">${canShuffle ? '<button class="btn primary" data-act="shuffle">Reshuffle (free)</button>' : ''}<button class="btn ${canShuffle ? '' : 'primary'}" data-act="undo">Undo last match</button><button class="btn" data-act="new">New board</button></div>`, {
    shuffle: () => { closeModal(); doShuffle(true); },
    undo: () => { closeModal(); undo(); },
    new: () => { closeModal(); startBoard(G.layout); },
  }, false);
}
function hint() {
  const pairs = freePairs(B, G.faces);
  if (!pairs.length) return stuck();
  const [a, b] = pairs[Math.floor(Math.random() * pairs.length)];
  G.hints++; persist(); sfx.tap();
  [a, b].forEach(i => { tileEl[i].classList.add('hint'); setTimeout(() => tileEl[i].classList.remove('hint'), 1600); });
}

function win() {
  const g = G, L = layoutById(g.layout), st = S.stats;
  const helps = g.hints + g.shuffles, stars = helps === 0 ? 3 : helps <= 2 ? 2 : 1;
  const mult = [0.5, 0.75, 1][stars - 1], gold = Math.round(L.gold * mult), xp = Math.round(L.gold * 2 * mult);
  const newBest = !st.best[g.layout] || g.elapsed < st.best[g.layout];
  st.won++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); st.time += g.elapsed;
  st.wins[g.layout] = (st.wins[g.layout] || 0) + 1;
  if (newBest) st.best[g.layout] = g.elapsed;
  S.current = null; persist();
  const { levelUp } = award(gold, xp);
  sfx.win(); confetti();
  winModal({
    icon: L.icon, title: 'Board cleared!', sub: `${L.name} · ${L.level}`, stars,
    stats: [[fmtTime(g.elapsed), newBest ? '🏁 New best' : 'Time'], [g.hints, 'Hints'], [g.shuffles, 'Shuffles']],
    gold, xp, levelUp,
    btns: `<button class="btn primary" data-act="again">Play ${L.name} again</button><button class="btn" data-act="menu">Choose a board</button>`,
    handlers: { again: () => { closeModal(); startBoard(L.id); }, menu: () => { closeModal(); G = null; renderMenu(); show('menu'); } },
  });
}

function rulesModal() {
  modal(`<h2>How to play</h2><div class="rules">
    <p>Clear the board by removing <b>matching pairs</b> of tiles. Any flower (花) matches any flower, and any season (季) any season.</p>
    <p>A tile can only be picked when it's <b>free</b>: nothing sits on top of it and its left or right side is open.</p>
    <p>Every board can be cleared. If you run out of matches, a free reshuffle gets you going again, and undo goes as far back as you like.</p>
    <p>Finish without hints or shuffles for three stars and full gold.</p></div>
    <div class="m-btns"><button class="btn primary" data-act="close">Got it</button></div>`);
}
function statsModal() {
  const st = S.stats;
  modal(`<h2>Records</h2>
    <div class="stat-grid" style="margin-top:12px"><div class="stat"><b>${st.won}</b><small>Boards won</small></div><div class="stat"><b>${st.streak}</b><small>Streak</small></div><div class="stat"><b>${Math.round(st.time / 60)}</b><small>Minutes</small></div></div>
    <div class="card" style="margin-top:10px;padding:10px 12px"><table class="dtable"><tr><th>Board</th><th>Won</th><th>Best</th></tr>
      ${LAYOUTS.map(L => `<tr><td>${L.icon} ${L.name}</td><td>${st.wins[L.id] || 0}</td><td>${st.best[L.id] ? fmtTime(st.best[L.id]) : '–'}</td></tr>`).join('')}
    </table></div>
    <div class="m-btns"><button class="btn primary" data-act="close">Done</button></div>`);
}

/* ---------- Input, timer, lifecycle ---------- */
board.addEventListener('click', e => { const t = e.target.closest('.mt'); if (t) tap(+t.dataset.i); });
document.addEventListener('click', e => {
  const L = e.target.closest('[data-layout]');
  if (L) {
    sfx.tap();
    const id = L.dataset.layout;
    if (S.current && S.current.history.length) return confirmModal('Start a new board?', `Your ${layoutById(S.current.layout).name} board in progress will be lost.`, 'New board', () => startBoard(id), true);
    return startBoard(id);
  }
  const t = e.target.closest('[data-go], [data-tool]'); if (!t) return;
  if (t.dataset.go) {
    sfx.tap();
    switch (t.dataset.go) {
      case 'hub': persist(); goHub(); break;
      case 'menu': if (modalOpen()) closeModal(); persist(); G = null; renderMenu(); show('menu'); break;
      case 'resume': openGame(false); break;
      case 'dim': S.dim = !S.dim; persist(); t.querySelector('.switch').classList.toggle('on', S.dim); break;
      case 'rules': rulesModal(); break;
      case 'stats': statsModal(); break;
    }
    return;
  }
  if (!G || busy) return;
  switch (t.dataset.tool) {
    case 'undo': undo(); break;
    case 'hint': hint(); break;
    case 'shuffle': if (!doShuffle(false)) { sfx.error(); toast('These tiles can\'t be reshuffled'); } break;
    case 'new': sfx.tap(); confirmModal('New board?', 'Deal a fresh ' + layoutById(G.layout).name + ' board. This one will be lost.', 'Deal', () => startBoard(G.layout), true); break;
  }
});
setInterval(() => {
  if (!G || !G.counted || modalOpen() || activeScreen() !== 'screen-game' || document.visibilityState !== 'visible') return;
  G.elapsed++;
  $('#mj-time').textContent = '⏱ ' + fmtTime(G.elapsed);
  if (G.elapsed % 5 === 0) persist();
}, 1000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persist(); });
window.addEventListener('pagehide', persist);
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(layout, 80); });

applyTheme();
renderMenu();
if (!S.stats.played && !S.current) setTimeout(rulesModal, 500);
})();
