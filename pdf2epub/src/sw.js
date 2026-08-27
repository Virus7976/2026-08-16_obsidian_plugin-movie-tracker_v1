/* Service worker: offline shell + Android share-target intake. */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const SHARED_CACHE = 'pdf2epub-shared';
const SHARED_KEY = '/__shared-pdf__';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Character maps are large and rarely needed; cache them the first time a
  // PDF actually asks for one.
  if (event.request.method === 'GET' && url.pathname.includes('/pdfjs/cmaps/')) {
    event.respondWith((async () => {
      const cache = await caches.open('pdf2epub-pdfjs');
      const hit = await cache.match(event.request);
      if (hit) return hit;
      const res = await fetch(event.request);
      if (res.ok) cache.put(event.request, res.clone());
      return res;
    })());
    return;
  }

  if (event.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    event.respondWith((async () => {
      try {
        const form = await event.request.formData();
        const file = form.get('pdf') || form.get('file');
        if (file && file.size) {
          const cache = await caches.open(SHARED_CACHE);
          await cache.put(SHARED_KEY, new Response(file, {
            headers: {
              'content-type': file.type || 'application/pdf',
              'x-filename': encodeURIComponent(file.name || 'shared.pdf'),
            },
          }));
        }
      } catch { /* fall through to the app either way */ }
      const scope = new URL(self.registration.scope);
      return Response.redirect(`${scope.pathname}?shared=1`, 303);
    })());
  }
});
