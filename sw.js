// Service worker: tiene offline il guscio dell'app e riceve le notifiche.
// Chat e calendario arrivano dall'API di GitHub e NON passano di qui: l'app tiene
// la sua copia (IndexedDB e localStorage) e la mostra quando manca la rete.
const CACHE = 'regia-v9';
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

// Le notifiche: le manda il workflow (regia-dati/.regia/notifica.py), cifrate per
// questo telefono: { titolo, testo, chat, tag }. Una per chat: la nuova sostituisce
// quella vecchia della stessa chat.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { testo: e.data ? e.data.text() : '' }; }
  const chat = /^[a-z0-9][a-z0-9-]*$/.test(d.chat || '') ? d.chat : '';
  e.waitUntil(self.registration.showNotification(String(d.titolo || 'Boom').slice(0, 80), {
    body: String(d.testo || 'Claude ti ha scritto').slice(0, 240),
    tag: String(d.tag || chat || 'regia').slice(0, 60), renotify: true,
    icon: 'icon-192.png', badge: 'icon-192.png', data: { chat }
  }));
});

// un tocco sulla notifica apre (o riporta davanti) l'app, sulla chat giusta
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const chat = (e.notification.data || {}).chat || '';
  const url = new URL('./index.html?app' + (chat ? '&chat=' + encodeURIComponent(chat) : ''), self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
    for (const c of lista) {
      if (c.url.startsWith(self.registration.scope) && 'focus' in c) {
        if (chat) c.postMessage({ apri: chat });
        return c.focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});
