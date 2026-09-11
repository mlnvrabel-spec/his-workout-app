const CACHE_NAME = 'hypertrophy-v64';
const ASSETS = [
    '/', '/index.html', '/public/manifest.json', '/public/brand-mark.png', '/public/brand-mark.svg',
    '/src/ui/Elena.css', '/src/ui/Kai.js', '/src/ui/HeroHeader.js', '/src/ui/Haptics.js',
    '/src/ui/ExerciseCards.js', '/src/ui/AuthUI.js', '/src/ui/SettingsPanel.js',
    '/src/ui/Modal.js', '/src/ui/HistoryPanel.js',
    '/src/core/WorkoutEngine.js', '/src/core/StorageManager.js', '/src/core/GarminSync.js',
    '/src/core/ChatAssistant.js', '/src/data/core_protocol.json'
];
self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS.map(path => new Request(path, { cache: 'reload' })))));
});
self.addEventListener('message', event => {
    if (event.data === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('hypertrophy-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
    if (event.request.mode === 'navigate') {
        event.respondWith(caches.open(CACHE_NAME).then(cache => cache.match('/index.html')).then(cached => cached || fetch(event.request)));
        return;
    }
    if (ASSETS.includes(url.pathname)) {
        event.respondWith(caches.open(CACHE_NAME).then(cache => cache.match(url.pathname)).then(cached => cached || fetch(event.request)));
    }
});
