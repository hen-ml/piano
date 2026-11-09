// Offline support: cache the app shell on install, serve cache-first, and
// refresh the cache in the background when the network is available.
// Keep the version in step with APP_VERSION in index.html (tests/audio.test.cjs
// asserts they match). Bump it when app code or bundled audio changes, so
// installed copies refresh instead of running last release's cache.
const CACHE = 'piano-v0.9.0-beta.1';
const ASSETS = [
    './', './index.html', './manifest.json', './icon.svg',
    './icon-180.png', './icon-192.png', './icon-512.png',
    ...['A0', 'C1', 'Ds1', 'Fs1', 'A1', 'C2', 'Ds2', 'Fs2', 'A2', 'C3',
        'Ds3', 'Fs3', 'A3', 'C4', 'Ds4', 'Fs4', 'A4', 'C5', 'Ds5', 'Fs5',
        'A5', 'C6', 'Ds6', 'Fs6', 'A6', 'C7', 'Ds7', 'Fs7', 'A7', 'C8']
        .map(note => `./audio/piano/${note}.mp3`),
    ...['G3', 'A3', 'C4', 'E4', 'G4', 'A4', 'C5', 'E5', 'G5', 'A5',
        'C6', 'E6', 'G6', 'A6', 'C7'].map(note => `./audio/violin/${note}.mp3`),
];

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
