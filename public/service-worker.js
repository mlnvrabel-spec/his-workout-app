const CACHE_NAME = 'hypertrophy-v48';
const ASSETS = [
    '/',
    '/index.html',
    '/public/manifest.json',
    '/public/brand-mark.png',
    '/src/ui/Elena.css?v=35',
    '/src/ui/Kai.js?v=35',
    '/src/ui/HeroHeader.js?v=11',
    '/src/ui/Haptics.js?v=1',
    '/src/ui/AuthUI.js',
    '/src/ui/SettingsPanel.js',
    '/src/core/WorkoutEngine.js?v=9',
    '/src/core/GarminSync.js',
    '/src/core/StorageManager.js',
    '/src/core/ChatAssistant.js',
    '/src/data/core_protocol.json',
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
    'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:opsz,wght@14..32,100..900&display=swap'
];

self.addEventListener('install', event => {
    // Perform install steps
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(ASSETS);
            })
    );
    self.skipWaiting();
});

self.addEventListener('fetch', event => {
    if (event.request.mode === 'navigate') {
        event.respondWith(fetch(event.request).catch(() => caches.match('/index.html')));
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(response => {
                if (response?.ok && response.type === 'basic') {
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
                }
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});

// Clean up old caches
self.addEventListener('activate', event => {
    const cacheAllowlist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheAllowlist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});
