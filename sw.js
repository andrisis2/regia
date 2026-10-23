// Service worker minimale: tiene offline solo il guscio dell'app.
// Chat e agenda arrivano dall'API di GitHub e NON passano di qui: l'app tiene
// la sua copia (IndexedDB e localStorage) e la mostra quando manca la rete.
const CACHE = 'regia-v4';
const ASSETS = ['./', './index.html', './manifest.json', './icon.png', './icon-192.png', './icon-maskable.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // tutto ciò che non è dell'app (in primis api.github.com) passa diretto:
  // intercettarlo romperebbe autenticazione e salvataggi
  if (url.origin !== self.location.origin || e.request.method !== 'GET') return;

  // l'app si aggiorna da sola: prima la rete (con un limite, se la rete è
  // debole), la cache è la riserva
  e.respondWith(
    Promise.race([
      fetch(e.request).then(r => {
        if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return r;
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('lenta')), 4000))
    ]).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
