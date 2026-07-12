// Privacidade — consentimento antes do Google Analytics (LGPD + Consent Mode v2)
window.GuaipecazConsent = (function(){
  var KEY = 'guaipecaz_cookie_consent';

  function get() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function set(value) {
    try { localStorage.setItem(KEY, value); } catch (e) {}
  }

  function ensureGtag() {
    window.dataLayer = window.dataLayer || [];
    if (!window.gtag) {
      window.gtag = function(){ window.dataLayer.push(arguments); };
    }
  }

  function setConsentDefault() {
    ensureGtag();
    window.gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      wait_for_update: 500
    });
  }

  function loadAnalytics() {
    var id = window.GUAIPECAS_GA4_ID;
    if (!id || id.indexOf('G-') !== 0 || id === 'G-XXXXXXXX' || window.__guaipecasGaLoaded) return;
    window.__guaipecasGaLoaded = true;

    ensureGtag();
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    window.gtag('js', new Date());
    window.gtag('config', id, { anonymize_ip: true, send_page_view: true });

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(s);

    window.guaipecasTrack = function(eventName, params) {
      if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, params || {});
      }
    };
  }

  function mountBanner() {
    if (get() || document.getElementById('cookieConsent')) return;

    var banner = document.createElement('div');
    banner.id = 'cookieConsent';
    banner.className = 'cookie-consent';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Preferências de cookies');
    banner.innerHTML =
      '<div class="cookie-consent__inner">' +
        '<p class="cookie-consent__text">Usamos cookies essenciais para salvar sua cidade preferida. Com sua permissão, também usamos Google Analytics para medir visitas — sem vender dados. Leia a <a href="privacidade.html">Política de Privacidade</a>.</p>' +
        '<div class="cookie-consent__actions">' +
          '<button type="button" class="btn-secondary btn-secondary--sm" data-cookie="essential">Só essenciais</button>' +
          '<button type="button" class="btn-primary btn-secondary--sm" data-cookie="analytics">Aceitar analytics</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(banner);

    banner.addEventListener('click', function(e){
      var btn = e.target.closest('[data-cookie]');
      if (!btn) return;
      set(btn.getAttribute('data-cookie'));
      banner.remove();
      if (btn.getAttribute('data-cookie') === 'analytics') loadAnalytics();
    });
  }

  setConsentDefault();
  if (get() === 'analytics') loadAnalytics();
  else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountBanner);
  } else {
    mountBanner();
  }

  return { loadAnalytics: loadAnalytics };
})();

/** Página interna da notícia — mantém o usuário no Guaipecaz. */
function guaipecasNoticiaUrl(item) {
  if (item && item.id) return 'noticia.html?id=' + encodeURIComponent(item.id);
  return (item && item.url) || '#';
}

// Cadências oficiais — espelham automation/schedules.json e os workflows do GitHub Actions
window.GuaipecazSchedules = (function(){
  var data = window.GUISCHEDULES_DATA || { feeds: {} };

  function feed(key) {
    return (data.feeds && data.feeds[key]) || null;
  }

  function label(key) {
    var f = feed(key);
    return f && f.label ? f.label : '';
  }

  function intervalMs(key) {
    var f = feed(key);
    return f && f.interval_minutes ? f.interval_minutes * 60000 : 0;
  }

  function fetchDelayMs(key) {
    var f = feed(key);
    var min = f && f.fetch_delay_minutes != null ? f.fetch_delay_minutes : 3;
    return min * 60000;
  }

  function cronFieldMatches(field, value) {
    if (field === '*') return true;
    if (field.indexOf('*/') === 0) {
      var step = parseInt(field.slice(2), 10);
      return !isNaN(step) && step > 0 && value % step === 0;
    }
    return field.split(',').some(function(part){
      part = part.trim();
      if (!part) return false;
      if (part.indexOf('-') >= 0) {
        var bounds = part.split('-');
        var lo = parseInt(bounds[0], 10);
        var hi = parseInt(bounds[1], 10);
        return value >= lo && value <= hi;
      }
      return value === parseInt(part, 10);
    });
  }

  function cronMatches(date, cron) {
    var parts = String(cron || '').trim().split(/\s+/);
    if (parts.length !== 5) return false;
    return cronFieldMatches(parts[0], date.getUTCMinutes()) &&
      cronFieldMatches(parts[1], date.getUTCHours()) &&
      cronFieldMatches(parts[2], date.getUTCDate()) &&
      cronFieldMatches(parts[3], date.getUTCMonth() + 1) &&
      cronFieldMatches(parts[4], date.getUTCDay());
  }

  function nextCronUtc(cron, from) {
    var cursor = new Date((from || new Date()).getTime());
    cursor.setUTCSeconds(0, 0);
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
    var limit = cursor.getTime() + 8 * 24 * 60 * 60 * 1000;
    while (cursor.getTime() < limit) {
      if (cronMatches(cursor, cron)) return new Date(cursor.getTime());
      cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
    }
    return null;
  }

  function lastCronUtc(cron, from) {
    var cursor = new Date((from || new Date()).getTime());
    cursor.setUTCSeconds(0, 0);
    var floor = cursor.getTime() - 8 * 24 * 60 * 60 * 1000;
    while (cursor.getTime() > floor) {
      if (cronMatches(cursor, cron)) return new Date(cursor.getTime());
      cursor.setUTCMinutes(cursor.getUTCMinutes() - 1);
    }
    return null;
  }

  function applyCadence(root) {
    (root || document).querySelectorAll('[data-cadence]').forEach(function(el){
      var text = label(el.getAttribute('data-cadence'));
      if (!text) return;
      if (el.getAttribute('data-cadence-mode') === 'prefix') {
        el.textContent = text.charAt(0).toUpperCase() + text.slice(1);
      } else {
        el.textContent = text;
      }
    });
  }

  function updateStamp(el, geradoEm, key, opts) {
    if (!el || !geradoEm) return;
    opts = opts || {};
    var dt = new Date(geradoEm).toLocaleString('pt-BR');
    var cadence = label(key);
    var prefix = opts.cached ? 'dados em cache: ' : 'última atualização: ';
    el.textContent = prefix + dt + (cadence ? ' · ' + cadence : '');
    if (typeof clearSkeleton === 'function') clearSkeleton(el);
  }

  function alignPoll(key, fn) {
    var f = feed(key);
    if (!f || !f.cron || typeof fn !== 'function') return;
    var timer = null;

    function schedule() {
      if (timer) window.clearTimeout(timer);
      var next = nextCronUtc(f.cron, new Date());
      if (!next) return;
      var target = next.getTime() + fetchDelayMs(key);
      var wait = Math.max(1000, target - Date.now());
      timer = window.setTimeout(function(){
        if (document.visibilityState !== 'hidden') fn();
        schedule();
      }, wait);
    }

    function maybeCatchUp() {
      if (document.visibilityState === 'hidden') return;
      var last = lastCronUtc(f.cron, new Date());
      if (!last) return;
      var due = last.getTime() + fetchDelayMs(key);
      if (Date.now() >= due) fn();
    }

    schedule();
    document.addEventListener('visibilitychange', maybeCatchUp);
  }

  function poll(key, fn) {
    alignPoll(key, fn);
  }

  function boot() { applyCadence(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  return {
    feed: feed,
    label: label,
    intervalMs: intervalMs,
    applyCadence: applyCadence,
    updateStamp: updateStamp,
    alignPoll: alignPoll,
    poll: poll,
    nextCronUtc: nextCronUtc,
    lastCronUtc: lastCronUtc
  };
})();

// Cidade global — sincroniza mapas e previsão do tempo
window.GuaipecasCidade = (function(){
  var KEY = 'guaipecas_cidade';
  var CITIES = {
    guaiba: { name: 'Guaíba', lat: -30.1116, lon: -51.3237, zoom: 13 },
    poa: { name: 'Porto Alegre', lat: -30.0346, lon: -51.2177, zoom: 12 },
    canoas: { name: 'Canoas', lat: -29.9178, lon: -51.1836, zoom: 13 },
    eldorado: { name: 'Eldorado do Sul', lat: -30.0847, lon: -51.2936, zoom: 13 }
  };
  var listeners = [];

  function get() {
    var id = localStorage.getItem(KEY) || 'guaiba';
    return CITIES[id] ? id : 'guaiba';
  }

  function set(id) {
    if (!CITIES[id]) return;
    var prev = get();
    if (prev === id) return;
    try { localStorage.setItem(KEY, id); } catch (e) {}
    listeners.forEach(function(fn){ fn(id, prev); });
  }

  function onChange(fn) { listeners.push(fn); }

  function getConfig(id) { return CITIES[id || get()]; }

  function syncUi() {
    var current = get();
    document.querySelectorAll('[data-cidade-selector] [data-city], #wxCities [data-city]').forEach(function(btn){
      var active = btn.getAttribute('data-city') === current;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  window.addEventListener('storage', function(e){
    if (e.key !== KEY || !CITIES[e.newValue]) return;
    listeners.forEach(function(fn){ fn(e.newValue, e.oldValue); });
    syncUi();
  });

  return { get: get, set: set, onChange: onChange, getConfig: getConfig, syncUi: syncUi, list: CITIES };
})();

// Seletores de cidade reutilizáveis (mapas)
function guaipecasAllowedCities() {
  var raw = document.body.getAttribute('data-explorar-cidades');
  if (!raw) return null;
  return raw.split(',').map(function(s){ return s.trim(); }).filter(Boolean);
}

function guaipecasInitCidadeSelectors() {
  var gc = window.GuaipecasCidade;
  if (!gc) return;
  var allowed = guaipecasAllowedCities();

  document.querySelectorAll('[data-cidade-selector]').forEach(function(row){
    if (row.dataset.cidadeReady) return;
    row.dataset.cidadeReady = '1';
    var cityIds = Object.keys(gc.list).filter(function(id){
      return !allowed || allowed.indexOf(id) !== -1;
    });
    row.innerHTML = cityIds.map(function(id){
      var cfg = gc.list[id];
      return '<button type="button" class="weather-city" data-city="' + id + '" role="tab" aria-selected="false">' + cfg.name + '</button>';
    }).join('');
    row.addEventListener('click', function(e){
      var btn = e.target.closest('[data-city]');
      if (!btn) return;
      gc.set(btn.getAttribute('data-city'));
    });
  });

  if (allowed && allowed.indexOf(gc.get()) === -1) {
    gc.set(allowed[0] || 'guaiba');
  }

  gc.syncUi();
}

(function(){
  var gc = window.GuaipecasCidade;
  if (!gc) return;
  gc.onChange(function(){ gc.syncUi(); });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', guaipecasInitCidadeSelectors);
  } else {
    guaipecasInitCidadeSelectors();
  }
})();

// Leaflet — carregamento compartilhado
window.guaipecasLoadLeaflet = function(cb) {
  if (window.L) { cb(); return; }
  if (!document.querySelector('link[data-leaflet]')) {
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    css.setAttribute('data-leaflet', '1');
    document.head.appendChild(css);
  }
  var existing = document.querySelector('script[data-leaflet]');
  if (existing) {
    if (window.L) cb();
    else existing.addEventListener('load', cb);
    return;
  }
  var leaflet = document.createElement('script');
  leaflet.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  leaflet.setAttribute('data-leaflet', '1');
  leaflet.onload = cb;
  document.head.appendChild(leaflet);
};

// Ajusta o container da imagem à proporção real do arquivo (sem crop)
window.guaipecasFitImageFrame = function(img) {
  function fit() {
    if (!img || !img.naturalWidth) return;
    var wrap = img.parentElement;
    if (!wrap) return;
    wrap.style.aspectRatio = img.naturalWidth + ' / ' + img.naturalHeight;
  }
  if (img.complete && img.naturalWidth) fit();
  else img.addEventListener('load', fit, { once: true });
};

// Marcadores com ícones temáticos e deslocamento para pins sobrepostos
window.guaipecasMapHelpers = (function(){
  var SERVICO_CORES = {
    samu: '#e63946',
    bombeiros: '#e76f51',
    policia: '#457b9d',
    'defesa-civil': '#2a9d8f',
    'disque-180': '#7b5ea7',
    mulher: '#c77dff',
    abrigo: '#6a994e',
    animal: '#bc6c25',
    farmacia: '#2a9d8f',
    ubs: '#1d8a6e',
    esf: '#3dadb8',
    caps: '#5c7cfa',
    outros: '#8b9cb3',
    saude: '#2eb8d4',
    emergencia: '#e63946',
    lugar: '#2eb8d4',
    parque: '#52b788',
    orla: '#48cae4',
    cultura: '#9d4edd',
    feira: '#ffd166',
    roteiro: '#4ec9a0',
    evento: '#c77dff',
    default: '#2eb8d4'
  };

  var ICONS = {
    samu: '<path d="M8 2v5H3v2h5v5h2V9h5V7h-5V2H8z"/>',
    bombeiros: '<path d="M8 3c-2 0-3.5 1.2-3.5 3v1.5h7V6c0-1.8-1.5-3-3.5-3zm-4 5.5v1.8l1.2 4.5h5.6l1.2-4.5V8.5H4zm2.2 6.5h3.6l-.5 1.5H6.7l-.5-1.5z"/>',
    policia: '<path d="M8 1.5L3 4v4.2c0 3.1 2.1 5.4 5 6.3 2.9-.9 5-3.2 5-6.3V4L8 1.5zm0 2.2l2.5 1.4v2.8c0 1.8-1.2 3.3-2.5 3.9-1.3-.6-2.5-2.1-2.5-3.9V5.1L8 3.7z"/>',
    'defesa-civil': '<path d="M8 1.5L2.5 4.2v3.3c0 3.4 2.3 6.5 5.5 7.5 3.2-1 5.5-4.1 5.5-7.5V4.2L8 1.5zm-.8 3.8h1.6l.3 3.5H6.9l.3-3.5zm.8 5.2a1 1 0 110 2 1 1 0 010-2z"/>',
    'disque-180': '<path d="M5.2 2.5c-.5.5-.8 1.2-.8 2v1.2c0 .8.3 1.5.8 2l2.2 2.2c.5.5 1.2.8 2 .8h1.2c.8 0 1.5-.3 2-.8l.3-.3-1.2-1.2-.3.3c-.2.2-.5.3-.8.3H9.4c-.3 0-.6-.1-.8-.3L6.4 7.1c-.2-.2-.3-.5-.3-.8V5.1c0-.3.1-.6.3-.8l1.1-1.1L6.3 2.2 5.2 3.3zm5.1 1.1l1.1 1.1 1.1-1.1c.5-.5.8-1.2.8-2V2.3h-1.2v.2c0 .3-.1.6-.3.8l-1.5 1.3z"/>',
    mulher: '<path d="M8 2a2.2 2.2 0 100 4.4A2.2 2.2 0 008 2zm-3.2 4.6c-.8.7-1.3 1.7-1.3 2.9V12h1.8v-1.8c0-.8.4-1.5 1-1.9l.2 3.5h1.8l.2-3.5c.6.4 1 1.1 1 1.9V12h1.8V9.5c0-1.2-.5-2.2-1.3-2.9L8 9.2 4.8 6.6z"/>',
    abrigo: '<path d="M2.5 7.5L8 3l5.5 4.5V13H11V9H5v4H2.5V7.5z"/>',
    animal: '<path d="M4.5 4.8a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4zm7 0a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4zM3.2 8.3a1 1 0 110 2 1 1 0 010-2zm9.6 0a1 1 0 110 2 1 1 0 010-2zM8 8.8c-1.8 0-3.2 1-3.5 2.4-.4 1.8 1.2 3.3 3.5 3.3s3.9-1.5 3.5-3.3c-.3-1.4-1.7-2.4-3.5-2.4z"/>',
    farmacia: '<path d="M6 2h4v3h3v4h-3v3H6v-3H3V5h3V2z"/>',
    ubs: '<path d="M3 3h10v2H9v9H7V5H3V3zm8 4h2v2h-2V7zm0 3h2v2h-2v-2z"/>',
    esf: '<path d="M8 1.8a2.8 2.8 0 110 5.6 2.8 2.8 0 010-5.6zm-4.2 6.2h8.4v1.6H3.8v-1.6zm1.4 2.2h5.6v2.8H5.2v-2.8z"/>',
    caps: '<path d="M8 2.5a3.8 3.8 0 00-3.8 3.8c0 1.5.9 2.8 2.2 3.4L5.5 13h5l-.9-3.3A3.8 3.8 0 008 2.5zm0 1.8a2 2 0 110 4 2 2 0 010-4z"/>',
    saude: '<path d="M7 2h2v5h5v2H9v5H7V9H2V7h5V2z"/>',
    outros: '<path d="M3.5 3.5h9v9h-9v-9zm1.5 1.5v6h6v-6h-6zm1.2 1.2h3.6v1.2H6.2V6.2zm0 2h3.6v1.2H6.2V8.2z"/>',
    emergencia: '<path d="M2.5 9.5h2.2l1-3.2 2.1 6.4 1.8-4.6 1 2.4h3.9v1.8H12l-1.2-2.8-1.9 4.8-2.2-6.7-1.1 3.5H2.5V9.5z"/>',
    parque: '<path d="M8 2.5c-1.8 0-3 1.4-3 3.2 0 1.2.6 2.2 1.5 2.8L5.5 13h5l-1-4.5c.9-.6 1.5-1.6 1.5-2.8 0-1.8-1.2-3.2-3-3.2zm0 1.6c.8 0 1.3.6 1.3 1.6S8.8 7.3 8 7.3 6.7 6.7 6.7 5.7 7.2 4.1 8 4.1z"/>',
    orla: '<path d="M2 10.5c1.5-1.2 3-1 4.2-.2 1.4.9 2.8 1.1 4.3 0 1.2-.8 2.7-1 4.2.2v1.3c-1.5-1-3-.8-4.2 0-1.4.9-2.8 1.1-4.3 0-1.2-.8-2.7-1-4.2 0v-1.3zM2 7.8c1.5-1.2 3-1 4.2-.2 1.4.9 2.8 1.1 4.3 0 1.2-.8 2.7-1 4.2.2v1.3c-1.5-1-3-.8-4.2 0-1.4.9-2.8 1.1-4.3 0-1.2-.8-2.7-1-4.2 0V7.8z"/>',
    cultura: '<path d="M3 12V5.5h1.8V12H3zm2.7 0V4h1.8v8H5.7zm2.7 0V6h1.8v6H8.4zm2.7 0V3h1.8v9h-1.8zm2.7 0V7h1.8v5h-1.8z"/>',
    feira: '<path d="M3 4.5h10v1.5H3V4.5zm.8 2.5h8.4l-.8 5H4.6l-.8-5zm2.2 1.5v2h1.5v-2H6zm3 0v2h1.5v-2H9z"/>',
    roteiro: '<path d="M4 2.5h6l2 2.5v7.5H4V2.5zm1.5 2v7h7V6.2L11.2 4.5H5.5zm1 1.5h4v1h-4v-1zm0 2h4v1h-4v-1z"/>',
    evento: '<path d="M3 3.5h10v9H3v-9zm1.5 1.5v1.5h1.5V5H4.5zm3 0v1.5h1.5V5H7.5zm3 0v1.5H12V5h-1.5zM4.5 8v1.5H6V8H4.5zm3 0v1.5h1.5V8H7.5zm3 0v1.5H12V8h-1.5z"/>',
    lugar: '<path d="M8 1.5a4.2 4.2 0 00-4.2 4.2c0 3.1 4.2 7.8 4.2 7.8s4.2-4.7 4.2-7.8A4.2 4.2 0 008 1.5zm0 2.2a2 2 0 110 4 2 2 0 010-4z"/>',
    default: '<circle cx="8" cy="8" r="3"/>'
  };

  function cor(servico, categoria) {
    var kind = iconKind({ servico: servico, categoria: categoria });
    return SERVICO_CORES[kind] || SERVICO_CORES[servico] || SERVICO_CORES[categoria] || SERVICO_CORES.default;
  }

  function textoPonto(p) {
    var tags = (p.tags || []).join(' ').toLowerCase();
    var titulo = String(p.titulo || p.nome || '').toLowerCase();
    var cat = String(p.categoria || p.categoria_label || '').toLowerCase();
    return tags + ' ' + titulo + ' ' + cat;
  }

  function normCat(p) {
    return String(p.data_cat || p.categoria || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function iconKind(p) {
    if (!p) return 'default';
    if (p.servico && ICONS[p.servico]) return p.servico;
    var cat = normCat(p);
    if (cat === 'farmacia') return 'farmacia';
    if (cat === 'ubs') return 'ubs';
    if (cat === 'esf') return 'esf';
    if (cat === 'caps') return 'caps';
    if (cat === 'emergencia') return 'emergencia';
    if (cat === 'outros') return 'outros';
    if (ICONS[cat]) return cat;
    var texto = textoPonto(p);
    if (p.tipo === 'feira' || texto.indexOf('feira') >= 0 || texto.indexOf('brique') >= 0) return 'feira';
    if (p.tipo === 'evento' || texto.indexOf('evento') >= 0 || texto.indexOf('festival') >= 0) return 'evento';
    if (p.tipo === 'roteiro') return 'roteiro';
    if (texto.indexOf('parque') >= 0 || texto.indexOf('jardim bot') >= 0 || texto.indexOf('parcão') >= 0) return 'parque';
    if (texto.indexOf('orla') >= 0 || texto.indexOf('beira') >= 0 || texto.indexOf('balne') >= 0 || texto.indexOf('praia') >= 0 || texto.indexOf('píer') >= 0 || texto.indexOf('pier') >= 0 || texto.indexOf('pôr do sol') >= 0) return 'orla';
    if (texto.indexOf('cultura') >= 0 || texto.indexOf('usina') >= 0 || texto.indexOf('gasômetro') >= 0 || texto.indexOf('gasometro') >= 0 || texto.indexOf('museu') >= 0) return 'cultura';
    if (texto.indexOf('saúde') >= 0 || texto.indexOf('saude') >= 0 || texto.indexOf('hospital') >= 0 || texto.indexOf('ubs') >= 0) return 'ubs';
    if (p.tipo === 'lugar' || p.mapa) return 'lugar';
    return 'default';
  }

  function iconSvg(kind) {
    var path = ICONS[kind] || ICONS.default;
    return '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' + path + '</svg>';
  }

  function markerHtml(p, compact) {
    var kind = iconKind(p);
    var fill = cor(p.servico, p.categoria);
    if (!p.servico && !p.categoria && SERVICO_CORES[kind]) fill = SERVICO_CORES[kind];
    var regional = p.regional ? ' map-marker--regional' : '';
    var size = compact ? ' map-marker--compact' : '';
    return '<div class="map-marker' + regional + size + '" style="--marker-color:' + fill + '">' +
      '<span class="map-marker__bubble">' + iconSvg(kind) + '</span></div>';
  }

  function chaveCoords(p) {
    return (Math.round(p.lat * 10000) / 10000) + ',' + (Math.round(p.lon * 10000) / 10000);
  }

  function coordsComOffset(pontos) {
    var grupos = {};
    pontos.forEach(function(p, i){
      if (p.lat == null || p.lon == null) return;
      var k = chaveCoords(p);
      if (!grupos[k]) grupos[k] = [];
      grupos[k].push({ p: p, i: i });
    });
    var out = pontos.map(function(p){ return { p: p, lat: p.lat, lon: p.lon }; });
    Object.keys(grupos).forEach(function(k){
      var g = grupos[k];
      if (g.length <= 1) return;
      g.forEach(function(item, idx){
        var angle = (2 * Math.PI * idx) / g.length;
        var d = 0.00045;
        out[item.i].lat = item.p.lat + d * Math.cos(angle);
        out[item.i].lon = item.p.lon + d * Math.sin(angle);
      });
    });
    return out;
  }

  function addMarker(map, p, opts) {
    if (!window.L || p.lat == null || p.lon == null) return null;
    opts = opts || {};
    var lat = opts.lat != null ? opts.lat : p.lat;
    var lon = opts.lon != null ? opts.lon : p.lon;
    var icon = L.divIcon({
      className: 'map-marker-wrap',
      html: markerHtml(p),
      iconSize: [36, 42],
      iconAnchor: [18, 42],
      popupAnchor: [0, -36]
    });
    var marker = L.marker([lat, lon], { icon: icon }).addTo(map);
    if (opts.popup) marker.bindPopup(opts.popup);
    return marker;
  }

  return {
    cor: cor,
    iconKind: iconKind,
    markerHtml: function(p){ return markerHtml(p, true); },
    coordsComOffset: coordsComOffset,
    addMarker: addMarker,
    SERVICO_CORES: SERVICO_CORES
  };
})();

// Menu mobile + backdrop
(function(){
  const toggle = document.getElementById('navToggle');
  const menu = document.getElementById('mobileNav');
  const backdrop = document.getElementById('navBackdrop');
  if (!toggle || !menu) return;

  function setOpen(isOpen) {
    menu.classList.toggle('open', isOpen);
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    if (backdrop) {
      backdrop.hidden = !isOpen;
      backdrop.classList.toggle('open', isOpen);
    }
    document.body.style.overflow = isOpen ? 'hidden' : '';
  }

  toggle.addEventListener('click', function(){ setOpen(!menu.classList.contains('open')); });
  if (backdrop) backdrop.addEventListener('click', function(){ setOpen(false); });
  menu.querySelectorAll('a').forEach(function(link){
    link.addEventListener('click', function(){ setOpen(false); });
  });
})();

// Utilitário: remove skeleton
function clearSkeleton(el) {
  if (el) el.classList.remove('skeleton', 'skeleton-inline');
}

// Mapa de saúde + filtro por tipo (lista e mapa sincronizados)
(function(){
  var mapEl = document.getElementById('saudeMap');
  if (!mapEl) return;

  var gc = window.GuaipecasCidade;
  var noteEl = document.getElementById('saudeMapNota');
  var chipRow = document.getElementById('chipRow');
  var rows = document.querySelectorAll('#dataList .data-row');
  var emptyState = document.getElementById('emptyState');
  var map = null;
  var markerLayers = [];
  var markerByKey = {};
  var allUnidades = [];
  var activeCat = 'all';

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }

  function unitKey(u) {
    var m = (u.cnes_url || '').match(/VCo_Unidade=(\d+)/);
    return m ? m[1] : u.nome;
  }

  function markerPoint(u) {
    return {
      nome: u.nome,
      categoria: u.data_cat || u.categoria,
      data_cat: u.data_cat,
      categoria_label: u.categoria,
      lat: u.lat,
      lon: u.lon
    };
  }

  function filterUnidades(cat) {
    if (cat === 'all') return allUnidades.slice();
    return allUnidades.filter(function(u){ return u.data_cat === cat; });
  }

  function updateCidadeNota(cidade) {
    if (!noteEl) return;
    var cfg = gc.getConfig(cidade);
    if (cidade === 'guaiba') {
      noteEl.textContent = '';
      return;
    }
    noteEl.textContent = 'Catálogo municipal de Guaíba — o mapa mostra a rede guaibense na região. Você está vendo ' + cfg.name + ' no seletor; use os filtros para ir ao ícone no mapa.';
  }

  function scrollToMap() {
    mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function fitMapToMarkers(cidade, openFirst) {
    if (!map) return;
    var cfg = gc.getConfig(cidade);
    if (!markerLayers.length) {
      map.setView([cfg.lat, cfg.lon], cfg.zoom);
      return;
    }
    if (markerLayers.length === 1) {
      map.flyTo(markerLayers[0].getLatLng(), 15, { duration: 0.5 });
      if (openFirst) window.setTimeout(function(){ markerLayers[0].openPopup(); }, 380);
      return;
    }
    var bounds = L.featureGroup(markerLayers).getBounds();
    if (cidade !== 'guaiba') bounds.extend([cfg.lat, cfg.lon]);
    map.flyToBounds(bounds.pad(0.14), { duration: 0.55, maxZoom: 14 });
    if (openFirst) {
      window.setTimeout(function(){ markerLayers[0].openPopup(); }, 620);
    }
  }

  function renderMarkers(unidades, cidade) {
    if (!map || !window.L) return;
    var mh = window.guaipecasMapHelpers;
    markerLayers.forEach(function(layer){ map.removeLayer(layer); });
    markerLayers = [];
    markerByKey = {};
    var cfg = gc.getConfig(cidade);

    updateCidadeNota(cidade);

    mh.coordsComOffset(unidades).forEach(function(item){
      var u = item.p;
      var popup = '<strong>' + esc(u.nome) + '</strong><br>' + esc(u.categoria);
      if (u.cnes_url) popup += '<br><a href="' + esc(u.cnes_url) + '" target="_blank" rel="noopener">Ver ficha CNES ↗</a>';
      var marker = mh.addMarker(map, markerPoint(u), { lat: item.lat, lon: item.lon, popup: popup });
      if (marker) {
        markerLayers.push(marker);
        markerByKey[unitKey(u)] = marker;
      }
    });

    if (markerLayers.length > 1) {
      var bounds = L.featureGroup(markerLayers).getBounds();
      if (cidade !== 'guaiba') bounds.extend([cfg.lat, cfg.lon]);
      map.fitBounds(bounds.pad(0.12));
    } else if (markerLayers.length === 1) {
      map.setView(markerLayers[0].getLatLng(), 14);
    } else {
      map.setView([cfg.lat, cfg.lon], cfg.zoom);
    }
  }

  function setFilter(cat, cidade, opts) {
    opts = opts || {};
    activeCat = cat || activeCat;
    var cid = cidade || gc.get();
    var visible = filterUnidades(activeCat);

    rows.forEach(function(row){
      var match = activeCat === 'all' || row.getAttribute('data-cat') === activeCat;
      row.classList.toggle('hidden', !match);
    });
    if (emptyState) emptyState.style.display = visible.length === 0 ? 'block' : 'none';

    if (chipRow) {
      chipRow.querySelectorAll('.chip').forEach(function(chip){
        chip.classList.toggle('active', chip.getAttribute('data-cat') === activeCat);
      });
    }

    renderMarkers(visible, cid);

    if (opts.scrollMap) scrollToMap();
    if (opts.focusMap) {
      var delay = opts.scrollMap ? 300 : 0;
      window.setTimeout(function(){
        fitMapToMarkers(cid, opts.openFirst);
      }, delay);
    }
  }

  function focusOnMap(key, rowCat) {
    if (rowCat && rowCat !== activeCat) {
      setFilter(rowCat, gc.get(), { scrollMap: true, focusMap: false });
    }
    var marker = markerByKey[key];
    if (!marker || !map) return;
    scrollToMap();
    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 15), { duration: 0.55 });
    window.setTimeout(function(){ marker.openPopup(); }, 320);
  }

  function wireListMapLinks() {
    rows.forEach(function(row){
      var linkEl = row.querySelector('a.link');
      if (!linkEl || row.querySelector('.link--map')) return;
      var m = linkEl.href.match(/VCo_Unidade=(\d+)/);
      if (!m) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'link link--map';
      btn.textContent = 'Ver no mapa ↓';
      btn.addEventListener('click', function(e){
        e.preventDefault();
        focusOnMap(m[1], row.getAttribute('data-cat'));
      });
      linkEl.insertAdjacentElement('afterend', btn);
    });
  }

  function initMap(unidades) {
    if (!window.L) return;
    allUnidades = unidades || [];
    map = L.map('saudeMap').setView([-30.1137, -51.3266], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);

    if (chipRow) {
      chipRow.addEventListener('click', function(e){
        var chip = e.target.closest('.chip');
        if (!chip) return;
        var cat = chip.getAttribute('data-cat');
        setFilter(cat, gc.get(), {
          scrollMap: true,
          focusMap: true,
          openFirst: cat !== 'all'
        });
      });
    }

    wireListMapLinks();
    setFilter('all', gc.get());
    gc.onChange(function(cidade){ setFilter(activeCat, cidade); });
  }

  window.guaipecasLoadLeaflet(function(){
    function boot(unidades) { initMap(unidades || []); }
    fetch('unidades-map.json', { cache: 'no-store' })
      .then(function(r){ return r.json(); })
      .then(function(d){ boot(d.unidades); })
      .catch(function(){
        if (window.GUIUNIDADES_DATA) boot(window.GUIUNIDADES_DATA.unidades);
        else boot([]);
      });
  });
})();

// Ícones SVG do clima (substitui emojis)
var WEATHER_ICONS = {
  clear: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  partly: '<path d="M18 10a4 4 0 0 0-7-2"/><path d="M4 14a5 5 0 0 1 8.5-2.5"/><path d="M12 2v2"/>',
  cloudy: '<path d="M18 10a4.5 4.5 0 0 0-8-2.5A5 5 0 1 0 6 18h13a4 4 0 0 0 0-8z"/>',
  rain: '<path d="M16 13a4 4 0 0 0-8 0"/><path d="M8 17v2M12 17v3M16 17v2"/>',
  snow: '<path d="M12 2v20M4.93 4.93l14.14 14.14M19.07 4.93 4.93 19.07M2 12h20"/>',
  storm: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>'
};

function setWeatherIcon(wmo, targetId) {
  var iconEl = document.getElementById(targetId || 'wxIcon');
  if (!iconEl) return;
  var paths = WEATHER_ICONS.clear;
  if (wmo >= 0 && wmo <= 1) paths = WEATHER_ICONS.clear;
  else if (wmo === 2) paths = WEATHER_ICONS.partly;
  else if (wmo === 3) paths = WEATHER_ICONS.cloudy;
  else if (wmo >= 51 && wmo <= 67) paths = WEATHER_ICONS.rain;
  else if (wmo >= 71 && wmo <= 77) paths = WEATHER_ICONS.snow;
  else if (wmo >= 80 && wmo <= 99) paths = WEATHER_ICONS.storm;
  iconEl.innerHTML = paths;
}

function weatherSvg(wmo, cls) {
  var paths = WEATHER_ICONS.clear;
  if (wmo >= 0 && wmo <= 1) paths = WEATHER_ICONS.clear;
  else if (wmo === 2) paths = WEATHER_ICONS.partly;
  else if (wmo === 3) paths = WEATHER_ICONS.cloudy;
  else if (wmo >= 51 && wmo <= 67) paths = WEATHER_ICONS.rain;
  else if (wmo >= 71 && wmo <= 77) paths = WEATHER_ICONS.snow;
  else if (wmo >= 80 && wmo <= 99) paths = WEATHER_ICONS.storm;
  return '<svg class="' + (cls || 'wx-day-item__icon') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">' + paths + '</svg>';
}

function wmoLabel(code) {
  if (code <= 1) return 'céu claro';
  if (code === 2) return 'parcialmente nublado';
  if (code === 3) return 'nublado';
  if (code >= 51 && code <= 67) return 'chuva';
  if (code >= 71 && code <= 77) return 'neve';
  if (code >= 80) return 'tempestade';
  return 'variável';
}

function applyRiverStatus(card, level, cota, statusEl, feedStatus) {
  if (!statusEl || level == null) return;
  var dot = statusEl.querySelector('.status-dot');
  var txt = statusEl.querySelector('span:last-child');
  if (!dot || !txt) return;

  card.classList.remove('alert-watch', 'alert-danger');
  updateRiverAlert(null);

  var status = (feedStatus || '').toLowerCase();
  if (status === 'alagado') {
    dot.style.background = 'var(--status-danger)';
    txt.textContent = 'Alagado';
    card.classList.add('alert-danger');
    updateRiverAlert('danger', 'Rio acima da cota de inundação. Veja Agora e ligue 199 se precisar.');
    return;
  }
  if (status === 'alerta') {
    dot.style.background = 'var(--status-alert)';
    txt.textContent = 'Alerta';
    card.classList.add('alert-watch');
    updateRiverAlert('watch', 'Rio em alerta no Nível Guaíba — acompanhe a tendência e a previsão de chuva.');
    return;
  }
  if (status === 'normal') {
    dot.style.background = 'var(--status-normal)';
    txt.textContent = 'Normal';
    return;
  }

  if (level >= cota * 0.9) {
    dot.style.background = 'var(--status-danger)';
    txt.textContent = 'Atenção — próximo da cota';
    card.classList.add('alert-danger');
    updateRiverAlert('danger', 'Rio em nível de atenção — próximo da cota de inundação. Veja Agora.');
  } else if (level >= cota * 0.7) {
    dot.style.background = 'var(--status-alert)';
    txt.textContent = 'Subindo — vigiar';
    card.classList.add('alert-watch');
    updateRiverAlert('watch', 'Rio subindo — fique de olho no nível e na previsão de chuva.');
  } else {
    dot.style.background = 'var(--status-normal)';
    txt.textContent = 'Normal';
  }
}

var RIVER_ALERT_DISCLAIMER = ' Indicativo — não substitui avisos oficiais da Defesa Civil ou da prefeitura.';

function updateRiverAlert(level, message) {
  var banner = document.getElementById('riverAlert');
  var textEl = document.getElementById('riverAlertText');
  if (!banner || !textEl) return;
  if (!level) {
    banner.hidden = true;
    banner.classList.remove('river-alert--watch', 'river-alert--danger');
    return;
  }
  banner.hidden = false;
  banner.classList.toggle('river-alert--watch', level === 'watch');
  banner.classList.toggle('river-alert--danger', level === 'danger');
  textEl.textContent = message + RIVER_ALERT_DISCLAIMER;
}

// Atualização do nível dos rios via rivers.json
(function(){
  var guaibaCard = document.querySelector('[data-river="guaiba"]');
  var jacuiCard = document.querySelector('[data-river="jacui"]');
  if (!guaibaCard && !jacuiCard) return;

  function applyRiverPhoto(riverId, riverData) {
    var thumb = document.getElementById(riverId + 'Photo');
    if (!thumb || !riverData || !riverData.imagem) return;
    var img = thumb.querySelector('img');
    if (img) {
      img.src = riverData.imagem;
      img.alt = (riverData.nome || 'Rio') + ' — ' + (riverData.local || '');
    }
    if (riverData.fonte_url) thumb.href = riverData.fonte_url;
    thumb.hidden = false;
    thumb.title = 'Foto ao vivo: ' + (riverData.imagem_credito || riverData.fonte || 'Nível Guaíba') + ' — abrir fonte';
  }

  function riverUpdatedText(riverData, data) {
    var dt = new Date(riverData.data_hora_medicao || data.gerado_em);
    var text = 'Medição em ' + dt.toLocaleString('pt-BR') + ' · Nível Guaíba';
    var ageMin = (Date.now() - dt.getTime()) / 60000;
    if (ageMin > 30) text += ' · verifique na fonte';
    return text;
  }

  function updateRivers(data) {
    var rios = data.rios || {};
    var g = rios.guaiba;
    if (g && guaibaCard) {
      applyRiverPhoto('guaiba', g);
      var levelEl = document.getElementById('guaibaLevel');
      var statusEl = document.getElementById('guaibaStatus');
      var updatedEl = document.getElementById('guaibaUpdated');
      if (levelEl && g.nivel_m != null) {
        levelEl.textContent = g.nivel_m.toFixed(2).replace('.', ',') + ' m';
        clearSkeleton(levelEl);
      }
      if (updatedEl) {
        updatedEl.textContent = riverUpdatedText(g, data);
      }
      applyRiverStatus(guaibaCard, g.nivel_m, g.cota_inundacao || 3.0, statusEl, g.status);
    }

    var j = rios.jacui;
    if (j && jacuiCard) {
      applyRiverPhoto('jacui', j);
      var levelEl2 = document.getElementById('jacuiLevel');
      var statusEl2 = document.getElementById('jacuiStatus');
      var updatedEl2 = document.getElementById('jacuiUpdated');
      if (levelEl2 && j.nivel_m != null) {
        levelEl2.textContent = j.nivel_m.toFixed(2).replace('.', ',') + ' m';
        clearSkeleton(levelEl2);
      }
      if (updatedEl2) {
        updatedEl2.textContent = riverUpdatedText(j, data);
      }
      applyRiverStatus(jacuiCard, j.nivel_m, j.cota_inundacao || 7.5, statusEl2, j.status);
    }

    var updateEl = document.getElementById('nowUpdate');
    if (updateEl && window.GuaipecazSchedules) {
      var stamps = [];
      if (g && g.data_hora_medicao) stamps.push(new Date(g.data_hora_medicao).getTime());
      if (j && j.data_hora_medicao) stamps.push(new Date(j.data_hora_medicao).getTime());
      var latest = stamps.length
        ? new Date(Math.max.apply(null, stamps)).toISOString()
        : data.gerado_em;
      if (latest) window.GuaipecazSchedules.updateStamp(updateEl, latest, 'rivers');
    }
  }

  function fetchRivers() {
    function apply(data) {
      if (data && data.rios) updateRivers(data);
    }
    fetch('rivers.json', { cache: 'no-store' })
      .then(function(r){ if (!r.ok) throw new Error('sem rivers.json'); return r.json(); })
      .then(apply)
      .catch(function(){
        if (window.RIVERS_DATA) apply(window.RIVERS_DATA);
        else {
          ['guaibaLevel', 'jacuiLevel', 'nowUpdate'].forEach(function(id){
            clearSkeleton(document.getElementById(id));
          });
          var updateEl = document.getElementById('nowUpdate');
          if (updateEl) updateEl.textContent = 'dados estáticos';
        }
      });
  }

  fetchRivers();
  if (window.GuaipecazSchedules) {
    window.GuaipecazSchedules.alignPoll('rivers', fetchRivers);
  }
})();

// Previsão do tempo (Open-Meteo) — semana + seletor de cidade
(function(){
  var panel = document.getElementById('weatherPanel');
  if (!panel) return;

  var gc = window.GuaipecasCidade;
  var CITIES = gc.list;
  var cache = {};
  var citiesEl = document.getElementById('wxCities');
  var tempEl = document.getElementById('wxTemp');
  var descEl = document.getElementById('wxDesc');
  var compactEl = document.getElementById('wxCompact');
  var weekEl = document.getElementById('wxWeek');

  function dayLabel(isoDate, index) {
    if (index === 0) return 'Hoje';
    if (index === 1) return 'Amanhã';
    var dt = new Date(isoDate + 'T12:00:00');
    return dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  }

  function fetchCity(id) {
    var cfg = CITIES[id];
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + cfg.lat + '&longitude=' + cfg.lon +
      '&current=temperature_2m,weathercode' +
      '&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
      '&timezone=America%2FSao_Paulo&forecast_days=7';
    return fetch(url)
      .then(function(r){ return r.json(); })
      .then(function(data){
        cache[id] = data;
        return data;
      });
  }

  function renderWeek(daily) {
    if (!weekEl || !daily || !daily.time) return;
    weekEl.innerHTML = daily.time.map(function(iso, i){
      var wmo = daily.weathercode[i];
      var max = Math.round(daily.temperature_2m_max[i]);
      var min = Math.round(daily.temperature_2m_min[i]);
      var pop = Math.round(daily.precipitation_probability_max[i]);
      return (
        '<div class="wx-day-item">' +
          '<span class="wx-day-item__name">' + dayLabel(iso, i) + '</span>' +
          weatherSvg(wmo) +
          '<span class="wx-day-item__temps"><strong>' + max + '°</strong><span class="wx-day-item__min">' + min + '°</span></span>' +
          '<span class="wx-day-item__rain" title="Chance de chuva">' + pop + '%</span>' +
        '</div>'
      );
    }).join('');
  }

  function renderCity(id) {
    var data = cache[id];
    var cfg = CITIES[id];
    if (!data || !cfg) return;

    var cur = data.current;
    if (tempEl && cur) {
      tempEl.textContent = Math.round(cur.temperature_2m) + '°C';
      clearSkeleton(tempEl);
    }
    if (descEl && cur) {
      descEl.textContent = wmoLabel(cur.weathercode);
      clearSkeleton(descEl);
    }
    if (cur) setWeatherIcon(cur.weathercode);

    if (compactEl) {
      compactEl.textContent = 'Previsão da semana em ' + cfg.name;
    }

    renderWeek(data.daily);
  }

  function setActiveCity(id) {
    if (!CITIES[id]) return;
    gc.syncUi();
    renderCity(id);
  }

  if (citiesEl) {
    citiesEl.addEventListener('click', function(e){
      var btn = e.target.closest('[data-city]');
      if (!btn) return;
      gc.set(btn.getAttribute('data-city'));
    });
  }

  gc.onChange(function(id){ renderCity(id); });

  Promise.all(Object.keys(CITIES).map(fetchCity))
    .then(function(){ setActiveCity(gc.get()); })
    .catch(function(){
      if (tempEl) clearSkeleton(tempEl);
      if (descEl) clearSkeleton(descEl);
      if (compactEl) compactEl.textContent = 'Previsão indisponível';
      if (weekEl) weekEl.innerHTML = '<p class="weather-week__error">Não foi possível carregar a previsão.</p>';
    });
})();

// Scroll reveal
(function(){
  function observeReveal() {
    var els = document.querySelectorAll('.card, .now-card, .river-card, .weather-card, .banner-offer:not(.reveal), .manchete-lead:not(.reveal)');
    var observer = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting) entry.target.classList.add('visible');
      });
    }, { threshold: 0.08 });
    els.forEach(function(el){
      el.classList.add('reveal');
      observer.observe(el);
    });
  }
  observeReveal();
  window._observeReveal = observeReveal;
})();

// Painel de ofertas via JSON (banners)
(function(){
  var container = document.getElementById('offersGrid');
  if (!container) return;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function marketInitial(name) {
    return (name || '?').charAt(0).toUpperCase();
  }

  function renderBanner(m) {
    var banner = m.banner || m.promocao_imagem || ('assets/banners/' + m.id + '.png');
    var alt = 'Ofertas ' + m.nome;
    var cta = m.promocao_titulo || 'Ver encarte da semana';
    var credit = 'Arte Guaipecaz · encarte no site do mercado';
    return (
      '<a href="' + escapeHtml(m.url) + '" target="_blank" rel="noopener" class="banner-offer banner-offer--live" style="--market-color:' + escapeHtml(m.cor) + '">' +
        '<img src="' + escapeHtml(banner) + '" alt="' + escapeHtml(alt) + '" loading="lazy" decoding="async" referrerpolicy="no-referrer" width="480" height="270">' +
        '<div class="banner-offer__overlay">' +
          '<span class="banner-offer__badge" aria-hidden="true">' + escapeHtml(marketInitial(m.nome)) + '</span>' +
          '<div class="banner-offer__text">' +
            '<span class="banner-offer__name">' + escapeHtml(m.nome) + '</span>' +
            '<span class="banner-offer__cta">' + escapeHtml(cta) + '</span>' +
            '<span class="banner-offer__credit">' + escapeHtml(credit) + '</span>' +
          '</div>' +
          '<span class="banner-offer__arrow" aria-hidden="true">→</span>' +
        '</div>' +
      '</a>'
    );
  }

  function loadOffers(data) {
    if (!data.mercados || !data.mercados.length) return;
    container.innerHTML = data.mercados.map(renderBanner).join('');
    var updateEl = document.getElementById('offersUpdate');
    if (updateEl && data.gerado_em && window.GuaipecazSchedules) {
      window.GuaipecazSchedules.updateStamp(updateEl, data.gerado_em, 'offers');
    }
    if (window._observeReveal) window._observeReveal();
  }

  function fetchOffers() {
    fetch('ofertas.json', { cache: 'no-store' })
      .then(function(r){ if (!r.ok) throw new Error('sem ofertas.json'); return r.json(); })
      .then(loadOffers)
      .catch(function(){
        if (window.OFERTAS_DATA) loadOffers(window.OFERTAS_DATA);
        else {
          var updateEl = document.getElementById('offersUpdate');
          if (updateEl) {
            updateEl.textContent = 'encartes estáticos';
            clearSkeleton(updateEl);
          }
        }
      });
  }

  fetchOffers();
  if (window.GuaipecazSchedules) window.GuaipecazSchedules.alignPoll('offers', fetchOffers);
})();

// Guibanews — manchetes via JSON
(function(){
  var listEl = document.getElementById('newsList');
  var leadEl = document.getElementById('newsLead');
  if (!listEl || !leadEl) return;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(iso) {
    if (!iso) return '';
    var dt = new Date(iso);
    if (isNaN(dt.getTime())) return '';
    var now = new Date();
    var diffMs = now - dt;
    var diffH = Math.floor(diffMs / 3600000);
    if (diffH < 1) return 'agora há pouco';
    if (diffH < 24) return 'há ' + diffH + ' h';
    var diffD = Math.floor(diffH / 24);
    if (diffD === 1) return 'ontem';
    if (diffD < 7) return 'há ' + diffD + ' dias';
    return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }

  function setLead(item) {
    leadEl.href = guaipecasNoticiaUrl(item);
    leadEl.removeAttribute('target');
    leadEl.removeAttribute('rel');
    leadEl.hidden = false;
    leadEl.classList.remove('manchete-lead--skeleton', 'manchete-lead--has-image');

    var mediaEl = document.getElementById('newsLeadMedia');
    if (mediaEl) {
      mediaEl.innerHTML = '';
      mediaEl.hidden = true;
    }

    var sourceEl = document.getElementById('newsLeadSource');
    var dateEl = document.getElementById('newsLeadDate');
    var titleEl = document.getElementById('newsLeadTitle');

    if (sourceEl) {
      sourceEl.textContent = item.fonte || 'Fonte';
      clearSkeleton(sourceEl);
    }
    if (dateEl) {
      dateEl.textContent = formatDate(item.publicado_em);
      clearSkeleton(dateEl);
    }
    if (titleEl) {
      titleEl.textContent = item.titulo;
      clearSkeleton(titleEl);
    }
  }

  function renderItem(item) {
    return (
      '<li class="manchete-item">' +
        '<a href="' + escapeHtml(guaipecasNoticiaUrl(item)) + '" class="manchete-item__link">' +
          '<span class="manchete-item__source">' + escapeHtml(item.fonte || 'Fonte') + '</span>' +
          '<span class="manchete-item__title">' + escapeHtml(item.titulo) + '</span>' +
          '<span class="manchete-item__date">' + escapeHtml(formatDate(item.publicado_em)) + '</span>' +
        '</a>' +
      '</li>'
    );
  }

  function renderNews(data, cached) {
    if (!data.noticias || !data.noticias.length) return false;
    setLead(data.noticias[0]);
    listEl.innerHTML = data.noticias.slice(1).map(renderItem).join('');
    var updateEl = document.getElementById('newsUpdate');
    if (updateEl && data.gerado_em && window.GuaipecazSchedules) {
      window.GuaipecazSchedules.updateStamp(updateEl, data.gerado_em, 'news', { cached: cached });
    }
    if (window._observeReveal) window._observeReveal();
    return true;
  }

  function fetchNews() {
    fetch('noticias.json', { cache: 'no-store' })
      .then(function(r){ if (!r.ok) throw new Error('sem noticias.json'); return r.json(); })
      .then(function(data){
        var items = data.noticias_home || data.noticias;
        if (!renderNews({ noticias: items, gerado_em: data.gerado_em }, false)) throw new Error('noticias vazias');
      })
      .catch(function(){
        if (window.GUIBANEWS_DATA) {
          var cached = {
            noticias: window.GUIBANEWS_DATA.noticias_home || window.GUIBANEWS_DATA.noticias,
            gerado_em: window.GUIBANEWS_DATA.gerado_em
          };
          if (renderNews(cached, true)) return;
        }
        leadEl.hidden = true;
        listEl.innerHTML = '<li class="manchete-item"><span class="manchete-item__title">Notícias indisponíveis. Abra o site com um servidor local (<code>python3 -m http.server</code>) ou recarregue a página.</span></li>';
        var updateEl = document.getElementById('newsUpdate');
        if (updateEl) {
          updateEl.textContent = 'indisponível';
          clearSkeleton(updateEl);
        }
      });
  }

  fetchNews();
  if (window.GuaipecazSchedules) window.GuaipecazSchedules.alignPoll('news', fetchNews);
})();

// PWA + compartilhamento
(function(){
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function(){
      navigator.serviceWorker.register('sw.js').catch(function(){});
    });
  }

  var deferredPrompt = null;
  var pwaBar = document.getElementById('pwaInstall');
  var pwaBtn = document.getElementById('pwaInstallBtn');
  var pwaClose = document.getElementById('pwaInstallClose');

  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault();
    deferredPrompt = e;
    if (pwaBar) pwaBar.hidden = false;
  });

  if (pwaBtn) {
    pwaBtn.addEventListener('click', function(){
      if (!deferredPrompt) return;
      if (window.guaipecasTrack) window.guaipecasTrack('pwa_install_prompt', { page: document.title });
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choice){
        if (choice.outcome === 'accepted' && window.guaipecasTrack) {
          window.guaipecasTrack('pwa_install', { page: document.title });
        }
      }).finally(function(){ deferredPrompt = null; if (pwaBar) pwaBar.hidden = true; });
    });
  }
  if (pwaClose && pwaBar) {
    pwaClose.addEventListener('click', function(){ pwaBar.hidden = true; });
  }

  function shareText() {
    return 'Guaipecaz — notícias, rios, lazer e serviços da região: ' + window.location.href;
  }

  var waBtn = document.getElementById('shareWhatsapp');
  if (waBtn) {
    waBtn.addEventListener('click', function(){
      if (window.guaipecasTrack) window.guaipecasTrack('share', { method: 'whatsapp', page: document.title });
      window.open('https://wa.me/?text=' + encodeURIComponent(shareText()), '_blank', 'noopener');
    });
  }
  var nativeBtn = document.getElementById('shareNative');
  if (nativeBtn) {
    nativeBtn.addEventListener('click', function(){
      if (window.guaipecasTrack) window.guaipecasTrack('share', { method: 'native', page: document.title });
      if (navigator.share) {
        navigator.share({ title: 'Guaipecaz', text: shareText(), url: window.location.href }).catch(function(){});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(shareText());
        nativeBtn.textContent = 'Link copiado';
      }
    });
  }
  var shareNews = document.getElementById('shareGuibanews');
  if (shareNews) {
    shareNews.addEventListener('click', function(){
      if (window.guaipecasTrack) window.guaipecasTrack('share', { method: 'guibanews', page: 'Guibanews' });
      var url = window.location.href;
      if (navigator.share) navigator.share({ title: 'Guibanews', url: url });
      else window.open('https://wa.me/?text=' + encodeURIComponent('Guibanews — Guaíba: ' + url), '_blank');
    });
  }
})();

// Guibanews página completa
(function(){
  var list = document.getElementById('newsFullList');
  if (!list) return;

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  }

  function load(data) {
    var items = data.noticias || [];
    if (!items.length) return;
    list.innerHTML = items.map(function(item){
      return (
        '<li class="manchete-item">' +
          '<a href="' + esc(guaipecasNoticiaUrl(item)) + '" class="manchete-item__link">' +
            '<span class="manchete-item__source">' + esc(item.fonte || 'Fonte') + '</span>' +
            '<span class="manchete-item__title">' + esc(item.titulo) + '</span>' +
            '<span class="manchete-item__date">' + esc(item.publicado_em ? new Date(item.publicado_em).toLocaleDateString('pt-BR') : '') + '</span>' +
          '</a></li>'
      );
    }).join('');
  }

  function fetchNewsPage() {
    fetch('noticias.json', { cache: 'no-store' })
      .then(function(r){ return r.json(); })
      .then(load)
      .catch(function(){ if (window.GUIBANEWS_DATA) load(window.GUIBANEWS_DATA); });
  }

  fetchNewsPage();
  if (window.GuaipecazSchedules) window.GuaipecazSchedules.alignPoll('news', fetchNewsPage);
})();

// Editais
(function(){
  var lists = [document.getElementById('editaisList'), document.getElementById('editaisPageList')].filter(Boolean);
  if (!lists.length) return;

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }

  function renderItem(item) {
    return (
      '<li class="manchete-item"><a href="' + esc(item.url) + '" target="_blank" rel="noopener" class="manchete-item__link">' +
        '<span class="manchete-item__source">' + esc(item.tipo || 'edital') + '</span>' +
        '<span class="manchete-item__title">' + esc(item.titulo) + '</span>' +
        '<span class="manchete-item__date">' + esc(item.fonte || '') + '</span>' +
      '</a></li>'
    );
  }

  function paint(data) {
    var html = (data.editais || []).slice(0, 5).map(renderItem).join('');
    lists.forEach(function(el){
      el.innerHTML = html || '<li class="manchete-item"><span class="manchete-item__title">Nenhum edital recente.</span></li>';
    });
    var updateEl = document.getElementById('editaisUpdate');
    if (updateEl && data.gerado_em && window.GuaipecazSchedules) {
      window.GuaipecazSchedules.updateStamp(updateEl, data.gerado_em, 'editais');
    }
  }

  function fetchEditais() {
    fetch('editais.json', { cache: 'no-store' })
      .then(function(r){ return r.json(); })
      .then(paint)
      .catch(function(){ if (window.GUIEDITAIS_DATA) paint(window.GUIEDITAIS_DATA); });
  }

  fetchEditais();
  if (window.GuaipecazSchedules) window.GuaipecazSchedules.alignPoll('editais', fetchEditais);
})();

// Serviços + agenda + vagas
(function(){
  var grid = document.getElementById('servicosGrid');
  var agendaList = document.getElementById('agendaList');
  var agendaHome = document.getElementById('agendaHomeList');
  var vagasList = document.getElementById('vagasList');
  if (!grid && !agendaList && !agendaHome && !vagasList) return;

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }

  function card(data) {
    return (
      '<a class="card servico-card" href="' + esc(data.url) + '" target="_blank" rel="noopener">' +
        '<h3>' + esc(data.titulo) + '</h3><p>' + esc(data.descricao) + '</p></a>'
    );
  }

  function renderAgendaItem(item) {
    return (
      '<li class="manchete-item"><a href="' + esc(item.url) + '" target="_blank" rel="noopener" class="manchete-item__link">' +
        '<span class="manchete-item__source">' + esc(item.fonte || 'Prefeitura') + '</span>' +
        '<span class="manchete-item__title">' + esc(item.titulo) + '</span></a></li>'
    );
  }

  function apply(data) {
    if (grid) {
      grid.innerHTML = card(data.farmacia_plantao) + card(data.onibus) + card(data.coleta);
      grid.classList.add('card-grid', 'card-grid--3');
    }
    var agenda = data.agenda || [];
    if (agendaList) agendaList.innerHTML = agenda.map(renderAgendaItem).join('') || '<li class="manchete-item"><span class="manchete-item__title">Sem eventos indexados.</span></li>';
    if (agendaHome) agendaHome.innerHTML = agenda.slice(0, 4).map(renderAgendaItem).join('') || '<li class="manchete-item"><span class="manchete-item__title">Veja em Serviços.</span></li>';
    var updateEl = document.getElementById('servicosUpdate');
    if (updateEl && data.gerado_em && window.GuaipecazSchedules) {
      window.GuaipecazSchedules.updateStamp(updateEl, data.gerado_em, 'servicos');
    }
  }

  function applyVagas(editais) {
    if (!vagasList) return;
    var vagas = (editais.editais || []).filter(function(e){ return e.tipo === 'vaga' || e.tipo === 'concurso'; }).slice(0, 6);
    vagasList.innerHTML = vagas.map(function(item){
      return '<li class="manchete-item"><a href="' + esc(item.url) + '" target="_blank" rel="noopener" class="manchete-item__link">' +
        '<span class="manchete-item__source">' + esc(item.tipo) + '</span>' +
        '<span class="manchete-item__title">' + esc(item.titulo) + '</span></a></li>';
    }).join('') || '<li class="manchete-item"><span class="manchete-item__title">Nenhuma vaga indexada.</span></li>';
  }

  function fetchServicos() {
    fetch('servicos.json', { cache: 'no-store' })
      .then(function(r){ return r.json(); })
      .then(apply)
      .catch(function(){ if (window.GUISERVICOS_DATA) apply(window.GUISERVICOS_DATA); });
  }

  fetchServicos();
  if (window.GuaipecazSchedules) window.GuaipecazSchedules.alignPoll('servicos', fetchServicos);

  if (vagasList) {
    fetch('editais.json', { cache: 'no-store' })
      .then(function(r){ return r.json(); })
      .then(applyVagas)
      .catch(function(){ if (window.GUIEDITAIS_DATA) applyVagas(window.GUIEDITAIS_DATA); });
  }
})();


// Mapa e lista de apoio — páginas dedicadas (mulher / pet)
(function(){
  var pageKey = document.body.getAttribute('data-apoio-page');
  var listEl = document.getElementById('apoioList');
  if (!pageKey || !listEl) return;

  var gc = window.GuaipecasCidade;
  var mapEl = document.getElementById('apoioMap');
  var chipRow = document.getElementById('apoioChips');
  var notaEl = document.getElementById('apoioNota');
  var ledeEl = document.getElementById('apoioLede');
  var passosEl = document.getElementById('apoioPassos');
  var sugestoesEl = document.getElementById('apoioSugestoes');
  var cidadeNotaEl = document.getElementById('apoioCidadeNota');
  var data = null;
  var pageData = null;
  var mapInstance = null;
  var markerLayers = [];
  var allPontos = [];
  var activeCat = 'all';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  }

  function renderLinks(p) {
    var links = [];
    if (p.tel) {
      links.push('<a class="link" href="tel:' + esc(p.tel) + '">' + esc(p.telefone || p.tel) + ' ↗</a>');
    }
    if (p.whatsapp) {
      links.push('<a class="link" href="https://wa.me/' + esc(p.whatsapp) + '" target="_blank" rel="noopener">WhatsApp ↗</a>');
    }
    if (p.url) {
      links.push('<a class="link" href="' + esc(p.url) + '" target="_blank" rel="noopener">' + esc(p.link_label || 'Acessar') + ' ↗</a>');
    }
    if (p.email) {
      links.push('<a class="link" href="mailto:' + esc(p.email) + '">E-mail ↗</a>');
    }
    return links.length ? '<span class="data-row__links">' + links.join('') + '</span>' : '';
  }

  function renderRow(p) {
    var meta = [];
    if (p.endereco) meta.push(esc(p.endereco));
    if (p.horario) meta.push(esc(p.horario));
    if (p.descricao) meta.push(esc(p.descricao));
    return '<li class="data-row" data-cat="' + esc(p.categoria) + '" id="ponto-' + esc(p.id) + '">' +
      '<span class="name">' + esc(p.nome) + '</span>' +
      (p.urgencia ? '<span class="cat">Urgência</span>' : '') +
      '<span class="cat">' + esc(p.categoria_label) + '</span>' +
      (meta.length ? '<span class="data-row__meta">' + meta.join(' · ') + '</span>' : '') +
      (p.nota ? '<span class="data-row__note">' + esc(p.nota) + '</span>' : '') +
      renderLinks(p) +
      '</li>';
  }

  function renderList(pontos, cidade) {
    if (!pontos.length) {
      var cfg = gc.getConfig(cidade);
      var msg = cidade === 'guaiba'
        ? 'Nenhum contato neste filtro.'
        : 'Nenhum ponto presencial cadastrado em ' + cfg.name + ' — veja Guaíba ou Contatos de emergência.';
      listEl.innerHTML = '<li class="data-row"><span class="name">' + esc(msg) + '</span></li>';
      return;
    }
    listEl.innerHTML = pontos.map(renderRow).join('');
  }

  function updateMap(pontos, cidade) {
    if (!mapInstance || !window.L) return;
    var mh = window.guaipecasMapHelpers;
    markerLayers.forEach(function(layer){ mapInstance.removeLayer(layer); });
    markerLayers = [];
    var cfg = gc.getConfig(cidade);
    mapInstance.setView([cfg.lat, cfg.lon], cfg.zoom);
    var mappable = pontos.filter(function(p){ return p.mapa && p.lat != null && p.lon != null; });
    mh.coordsComOffset(mappable).forEach(function(item){
      var p = item.p;
      var popup = '<strong>' + esc(p.nome) + '</strong>';
      if (p.endereco) popup += '<br>' + esc(p.endereco);
      if (p.telefone) popup += '<br>' + esc(p.telefone);
      if (p.descricao) popup += '<br><em>' + esc(p.descricao) + '</em>';
      markerLayers.push(mh.addMarker(mapInstance, p, { lat: item.lat, lon: item.lon, popup: popup }));
    });
  }

  function pontosDaCidade(cidade) {
    return allPontos.filter(function(p){
      return p.cidade === 'todas' || !p.cidade || p.cidade === cidade;
    });
  }

  function filterPontos(cat, cidade) {
    var base = pontosDaCidade(cidade);
    if (cat === 'all') return base.slice();
    return base.filter(function(p){ return p.categoria === cat; });
  }

  function updateCidadeNota(cidade) {
    if (!cidadeNotaEl) return;
    var cfg = gc.getConfig(cidade);
    if (cidade === 'guaiba') {
      cidadeNotaEl.textContent = 'Rede de apoio presencial em Guaíba. Canais nacionais (180, 181, Delegacia Online) aparecem em qualquer cidade.';
      return;
    }
    cidadeNotaEl.textContent = 'Pontos presenciais cadastrados em Guaíba. Em ' + cfg.name + ', use os contatos de emergência; canais nacionais continuam na lista.';
  }

  function setFilter(cat, cidade) {
    activeCat = cat || activeCat;
    var cid = cidade || gc.get();
    var pontos = filterPontos(activeCat, cid);
    updateCidadeNota(cid);
    renderList(pontos, cid);
    updateMap(pontos, cid);
  }

  function activateChip(cat) {
    if (!chipRow) return;
    chipRow.querySelectorAll('.chip').forEach(function(chip){
      chip.classList.toggle('active', chip.dataset.cat === cat);
    });
    setFilter(cat);
  }

  function initApoio(payload) {
    data = payload;
    pageData = (data.paginas && data.paginas[pageKey]) || {};
    var filtros = pageData.filtros || [];
    allPontos = (data.pontos || []).filter(function(p){
      return filtros.indexOf(p.categoria) !== -1;
    });

    if (ledeEl && pageData.lede) ledeEl.textContent = pageData.lede;
    if (notaEl && pageData.nota) {
      notaEl.innerHTML = '<strong>Em Guaíba:</strong> ' + esc(pageData.nota);
    }
    renderPassos(pageData.passos);
    renderSugestoes(pageData.sugestoes);

    if (chipRow) {
      chipRow.querySelectorAll('.chip').forEach(function(chip){
        chip.addEventListener('click', function(){ activateChip(chip.dataset.cat); });
      });
    }
    activateChip('all');
    gc.onChange(function(cidade){ setFilter(activeCat, cidade); });
  }

  function initMap() {
    if (!mapEl || !window.L) return;
    var cfg = gc.getConfig();
    mapInstance = L.map('apoioMap').setView([cfg.lat, cfg.lon], cfg.zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(mapInstance);
    updateMap(filterPontos(activeCat, gc.get()), gc.get());
  }

  function applyData(payload) {
    initApoio(payload);
    if (mapEl) window.guaipecasLoadLeaflet(initMap);
  }

  function renderPassos(passos) {
    if (!passosEl || !passos) return;
    passosEl.innerHTML = passos.map(function(p){
      var cls = 'apoio-step' + (p.urgente ? ' apoio-step--urgent' : '');
      var link = p.link ? ' <a href="' + esc(p.link) + '" target="_blank" rel="noopener">' + esc(p.link_label || 'Acessar') + ' ↗</a>' : '';
      return '<li class="' + cls + '"><strong>' + esc(p.titulo) + '</strong><p>' + esc(p.texto) + link + '</p></li>';
    }).join('');
  }

  function renderSugestoes(itens) {
    if (!sugestoesEl || !itens) return;
    sugestoesEl.innerHTML = itens.map(function(s){ return '<li>' + esc(s) + '</li>'; }).join('');
  }

  fetch('apoio.json', { cache: 'no-store' })
    .then(function(r){ return r.json(); })
    .then(applyData)
    .catch(function(){
      if (window.GUIAPOIO_DATA) applyData(window.GUIAPOIO_DATA);
      else listEl.innerHTML = '<li class="data-row"><span class="name">Conteúdo indisponível no momento.</span></li>';
    });
})();

// Contatos de emergência — mapa e listas por cidade
(function(){
  if (!document.body.getAttribute('data-emergencia-page')) return;

  var gc = window.GuaipecasCidade;
  var ledeEl = document.getElementById('emergenciaLede');
  var mapEl = document.getElementById('emergenciaMap');
  var cidadeNotaEl = document.getElementById('emergenciaCidadeNota');
  var data = null;
  var mapInstance = null;
  var markerLayers = [];
  var SERVICOS = ['samu', 'bombeiros', 'policia', 'defesa-civil', 'disque-180'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  }

  function renderLinks(p) {
    var links = [];
    if (p.tel) {
      links.push('<a class="link" href="tel:' + esc(p.tel) + '">' + esc(p.telefone || p.tel) + ' ↗</a>');
    }
    if (p.url) {
      var href = esc(p.url);
      var external = p.url.indexOf('http') === 0;
      links.push('<a class="link" href="' + href + '"' + (external ? ' target="_blank" rel="noopener"' : '') + '>' + esc(p.link_label || 'Acessar') + ' ↗</a>');
    }
    return links.length ? '<span class="data-row__links">' + links.join('') + '</span>' : '';
  }

  function renderRow(p) {
    var meta = [];
    if (p.endereco) meta.push(esc(p.endereco));
    if (p.horario) meta.push(esc(p.horario));
    return '<li class="data-row" id="ponto-' + esc(p.id) + '">' +
      '<span class="name">' + esc(p.nome) + '</span>' +
      (meta.length ? '<span class="data-row__meta">' + meta.join(' · ') + '</span>' : '') +
      (p.nota ? '<span class="data-row__note">' + esc(p.nota) + '</span>' : '') +
      renderLinks(p) +
      '</li>';
  }

  function pontosDaCidade(cidade) {
    return (data.pontos || []).filter(function(p){ return p.cidade === cidade; });
  }

  function renderServicos(cidade) {
    var cfg = gc.getConfig(cidade);
    if (cidadeNotaEl) {
      cidadeNotaEl.textContent = 'Exibindo pontos de referência em ' + cfg.name + '. A cidade selecionada vale para todos os mapas do site.';
    }
    SERVICOS.forEach(function(key){
      var svc = (data.servicos && data.servicos[key]) || {};
      var descEl = document.getElementById('emergenciaDesc-' + key);
      var listEl = document.getElementById('emergenciaList-' + key);
      if (descEl) descEl.textContent = svc.descricao || '';
      if (!listEl) return;
      var pontos = pontosDaCidade(cidade).filter(function(p){ return p.servico === key; });
      listEl.innerHTML = pontos.length
        ? pontos.map(renderRow).join('')
        : '<li class="data-row"><span class="name">Sem ponto cadastrado em ' + esc(cfg.name) + '.</span></li>';
    });
  }

  function updateMap(cidade) {
    if (!mapInstance || !window.L) return;
    var mh = window.guaipecasMapHelpers;
    markerLayers.forEach(function(layer){ mapInstance.removeLayer(layer); });
    markerLayers = [];
    var cfg = gc.getConfig(cidade);
    mapInstance.setView([cfg.lat, cfg.lon], cfg.zoom);
    var mappable = pontosDaCidade(cidade).filter(function(p){
      return p.mapa && p.lat != null && p.lon != null;
    });
    mh.coordsComOffset(mappable).forEach(function(item){
      var p = item.p;
      var popup = '<strong>' + esc(p.nome) + '</strong>';
      if (p.regional) popup += '<br><em>Unidade regional (fora do município selecionado)</em>';
      if (p.endereco) popup += '<br>' + esc(p.endereco);
      if (p.telefone) popup += '<br>' + esc(p.telefone);
      if (p.nota) popup += '<br><em>' + esc(p.nota) + '</em>';
      markerLayers.push(mh.addMarker(mapInstance, p, { lat: item.lat, lon: item.lon, popup: popup }));
    });
    renderLegenda();
  }

  function renderLegenda() {
    var legEl = document.getElementById('emergenciaLegenda');
    if (!legEl || !data || !data.servicos) return;
    var mh = window.guaipecasMapHelpers;
    legEl.innerHTML = SERVICOS.map(function(key){
      var svc = data.servicos[key] || {};
      var cor = mh.cor(key);
      return '<span class="map-legenda__item"><span class="map-legenda__pin" style="--marker-color:' + cor + '">' +
        mh.markerHtml({ servico: key }) + '</span>' + esc(svc.nome || key) + '</span>';
    }).join('') + '<span class="map-legenda__item map-legenda__item--regional"><span class="map-legenda__pin map-legenda__pin--regional">' +
      mh.markerHtml({ servico: 'policia', regional: true }) + '</span>Regional</span>';
  }

  function applyCidade(cidade) {
    renderServicos(cidade);
    updateMap(cidade);
  }

  function scrollToHash() {
    var hash = window.location.hash.replace('#', '');
    if (!hash || SERVICOS.indexOf(hash) === -1) return;
    window.setTimeout(function(){
      var el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 350);
  }

  function initEmergencia(payload) {
    data = payload;
    if (ledeEl && data.lede) ledeEl.textContent = data.lede;
    SERVICOS.forEach(function(key){
      var svc = (data.servicos && data.servicos[key]) || {};
      var titleEl = document.querySelector('#' + key + ' .emergencia-servico__title');
      if (titleEl && svc.titulo) titleEl.textContent = svc.titulo;
    });
    applyCidade(gc.get());
    gc.onChange(applyCidade);
    window.addEventListener('hashchange', scrollToHash);
  }

  function initMap() {
    if (!mapEl || !window.L) return;
    var cfg = gc.getConfig();
    mapInstance = L.map('emergenciaMap').setView([cfg.lat, cfg.lon], cfg.zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(mapInstance);
    updateMap(gc.get());
    scrollToHash();
    window.setTimeout(function(){ mapInstance.invalidateSize(); scrollToHash(); }, 200);
  }

  function applyData(payload) {
    initEmergencia(payload);
    if (mapEl) window.guaipecasLoadLeaflet(initMap);
  }

  var emergenciaLoaded = false;
  function bootEmergencia(payload) {
    if (emergenciaLoaded || !payload) return;
    emergenciaLoaded = true;
    applyData(payload);
  }

  if (window.GUIEMERGENCIA_DATA) bootEmergencia(window.GUIEMERGENCIA_DATA);

  fetch('emergencia.json', { cache: 'no-store' })
    .then(function(r){
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(bootEmergencia)
    .catch(function(err){
      if (window.GUIEMERGENCIA_DATA) bootEmergencia(window.GUIEMERGENCIA_DATA);
      else {
        if (ledeEl) ledeEl.textContent = 'Conteúdo indisponível no momento.';
        SERVICOS.forEach(function(key){
          var listEl = document.getElementById('emergenciaList-' + key);
          if (listEl) listEl.innerHTML = '<li class="data-row"><span class="name">Não foi possível carregar os contatos.</span></li>';
        });
        if (typeof console !== 'undefined' && console.error) console.error('emergencia', err);
      }
    });
})();

// Página interna da notícia
(function(){
  var articleRoot = document.getElementById('noticiaArticle');
  if (!articleRoot) return;

  var params = new URLSearchParams(window.location.search);
  var articleId = params.get('id');

  var loadingEl = document.getElementById('noticiaLoading');
  var contentEl = document.getElementById('noticiaContent');
  var errorEl = document.getElementById('noticiaError');
  var relatedSection = document.getElementById('noticiaRelated');
  var relatedList = document.getElementById('noticiaRelatedList');

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function formatDate(iso) {
    if (!iso) return '';
    var dt = new Date(iso);
    if (isNaN(dt.getTime())) return '';
    return dt.toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function setMeta(name, value) {
    if (!value) return;
    var el = document.querySelector('meta[name="' + name + '"]');
    if (el) el.setAttribute('content', value);
  }

  function setOg(prop, value) {
    if (!value) return;
    var el = document.querySelector('meta[property="' + prop + '"]');
    if (el) el.setAttribute('content', value);
  }

  function renderRelated(items, currentId) {
    if (!relatedList || !relatedSection) return;
    var others = items.filter(function(it){ return it.id !== currentId; }).slice(0, 5);
    if (!others.length) return;
    relatedList.innerHTML = others.map(function(item){
      return (
        '<li class="manchete-item">' +
          '<a href="' + esc(guaipecasNoticiaUrl(item)) + '" class="manchete-item__link">' +
            '<span class="manchete-item__source">' + esc(item.fonte || 'Fonte') + '</span>' +
            '<span class="manchete-item__title">' + esc(item.titulo) + '</span>' +
            '<span class="manchete-item__date">' + esc(formatDate(item.publicado_em)) + '</span>' +
          '</a></li>'
      );
    }).join('');
    relatedSection.hidden = false;
    if (window._observeReveal) window._observeReveal();
  }

  function showError() {
    if (loadingEl) loadingEl.hidden = true;
    if (contentEl) contentEl.hidden = true;
    if (errorEl) errorEl.hidden = false;
    document.title = 'Notícia não encontrada — Guibanews · Guaipecaz';
  }

  function renderArticle(item, allItems) {
    if (loadingEl) loadingEl.hidden = true;
    if (errorEl) errorEl.hidden = true;
    if (contentEl) contentEl.hidden = false;

    var lead = item.resumo || '';

    document.title = item.titulo + ' — Guibanews · Guaipecaz';
    var descSource = lead || item.titulo;
    setMeta('description', descSource.slice(0, 160));
    setOg('og:title', item.titulo);
    setOg('og:description', descSource.slice(0, 200));

    var breadcrumb = document.getElementById('noticiaBreadcrumb');
    if (breadcrumb) {
      var shortTitle = item.titulo.length > 48 ? item.titulo.slice(0, 48) + '…' : item.titulo;
      breadcrumb.innerHTML = '<a href="index.html">Início</a> / <a href="guibanews.html">Guibanews</a> / <span>' + esc(shortTitle) + '</span>';
    }

    var hero = document.getElementById('noticiaHero');
    if (hero) hero.hidden = true;

    var sourceEl = document.getElementById('noticiaSource');
    var dateEl = document.getElementById('noticiaDate');
    var titleEl = document.getElementById('noticiaTitle');
    var resumoEl = document.getElementById('noticiaResumo');
    var bodyEl = document.getElementById('noticiaBody');
    var sourceLink = document.getElementById('noticiaSourceLink');
    var disclaimerSource = document.getElementById('noticiaDisclaimerSource');

    if (sourceEl) sourceEl.textContent = item.fonte || 'Fonte';
    if (dateEl) dateEl.textContent = formatDate(item.publicado_em);
    if (titleEl) titleEl.textContent = item.titulo;

    if (bodyEl) {
      bodyEl.innerHTML = '';
      bodyEl.hidden = true;
    }

    if (resumoEl) {
      if (lead) {
        resumoEl.textContent = lead;
        resumoEl.hidden = false;
        resumoEl.classList.remove('noticia-article__resumo--empty');
      } else {
        resumoEl.textContent = 'Resumo indisponível no feed. Abra a matéria na fonte original para ler o texto completo.';
        resumoEl.hidden = false;
        resumoEl.classList.add('noticia-article__resumo--empty');
      }
    }

    if (sourceLink) {
      sourceLink.href = item.url;
      sourceLink.textContent = 'Ler matéria completa em ' + (item.fonte || 'fonte') + ' ↗';
    }
    if (disclaimerSource) disclaimerSource.textContent = item.fonte || 'fonte original';

    renderRelated(allItems, item.id);

    var shareBtn = document.getElementById('noticiaShare');
    if (shareBtn) {
      shareBtn.addEventListener('click', function(){
        var shareUrl = window.location.href;
        var shareTitle = item.titulo + ' — Guibanews';
        if (window.guaipecasTrack) window.guaipecasTrack('share', { method: 'noticia', page: shareTitle });
        if (navigator.share) {
          navigator.share({ title: shareTitle, text: item.titulo, url: shareUrl }).catch(function(){});
        } else {
          window.open('https://wa.me/?text=' + encodeURIComponent(shareTitle + ': ' + shareUrl), '_blank', 'noopener');
        }
      });
    }
  }

  function load(data) {
    if (!articleId) {
      showError();
      return;
    }
    var items = data.noticias || [];
    var item = items.find(function(it){ return it.id === articleId; });
    if (!item) {
      showError();
      return;
    }
    renderArticle(item, items);
  }

  if (!articleId) {
    showError();
    return;
  }

  fetch('noticias.json', { cache: 'no-store' })
    .then(function(r){ if (!r.ok) throw new Error('sem noticias.json'); return r.json(); })
    .then(load)
    .catch(function(){
      if (window.GUIBANEWS_DATA) load(window.GUIBANEWS_DATA);
      else showError();
    });
})();

// Explorar — pontos turísticos
(function(){
  if (document.body.getAttribute('data-page') !== 'explorar') return;

  var gc = window.GuaipecasCidade;
  var helpers = window.guaipecasMapHelpers;
  var data = null;
  var mapInstance = null;
  var markers = [];

  var ledeEl = document.getElementById('explorarLede');
  var cidadeNotaEl = document.getElementById('explorarCidadeNota');
  var perfilImg = document.getElementById('explorarPerfilImg');
  var perfilZoom = document.getElementById('explorarPerfilZoom');
  var perfilSection = document.getElementById('explorarPerfil');
  var perfilTagline = document.getElementById('explorarPerfilTagline');
  var perfilText = document.getElementById('explorarPerfilText');
  var lightbox = document.getElementById('explorarLightbox');
  var lightboxImg = document.getElementById('explorarLightboxImg');
  var lightboxTitle = document.getElementById('explorarLightboxTitle');
  var lightboxText = document.getElementById('explorarLightboxText');
  var lightboxAddress = document.getElementById('explorarLightboxAddress');
  var lightboxCredit = document.getElementById('explorarLightboxCredit');
  var lightboxMap = document.getElementById('explorarLightboxMap');
  var perfilItem = null;
  var fdsGrid = document.getElementById('explorarFdsGrid');
  var gridEl = document.getElementById('explorarGrid');
  var mapEl = document.getElementById('explorarMap');
  var cadenceEl = document.getElementById('explorarCadence');

  function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function itemById(id) {
    if (!data || !data.itens) return null;
    return data.itens.find(function(it){ return it.id === id; }) || null;
  }

  function itensDaCidade(cidade) {
    return (data.itens || []).filter(function(it){ return it.cidade === cidade; });
  }

  function imgSrc(it) {
    return it.imagem || 'assets/explorar/guaiba-pier-guaiba.jpg';
  }

  function renderBadges(it) {
    var parts = [];
    (it.tags || []).slice(0, 3).forEach(function(t){
      parts.push('<span class="explorar-badge">' + esc(t) + '</span>');
    });
    return parts.join('');
  }

  function renderCard(it, opts) {
    opts = opts || {};
    var href = '#explorarMap';
    var target = '';
    var extra = opts.fds ? ' explorar-card--fds' : '';
    var motivo = opts.motivo ? '<p class="explorar-card__meta">' + esc(opts.motivo) + '</p>' : '';
    var quando = it.quando ? '<p class="explorar-card__meta">' + esc(it.quando) + '</p>' : '';
    var horario = it.horario ? '<p class="explorar-card__meta">' + esc(it.horario) + '</p>' : '';
    var dica = it.dica ? '<p class="explorar-card__meta">' + esc(it.dica) + '</p>' : '';
    var endereco = it.endereco ? '<p class="explorar-card__address">' + esc(it.endereco) + '</p>' : '';
    var destaque = opts.destaque ? '<p class="explorar-card__destaque">' + esc(opts.destaque) + '</p>' : '';
    return (
      '<a class="explorar-card' + extra + '" href="' + esc(href) + '"' + target + '>' +
        '<div class="explorar-card__media">' +
          '<img src="' + esc(imgSrc(it)) + '" alt="' + esc(it.titulo) + '" loading="lazy" decoding="async">' +
          '<div class="explorar-card__badges">' + renderBadges(it) + '</div>' +
        '</div>' +
        '<div class="explorar-card__body">' +
          destaque +
          '<h3 class="explorar-card__title">' + esc(it.titulo) + '</h3>' +
          endereco +
          '<p class="explorar-card__desc">' + esc(opts.desc || it.descricao_curta) + '</p>' +
          motivo + quando + horario + dica +
        '</div>' +
      '</a>'
    );
  }

  function fitImagens(root) {
    var fit = window.guaipecasFitImageFrame;
    if (!fit) return;
    (root || document).querySelectorAll('.explorar-perfil__zoom img, .explorar-card__media img').forEach(fit);
  }

  function openLugarLightbox(item) {
    if (!item || !lightbox || !lightboxImg) return;
    lightboxImg.src = item.imagem || '';
    lightboxImg.alt = item.titulo || '';
    if (lightboxTitle) lightboxTitle.textContent = item.titulo || '';
    if (lightboxText) lightboxText.textContent = item.descricao_longa || item.descricao_curta || '';
    if (lightboxAddress) lightboxAddress.textContent = item.endereco || '';
    if (lightboxCredit) {
      var creditParts = [];
      if (item.imagem_credito) creditParts.push('Foto: ' + item.imagem_credito);
      if (item.imagem_licenca) creditParts.push(item.imagem_licenca);
      lightboxCredit.textContent = creditParts.join(' · ');
      lightboxCredit.hidden = !creditParts.length;
    }
    if (lightboxMap) {
      lightboxMap.hidden = !(item.mapa && item.lat != null && item.lon != null);
    }
    if (typeof lightbox.showModal === 'function') lightbox.showModal();
  }

  function renderPerfil(cidade) {
    var perfil = (data.perfis && data.perfis[cidade]) || null;
    if (!perfil) return;
    perfilItem = perfil.item_ref ? itemById(perfil.item_ref) : null;
    var titulo = perfilItem ? perfilItem.titulo : (perfil.tagline || perfil.nome || cidade);
    var descricao = perfilItem
      ? (perfilItem.descricao_longa || perfilItem.descricao_curta)
      : (perfil.descricao || '');
    var imagem = perfilItem ? (perfilItem.imagem || perfil.imagem) : perfil.imagem;
    if (perfilImg) {
      perfilImg.src = imagem || 'assets/explorar/guaiba-pier-guaiba.jpg';
      perfilImg.alt = perfil.imagem_alt || titulo;
      window.guaipecasFitImageFrame(perfilImg);
    }
    if (perfilZoom) {
      perfilZoom.disabled = !perfilItem;
      perfilZoom.setAttribute('aria-label', perfilItem
        ? ('Ampliar foto de ' + titulo)
        : 'Ampliar foto do destaque');
    }
    if (perfilTagline) perfilTagline.textContent = titulo;
    if (perfilText) perfilText.textContent = descricao;
    if (cidadeNotaEl && gc) {
      var cfg = gc.getConfig(cidade);
      cidadeNotaEl.textContent = 'Mostrando sugestões para ' + (cfg ? cfg.name : cidade) + '. A cidade vale para todo o Guaipecaz.';
    }
  }

  if (perfilZoom) {
    perfilZoom.addEventListener('click', function(){
      if (perfilItem) openLugarLightbox(perfilItem);
    });
  }

  if (lightboxMap && lightbox) {
    lightboxMap.addEventListener('click', function(){
      if (typeof lightbox.close === 'function') lightbox.close();
    });
  }

  document.addEventListener('click', function(e){
    var card = e.target.closest('.explorar-card[href="#explorarMap"]');
    if (!card || !mapEl) return;
    window.setTimeout(function(){
      mapEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (mapInstance) mapInstance.invalidateSize();
    }, 80);
  });

  function renderFds(cidade) {
    if (!fdsGrid) return;
    var picks = (data.fim_de_semana || []).filter(function(p){ return p.cidade === cidade; });
    fdsGrid.innerHTML = picks.map(function(p){
      var it = itemById(p.item_ref);
      if (!it) return '';
      return renderCard(it, { fds: true, destaque: p.destaque, motivo: p.motivo, desc: p.motivo });
    }).join('') || '<p class="river-note">Em breve mais sugestões para este fim de semana.</p>';
    fitImagens(fdsGrid);
  }

  function renderGrid(cidade) {
    if (!gridEl) return;
    var itens = itensDaCidade(cidade);
    gridEl.innerHTML = itens.map(function(it){ return renderCard(it); }).join('') ||
      '<p class="river-note">Nenhum ponto turístico cadastrado para esta cidade.</p>';
    fitImagens(gridEl);
  }

  function popupHtml(it) {
    var quando = it.quando ? '<br><em>' + esc(it.quando) + '</em>' : '';
    var horario = it.horario ? '<br><em>' + esc(it.horario) + '</em>' : '';
    var endereco = it.endereco ? '<br>' + esc(it.endereco) : '';
    var extUrl = it.site_url || it.url;
    var link = extUrl ? '<br><a href="' + esc(extUrl) + '" target="_blank" rel="noopener">Site oficial ↗</a>' : '';
    return '<strong>' + esc(it.titulo) + '</strong>' + endereco + '<br>' + esc(it.descricao_curta) + quando + horario + link;
  }

  function updateMap(cidade) {
    if (!mapInstance || !helpers) return;
    markers.forEach(function(m){ mapInstance.removeLayer(m); });
    markers = [];
    var pontos = itensDaCidade(cidade).filter(function(it){
      return it.mapa && it.lat != null && it.lon != null;
    });
    var comOffset = helpers.coordsComOffset(pontos);
    comOffset.forEach(function(o){
      var m = helpers.addMarker(mapInstance, o.p, {
        lat: o.lat,
        lon: o.lon,
        popup: popupHtml(o.p)
      });
      if (m) markers.push(m);
    });
    if (pontos.length && gc) {
      var cfg = gc.getConfig(cidade);
      mapInstance.setView([cfg.lat, cfg.lon], cfg.zoom);
    }
    window.setTimeout(function(){ mapInstance.invalidateSize(); }, 150);
  }

  function applyCidade(cidade) {
    renderPerfil(cidade);
    renderFds(cidade);
    renderGrid(cidade);
    updateMap(cidade);
  }

  var explorarInitialized = false;

  function initMap() {
    if (!mapEl || !window.L || mapInstance) return;
    var cfg = gc.getConfig();
    mapInstance = L.map('explorarMap').setView([cfg.lat, cfg.lon], cfg.zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(mapInstance);
    updateMap(gc.get());
    window.setTimeout(function(){ mapInstance.invalidateSize(); }, 200);
  }

  function boot(payload) {
    data = payload;
    if (ledeEl && data.lede) ledeEl.textContent = data.lede;
    if (cadenceEl && data.gerado_em && window.GuaipecazSchedules) {
      window.GuaipecazSchedules.updateStamp(cadenceEl, data.gerado_em, 'explorar');
    }
    applyCidade(gc.get());
    if (!explorarInitialized) {
      explorarInitialized = true;
      gc.onChange(applyCidade);
      if (mapEl) window.guaipecasLoadLeaflet(initMap);
    } else if (mapInstance) {
      updateMap(gc.get());
    }
  }

  function fetchExplorar() {
    fetch('explorar.json', { cache: 'no-store' })
      .then(function(r){ if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(boot)
      .catch(function(){
        if (window.GUIEXPLORAR_DATA) boot(window.GUIEXPLORAR_DATA);
        else if (ledeEl) ledeEl.textContent = 'Conteúdo indisponível no momento.';
      });
  }

  if (window.GUIEXPLORAR_DATA) boot(window.GUIEXPLORAR_DATA);
  else fetchExplorar();
  if (window.GuaipecazSchedules) window.GuaipecazSchedules.alignPoll('explorar', fetchExplorar);
})();
