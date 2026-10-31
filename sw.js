// Network-first so updates show up straight away; cache keeps it working offline.
const CACHE = 'tatami-games-v8';
/* Vendored Google Fonts (fonts/fonts.css), precached so text looks right offline. */
const FONTS = ["fonts/fonts.css","fonts/ShipporiMinchoB1-0.woff2","fonts/ShipporiMinchoB1-1.woff2","fonts/ShipporiMinchoB1-2.woff2","fonts/ShipporiMinchoB1-3.woff2","fonts/ShipporiMinchoB1-4.woff2","fonts/ShipporiMinchoB1-5.woff2","fonts/ShipporiMinchoB1-6.woff2","fonts/ShipporiMinchoB1-7.woff2","fonts/ShipporiMinchoB1-8.woff2","fonts/ShipporiMinchoB1-9.woff2","fonts/ShipporiMinchoB1-10.woff2","fonts/ShipporiMinchoB1-11.woff2","fonts/ShipporiMinchoB1-12.woff2","fonts/ShipporiMinchoB1-13.woff2","fonts/ShipporiMinchoB1-14.woff2","fonts/ShipporiMinchoB1-15.woff2","fonts/ShipporiMinchoB1-16.woff2","fonts/ShipporiMinchoB1-17.woff2","fonts/ShipporiMinchoB1-18.woff2","fonts/ShipporiMinchoB1-19.woff2","fonts/ShipporiMinchoB1-20.woff2","fonts/ShipporiMinchoB1-21.woff2","fonts/ShipporiMinchoB1-22.woff2","fonts/ShipporiMinchoB1-23.woff2","fonts/ShipporiMinchoB1-24.woff2","fonts/ShipporiMinchoB1-25.woff2","fonts/ShipporiMinchoB1-26.woff2","fonts/ShipporiMinchoB1-27.woff2","fonts/ShipporiMinchoB1-28.woff2","fonts/ShipporiMinchoB1-29.woff2","fonts/ShipporiMinchoB1-30.woff2","fonts/ShipporiMinchoB1-31.woff2","fonts/ShipporiMinchoB1-32.woff2","fonts/ShipporiMinchoB1-33.woff2","fonts/ShipporiMinchoB1-34.woff2","fonts/ShipporiMinchoB1-35.woff2","fonts/ShipporiMinchoB1-36.woff2","fonts/ShipporiMinchoB1-37.woff2","fonts/ShipporiMinchoB1-38.woff2","fonts/ShipporiMinchoB1-39.woff2","fonts/ShipporiMinchoB1-40.woff2","fonts/ShipporiMinchoB1-41.woff2","fonts/ShipporiMinchoB1-42.woff2","fonts/ShipporiMinchoB1-43.woff2","fonts/ShipporiMinchoB1-44.woff2","fonts/ShipporiMinchoB1-45.woff2","fonts/ShipporiMinchoB1-46.woff2","fonts/ShipporiMinchoB1-47.woff2","fonts/ShipporiMinchoB1-48.woff2","fonts/ShipporiMinchoB1-49.woff2","fonts/ShipporiMinchoB1-50.woff2","fonts/ShipporiMinchoB1-51.woff2","fonts/ShipporiMinchoB1-52.woff2","fonts/ShipporiMinchoB1-53.woff2","fonts/ShipporiMinchoB1-54.woff2","fonts/ShipporiMinchoB1-55.woff2","fonts/ShipporiMinchoB1-56.woff2","fonts/ShipporiMinchoB1-57.woff2","fonts/ShipporiMinchoB1-58.woff2","fonts/ShipporiMinchoB1-59.woff2","fonts/ShipporiMinchoB1-60.woff2","fonts/ShipporiMinchoB1-61.woff2","fonts/ShipporiMinchoB1-62.woff2","fonts/ShipporiMinchoB1-63.woff2","fonts/ShipporiMinchoB1-64.woff2","fonts/ShipporiMinchoB1-65.woff2"];
const ASSETS = ['./', 'index.html', 'hub.js', 'common.js', 'style.css', 'games.css', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png',
  'sudoku.html', 'app.js', 'sudoku.js', 'solitaire.html', 'solitaire.js', 'mahjong.html', 'mahjong-core.js', 'mahjong.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.concat(FONTS))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k.startsWith('tatami-games-')).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
