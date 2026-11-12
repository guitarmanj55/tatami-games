# Tatami Games

Sudoku Quest, Solitaire and Mahjong in one Japanese-themed, offline-capable PWA for the iPhone home screen.

**Live:** https://guitarmanj55.github.io/tatami-games/

## Run it
Serve the folder with any static server on port 8766 and open it. No build step, no dependencies (fonts are vendored; see `scripts/README.md`).

```bash
node tests/e2e.mjs   # phone-viewport and offline check (needs Playwright via e2e-kit)
```

## Notes
Repo standards: `node scripts/check.mjs` (see `Code/STANDARDS.md`). Pure game logic lives in `*-core.js` files so it can be tested in Node.
