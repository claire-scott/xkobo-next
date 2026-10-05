// Offline cache: network-first for our own files (so updates show up), cache fallback when offline.
const CACHE = 'xkobo-mobile-v3';
const CORE = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest', 'assets/sprites.png',
  'assets/icon-192.png', 'assets/icon-512.png', 'assets/icon-180.png',
  'js/main.js', 'js/config.js', 'js/opts.js', 'js/random.js', 'js/map.js', 'js/scenes.js', 'js/enemy.js',
  'js/myship.js', 'js/screen.js', 'js/radar.js', 'js/manage.js', 'js/key.js', 'js/input.js',
  'js/gfx.js', 'js/render.js', 'js/storage.js', 'js/attract.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !isFont) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then((m) => m || caches.match('index.html')))
  );
});
