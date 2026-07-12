const CACHE = 'guaipecaz-v32';
const SHELL = [
  '/',
  '/index.html',
  '/guibanews.html',
  '/noticia.html',
  '/servicos.html',
  '/participe.html',
  '/privacidade.html',
  '/termos.html',
  '/reportar-conteudo.html',
  '/saude.html',
  '/diario-oficial.html',
  '/contatos.html',
  '/contatos-emergencia.html',
  '/mulher.html',
  '/ajude-um-pet.html',
  '/apoio.json',
  '/apoio-data.js',
  '/emergencia.json',
  '/emergencia-data.js',
  '/schedules-data.js',
  '/unidades-map.json',
  '/unidades-map-data.js',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  '/sw.js',
  '/assets/favicon.svg',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/backgrounds/bg-por-sol.jpg',
  '/assets/backgrounds/bg-guaipeca-viralata.jpg',
  '/noticias-data.js',
  '/ofertas-data.js',
  '/rivers-data.js',
  '/editais-data.js',
  '/servicos-data.js',
];

function isNetworkFirst(url) {
  var p = url.pathname;
  if (p === '/' || p.endsWith('.html') || p.endsWith('.js') || p.endsWith('.json') || p.endsWith('.css')) {
    return true;
  }
  return false;
}

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

  if (isNetworkFirst(url)) {
    event.respondWith(
      fetch(event.request).then(function (response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
        }
        return response;
      }).catch(function () {
        return caches.match(event.request);
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return cached || fetch(event.request).then(function (response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
        }
        return response;
      });
    })
  );
});
