// public/sw.js
const CACHE_NAME = 'clickrush-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  // Vite build qilganda hosil bo'ladigan asosiy fayllar avtomatik keshlanadi,
  // lekin statik rasmlar yoki tovushlar bo'lsa, ularni bu yerga qo'shish kerak.
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Agar keshda bo'lsa, o'shani qaytaradi, bo'lmasa internetdan oladi
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});