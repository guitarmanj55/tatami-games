// Mahjong solitaire engine: portrait-friendly layouts, the free-tile rule and solvable deals.
// Positions are in half-tile units, so a tile at (x, y, z) covers x..x+2 and y..y+2 on layer z.
(function (global) {
  'use strict';

  // Each layer is a grid of whole tiles, nudged by (ox, oy) half-units so upper layers can sit between the tiles below.
  // `step` spaces the grid out (in half-units) and `z` puts a grid on an earlier layer's level.
  const LAYOUTS = [
    { id: 'garden', name: 'Garden', icon: '🌸', level: 'Easy', gold: 15, layers: [
      { ox: 0, oy: 0, rows: ['XXX..XXX', 'XXXXXXXX', '.XXXXXX.', '..XXXX..', '..XXXX..', '.XXXXXX.', 'XXXXXXXX', 'XXX..XXX'] },
      { ox: 2, oy: 2, rows: ['XX..XX', '.XXXX.', '..XX..', '..XX..', '.XXXX.', 'XX..XX'] },
      { ox: 6, oy: 6, rows: ['XX', 'XX'] },
    ] },
    { id: 'fortress', name: 'Fortress', icon: '🏯', level: 'Medium', gold: 25, layers: [
      { ox: 0, oy: 0, rows: ['XX.XX.XX', 'XXXXXXXX', 'XX.XX.XX', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', 'XX.XX.XX', 'XXXXXXXX', 'XX.XX.XX'] },
      { ox: 0, oy: 0, rows: ['XX....XX', 'XX....XX', '........', '..XXXX..', '..XXXX..', '..XXXX..', '..XXXX..', '........', 'XX....XX', 'XX....XX'] },
      { ox: 1, oy: 1, rows: ['XX', 'XX'], step: [12, 16] },
      { ox: 6, oy: 8, rows: ['XX', 'XX'], z: 2 },
    ] },
    { id: 'pagoda', name: 'Pagoda', icon: '⛩️', level: 'Hard', gold: 35, layers: [
      { ox: 0, oy: 0, rows: ['.XXXXXX.', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', '.XXXXXX.'] },
      { ox: 1, oy: 2, rows: ['XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX'] },
      { ox: 4, oy: 8, rows: ['XXXX', 'XXXX'] },
      { ox: 6, oy: 9, rows: ['XX'] },
    ] },
    { id: 'shrine', name: 'Shrine', icon: '🗻', level: 'Expert', gold: 50, layers: [
      { ox: 0, oy: 0, rows: ['XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX'] },
      { ox: 2, oy: 2, rows: ['XXXXXX', 'XXXXXX', 'XXXXXX', 'XXXXXX', 'XXXXXX', 'XXXXXX', 'XXXXXX', 'XXXXXX'] },
      { ox: 4, oy: 6, rows: ['XXXX', 'XXXX', 'XXXX', 'XXXX'] },
    ] },
  ];

  // Expands a layout to [{x, y, z}] plus, per tile, the tiles that block it from above, left and right
  function build(layout) {
    const tiles = [];
    layout.layers.forEach((L, k) => {
      const [sx, sy] = L.step || [2, 2], z = L.z ?? k;
      L.rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === 'X') tiles.push({ x: L.ox + c * sx, y: L.oy + r * sy, z }); }));
    });
    const above = tiles.map(() => []), left = tiles.map(() => []), right = tiles.map(() => []);
    tiles.forEach((a, i) => tiles.forEach((b, j) => {
      if (i === j) return;
      const ox = Math.abs(a.x - b.x) < 2, oy = Math.abs(a.y - b.y) < 2;
      if (b.z === a.z + 1 && ox && oy) above[i].push(j);
      if (b.z === a.z && oy && b.x === a.x - 2) left[i].push(j);
      if (b.z === a.z && oy && b.x === a.x + 2) right[i].push(j);
    }));
    return { tiles, above, left, right };
  }

  // A tile is free when nothing sits on it and one of its long sides is open
  function isFree(B, i, present) {
    const on = j => present[j];
    return !B.above[i].some(on) && (!B.left[i].some(on) || !B.right[i].some(on));
  }

  // Faces: 0-8 dots, 9-17 bamboo, 18-26 characters, 27-30 winds, 31-33 dragons, 34-37 flowers, 38-41 seasons.
  // Any flower matches any flower, and the same for seasons.
  const matchKey = f => (f >= 38 ? 38 : f >= 34 ? 34 : f);
  const matches = (a, b) => a >= 0 && b >= 0 && matchKey(a) === matchKey(b);

  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function shuffle(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // The face pairs for an n-tile board: whole sets of four where possible, like a real tile set
  function pairsFor(n, rnd) {
    const quads = [];
    for (let f = 0; f < 34; f++) quads.push([[f, f], [f, f]]);
    quads.push([[34, 35], [36, 37]], [[38, 39], [40, 41]]);
    return shuffle(quads, rnd).flat().slice(0, n / 2);
  }

  // Plays the board backwards from full: repeatedly take two tiles that are free right now and give them a pair.
  // The order they were taken in is a winning line, so every deal can be cleared.
  function assign(B, positions, pairs, rnd) {
    const n = B.tiles.length;
    for (let attempt = 0; attempt < 300; attempt++) {
      const present = new Array(n).fill(false), faces = new Array(n).fill(-1);
      positions.forEach(i => { present[i] = true; });
      const order = shuffle(pairs.slice(), rnd);
      let ok = true;
      for (const [a, b] of order) {
        const free = positions.filter(i => present[i] && isFree(B, i, present));
        if (free.length < 2) { ok = false; break; }
        const i = free[Math.floor(rnd() * free.length)];
        let j; do { j = free[Math.floor(rnd() * free.length)]; } while (j === i);
        faces[i] = a; faces[j] = b; present[i] = present[j] = false;
      }
      if (ok) return faces;
    }
    return null;
  }
  function deal(B, seed) {
    const rnd = rng(seed), n = B.tiles.length;
    return assign(B, B.tiles.map((_, i) => i), pairsFor(n, rnd), rnd);
  }
  // Re-deals the tiles still on the board so the rest can be cleared; null if no arrangement can be
  function reshuffle(B, faces, seed) {
    const rnd = rng(seed), positions = [], left = [];
    faces.forEach((f, i) => { if (f >= 0) { positions.push(i); left.push(f); } });
    left.sort((a, b) => matchKey(a) - matchKey(b) || a - b);
    const pairs = [];
    for (let k = 0; k < left.length; k += 2) pairs.push([left[k], left[k + 1]]);
    const out = assign(B, positions, pairs, rnd);
    return out && faces.map((f, i) => (f >= 0 ? out[i] : -1));
  }
  function freePairs(B, faces) {
    const present = faces.map(f => f >= 0), free = [];
    faces.forEach((f, i) => { if (f >= 0 && isFree(B, i, present)) free.push(i); });
    const out = [];
    for (let a = 0; a < free.length; a++) for (let b = a + 1; b < free.length; b++) if (matches(faces[free[a]], faces[free[b]])) out.push([free[a], free[b]]);
    return out;
  }

  global.Mahjong = { LAYOUTS, build, isFree, matches, matchKey, deal, reshuffle, freePairs };
})(typeof window !== 'undefined' ? window : globalThis);
