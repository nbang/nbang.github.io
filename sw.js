/**
 * Service Worker — caches HuggingFace model files so they are never
 * re-downloaded after the first visit.
 */
const CACHE = 'bang-tools-models-v1';

// Activate immediately and take control of all open pages
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    if (e.request.method !== 'GET') return;
    if (!url.hostname.endsWith('huggingface.co')) return;

    e.respondWith(
        caches.open(CACHE).then(cache =>
            cache.match(e.request).then(cached => {
                if (cached) return cached;
                return fetch(e.request).then(response => {
                    if (response.ok) cache.put(e.request, response.clone());
                    return response;
                });
            })
        )
    );
});

// Allow pages to request a full cache wipe
self.addEventListener('message', e => {
    if (e.data?.type === 'CLEAR_CACHE') {
        caches.delete(CACHE).then(() => {
            e.source?.postMessage({ type: 'CACHE_CLEARED' });
        });
    }
});
