// Phone + offline check on an iPhone 16 Pro viewport, for the hub and each game page.
// Run: node tests/e2e.mjs. The runner lives in the shared ../e2e-kit (Playwright + installed Edge).
// Port = dev port + 1000, so it never collides with a running dev server.
import { runPhoneCheck } from '../../e2e-kit/run.mjs';
import { fileURLToPath } from 'node:url';

const appDir = fileURLToPath(new URL('..', import.meta.url));
let failed = 0;
for (const [name, path] of [['tatami-games', '/'], ['tatami-sudoku', '/sudoku.html'], ['tatami-solitaire', '/solitaire.html'], ['tatami-mahjong', '/mahjong.html']]) {
  failed += (await runPhoneCheck({ name, appDir, port: 9766, path })).failed;
}
process.exitCode = failed ? 1 : 0;
