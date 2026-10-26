'use strict';
(() => {
const { $, PROFILE_KEY, SOL_KEY, MJ_KEY, readJSON, writeJSON, profile, levelInfo, titleFor, applyTheme, soundOn, setSound, sfx, ICON, fmtTime, modal, closeModal, modalOpen, confirmModal, toast } = Common;

const PETALS = '<div class="petals">' + Array.from({ length: 12 }, () =>
  `<i style="left:${(Math.random() * 100).toFixed(1)}%;animation-duration:${(9 + Math.random() * 9).toFixed(1)}s;animation-delay:-${(Math.random() * 18).toFixed(1)}s;width:${(6 + Math.random() * 7).toFixed(0)}px;height:${(5 + Math.random() * 5).toFixed(0)}px"></i>`).join('') + '</div>';

const questStars = p => Object.values(p.quest || {}).reduce((a, q) => a + (q.stars || 0), 0);
const winsText = st => st && st.won ? `${st.won} win${st.won > 1 ? 's' : ''}${st.bestStreak > 1 ? ` · best streak ${st.bestStreak}` : ''}` : 'Not won yet';

function render() {
  const p = profile(), li = levelInfo(p.xp || 0), sol = readJSON(SOL_KEY) || {}, mj = readJSON(MJ_KEY) || {};
  const sStats = p.stats || {};
  const games = [
    { href: 'sudoku.html', seal: '数', name: 'Sudoku Quest', jp: '数独', live: !!p.current,
      info: p.current ? 'Puzzle in progress · ' + fmtTime(p.current.elapsed) : `${sStats.solved || 0} solved · ⭐ ${questStars(p)} quest stars` },
    { href: 'solitaire.html', seal: '札', name: 'Solitaire', jp: '一人札', live: !!(sol.current && sol.current.moves),
      info: sol.current && sol.current.moves ? `Deal in progress · Draw ${sol.current.draw} · ${sol.current.moves} moves` : 'Klondike · ' + winsText(sol.stats) },
    { href: 'mahjong.html', seal: '牌', name: 'Mahjong', jp: '麻雀', live: !!(mj.current && mj.current.history && mj.current.history.length),
      info: mj.current && mj.current.history && mj.current.history.length ? `Board in progress · ${mj.current.faces.filter(f => f >= 0).length} tiles left` : 'Tile matching · ' + winsText(mj.stats) },
  ];
  $('#screen-home').innerHTML = `
    ${PETALS}
    <div class="hero"><div class="sun"></div>${ICON.mountains}<div class="seal">遊</div><h1>Tatami Games</h1><p class="jp">遊戯の間</p><p class="tag">Three quiet games, one wallet. Every win earns gold for new themes.</p></div>
    <div class="card player">
      <div class="avatar"><span>${li.level}</span></div>
      <div class="pinfo">
        <div class="ptitle">${titleFor(li.level)}<small>Lv ${li.level}</small></div>
        <div class="xpbar"><i style="width:${(li.cur / li.span * 100).toFixed(1)}%"></i></div>
        <div class="xptext">${li.cur} / ${li.span} XP</div>
      </div>
      <div class="gold-big">${ICON.coin}${p.gold || 0}</div>
    </div>
    ${games.map(g => `<a class="big game-card" href="${g.href}">
      <span class="gseal">${g.seal}</span>
      <span><b>${g.name} <em>${g.jp}</em></b><small>${g.live ? '<span class="live">▶</span> ' : ''}${g.info}</small></span>
      <span class="chev">›</span></a>`).join('')}
    <div class="mini-row">
      <a href="sudoku.html#shop">🪭<span>Themes</span></a>
      <button data-go="records">📜<span>Records</span></button>
      <button data-go="settings">⚙️<span>Settings</span></button>
    </div>`;
}

function recordsModal() {
  const p = profile(), sol = (readJSON(SOL_KEY) || {}).stats || {}, mj = (readJSON(MJ_KEY) || {}).stats || {}, s = p.stats || {};
  const row = (name, played, won, best, time) => `<tr><td>${name}</td><td>${played}</td><td>${won}</td><td>${best ? fmtTime(best) : '–'}</td><td>${Math.round((time || 0) / 60)}m</td></tr>`;
  const bestOf = o => Math.min(...Object.values(o || {}).filter(Boolean), Infinity);
  const fin = v => (Number.isFinite(v) ? v : 0);
  const sBest = fin(bestOf(Object.fromEntries(Object.entries(s.byDiff || {}).map(([k, v]) => [k, v.best]))));
  modal(`<h2>Records</h2>
    <div class="card" style="margin-top:12px;padding:10px 12px"><table class="dtable"><tr><th>Game</th><th>Played</th><th>Won</th><th>Best</th><th>Time</th></tr>
      ${row('Sudoku', s.solved || 0, s.solved || 0, sBest, s.timePlayed)}
      ${row('Solitaire', sol.played || 0, sol.won || 0, fin(bestOf(sol.best)), sol.time)}
      ${row('Mahjong', mj.played || 0, mj.won || 0, fin(bestOf(mj.best)), mj.time)}
    </table></div>
    <p class="muted" style="font-size:12px">Sudoku counts solved puzzles; its journal has the full breakdown and achievements.</p>
    <div class="m-btns"><button class="btn primary" data-act="close">Done</button></div>`);
}

/* ---------- Backup, restore & reset (all three games) ---------- */
// A pasted backup may come from anywhere: allow only finite numbers, booleans, null and plain ids/dates,
// so nothing in it can turn into markup when the screens render it
function safeSave(v, depth = 0) {
  if (depth > 7) return false;
  if (v === null || typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string') return /^[\w .:-]{0,40}$/.test(v);
  if (typeof v !== 'object') return false;
  return Object.entries(v).every(([k, x]) => /^[\w .:-]{1,40}$/.test(k) && safeSave(x, depth + 1));
}
const validSudoku = d => d && typeof d === 'object' && Number.isFinite(d.xp) && Number.isFinite(d.gold ?? 0) && typeof d.quest === 'object';

function settingsModal() {
  modal(`<h2>Settings</h2>
    <div class="set-list"><div class="set-row" data-act="sound"><span>Sound effects</span><span class="switch ${soundOn() ? 'on' : ''}"></span></div></div>
    <p class="muted" style="font-size:12px;margin-top:14px">Progress saves automatically on this device. A backup code holds all three games, so you can move it or keep it safe.</p>
    <div class="m-btns">
      <button class="btn" data-act="backup">Copy backup code</button>
      <button class="btn" data-act="restore">Restore from code</button>
      <button class="btn danger" data-act="reset">Reset all progress</button>
      <button class="btn primary" data-act="close">Done</button>
    </div>`, {
    sound: el => { setSound(!soundOn()); el.querySelector('.switch').classList.toggle('on', soundOn()); if (soundOn()) sfx.coin(); },
    backup: () => {
      const data = { v: 2, sudoku: readJSON(PROFILE_KEY), solitaire: readJSON(SOL_KEY), mahjong: readJSON(MJ_KEY) };
      const code = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
      modal(`<h2>Backup code</h2><p class="muted">Copy this and keep it somewhere safe (Notes works).</p><textarea class="code" readonly>${code}</textarea>
        <div class="m-btns"><button class="btn primary" data-act="copy">Copy</button><button class="btn" data-act="back">Back</button></div>`,
        {
          copy: () => {
            const ta = $('#modal-card textarea');
            (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(() => toast('Copied!'), () => { ta.select(); document.execCommand('copy'); toast('Copied!'); });
          },
          back: settingsModal,
        });
    },
    restore: () => {
      modal(`<h2>Restore</h2><p class="muted">Paste a backup code. This replaces your current progress.</p><textarea class="code" placeholder="Paste code here"></textarea>
        <div class="m-btns"><button class="btn primary" data-act="apply">Restore</button><button class="btn" data-act="back">Back</button></div>`,
        {
          apply: () => {
            try {
              const data = JSON.parse(decodeURIComponent(escape(atob($('#modal-card textarea').value.trim()))));
              if (!safeSave(data)) throw 0;
              // codes made before the hub existed hold just the Sudoku save
              const parts = data.v === 2 ? data : { sudoku: data, solitaire: null, mahjong: null };
              if (parts.sudoku !== null && !validSudoku(parts.sudoku)) throw 0;
              [[PROFILE_KEY, parts.sudoku], [SOL_KEY, parts.solitaire], [MJ_KEY, parts.mahjong]].forEach(([k, v]) => {
                if (v && typeof v === 'object') writeJSON(k, v); else localStorage.removeItem(k);
              });
              applyTheme(); closeModal(); render(); toast('Progress restored ✓');
            } catch (e) { toast('That code doesn\'t look right'); }
          },
          back: settingsModal,
        });
    },
    reset: () => confirmModal('Reset everything?', 'All three games, plus your level, gold, themes and stats, will be wiped. This cannot be undone.', 'Reset', () => {
      [PROFILE_KEY, SOL_KEY, MJ_KEY].forEach(k => localStorage.removeItem(k));
      applyTheme(); render(); toast('Fresh start');
    }, true),
  });
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-go]'); if (!t) return;
  if (modalOpen()) closeModal();
  sfx.tap();
  if (t.dataset.go === 'records') recordsModal();
  if (t.dataset.go === 'settings') settingsModal();
});

applyTheme();
render();
// Sudoku's settings link here for backups
if (location.hash === '#settings') { history.replaceState(null, '', location.pathname); settingsModal(); }
})();
