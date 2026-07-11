const CACHE = 'guaipecas-v1';
const SHELL = [
  '/',
  '/index.html',
  '/guibanews.html',
  '/servicos.html',
  '/saude.html',
  '/diario-oficial.html',
  '/contatos.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  '/sw.js',
  '/assets/favicon.svg',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/noticias-data.js',
  '/rivers-data.js',
  '/editais-data.js',
  '/servicos-data.js',
  '/unidades-map-data.js',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(SHELL.map(function (u) { return new Request(u, { cache: 'reload' }); }))
        .catch(function () { /* shell parcial ok */ });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) {
        return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var fetchPromise = fetch(event.request).then(function (response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
        }
        return response;
      }).catch(function () { return cached; });
      return cached || fetchPromise;
    })
  );
});
