// Offline support: cache the app shell on install, serve cache-first, and
// refresh the cache in the background when the network is available.
const CACHE = 'piano-v17';   // bump when app code or bundled audio changes, so installed copies pick it up
const ASSETS = ['./', './index.html', './manifest.json', './icon.svg',
    './audio/piano/A0.mp3', './audio/piano/C1.mp3', './audio/piano/A1.mp3', './audio/piano/C2.mp3', './audio/piano/A2.mp3', './audio/piano/C3.mp3', './audio/piano/A3.mp3', './audio/piano/C4.mp3', './audio/piano/A4.mp3', './audio/piano/C5.mp3', './audio/piano/A5.mp3', './audio/piano/C6.mp3', './audio/piano/A6.mp3', './audio/piano/C7.mp3', './audio/piano/A7.mp3', './audio/piano/C8.mp3', './audio/violin/G3.mp3', './audio/violin/C4.mp3', './audio/violin/G4.mp3', './audio/violin/C5.mp3', './audio/violin/G5.mp3', './audio/violin/C6.mp3', './audio/violin/G6.mp3', './audio/violin/C7.mp3'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    e.respondWith(
        caches.match(e.request, { ignoreSearch: true }).then(hit => {
            const net = fetch(e.request).then(res => {
                if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
                return res;
            }).catch(() => hit);
            return hit || net;
        })
    );
});
