// Google Analytics 4
(function(){
  var id = window.GUAIPECAS_GA4_ID;
  if (!id || id.indexOf('G-') !== 0 || id === 'G-XXXXXXXX') return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){ window.dataLayer.push(arguments); };
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

// Filtro de categorias (saúde)
(function(){
  const chipRow = document.getElementById('chipRow');
  if (!chipRow) return;
  const chips = chipRow.querySelectorAll('.chip');
  const rows = document.querySelectorAll('#dataList .data-row');
  const emptyState = document.getElementById('emptyState');

  chipRow.addEventListener('click', function(e){
    const chip = e.target.closest('.chip');
    if (!chip) return;
    chips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const cat = chip.getAttribute('data-cat');
    let visibleCount = 0;
    rows.forEach(row => {
      const match = (cat === 'all') || (row.getAttribute('data-cat') === cat);
      row.classList.toggle('hidden', !match);
      if (match) visibleCount++;
    });
    if (emptyState) emptyState.style.display = visibleCount === 0 ? 'block' : 'none';
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

function setWeatherIcon(wmo) {
  var iconEl = document.getElementById('wxIcon');
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

function applyRiverStatus(card, level, cota, statusEl) {
  if (!statusEl || level == null) return;
  var dot = statusEl.querySelector('.status-dot');
  var txt = statusEl.querySelector('span:last-child');
  if (!dot || !txt) return;

  card.classList.remove('alert-watch', 'alert-danger');
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
  textEl.textContent = message;
}

// Atualização do nível dos rios via rivers.json
(function(){
  var guaibaCard = document.querySelector('[data-river="guaiba"]');
  var jacuiCard = document.querySelector('[data-river="jacui"]');
  if (!guaibaCard && !jacuiCard) return;

  function updateRivers(data) {
    var rios = data.rios || {};
    var g = rios.guaiba;
    if (g && guaibaCard) {
      var levelEl = document.getElementById('guaibaLevel');
      var statusEl = document.getElementById('guaibaStatus');
      var updatedEl = document.getElementById('guaibaUpdated');
      if (levelEl && g.nivel_m != null) {
        levelEl.textContent = g.nivel_m.toFixed(2).replace('.', ',') + ' m';
        clearSkeleton(levelEl);
      }
      if (updatedEl) {
        var dt = new Date(g.data_hora_medicao || data.gerado_em);
        updatedEl.textContent = 'Atualizado em ' + dt.toLocaleString('pt-BR');
      }
      applyRiverStatus(guaibaCard, g.nivel_m, g.cota_inundacao || 3.0, statusEl);
    }

    var j = rios.jacui;
    if (j && jacuiCard) {
      var levelEl2 = document.getElementById('jacuiLevel');
      var statusEl2 = document.getElementById('jacuiStatus');
      var updatedEl2 = document.getElementById('jacuiUpdated');
      if (levelEl2 && j.nivel_m != null) {
        levelEl2.textContent = j.nivel_m.toFixed(2).replace('.', ',') + ' m';
        clearSkeleton(levelEl2);
      }
      if (updatedEl2) {
        var dt2 = new Date(j.data_hora_medicao || data.gerado_em);
        updatedEl2.textContent = 'Atualizado em ' + dt2.toLocaleString('pt-BR');
      }
      applyRiverStatus(jacuiCard, j.nivel_m, j.cota_inundacao || 7.5, statusEl2);
    }

    var updateEl = document.getElementById('nowUpdate');
    if (updateEl && data.gerado_em) {
      var dt3 = new Date(data.gerado_em);
      updateEl.textContent = 'última atualização: ' + dt3.toLocaleString('pt-BR');
      clearSkeleton(updateEl);
    }
  }

  function fetchRivers() {
    fetch('rivers.json', { cache: 'no-store' })
      .then(function(r){ if (!r.ok) throw new Error('sem rivers.json'); return r.json(); })
      .then(updateRivers)
      .catch(function(){
        ['guaibaLevel', 'jacuiLevel', 'nowUpdate'].forEach(function(id){
          clearSkeleton(document.getElementById(id));
        });
        var updateEl = document.getElementById('nowUpdate');
        if (updateEl) updateEl.textContent = 'dados estáticos';
      });
  }

  fetchRivers();
  setInterval(fetchRivers, 300000);
})();

// Previsão do tempo (Open-Meteo) — compacta
(function(){
  var tempEl = document.getElementById('wxTemp');
  if (!tempEl) return;
  var LAT = -30.1116, LON = -51.3237;
  var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + LAT + '&longitude=' + LON +
    '&current=temperature_2m,weathercode&daily=temperature_2m_max,precipitation_probability_max' +
    '&timezone=America%2FSao_Paulo&forecast_days=1';

  fetch(url)
    .then(function(r){ return r.json(); })
    .then(function(data){
      var cur = data.current;
      var descEl = document.getElementById('wxDesc');
      var compactEl = document.getElementById('wxCompact');
      var rainEl = document.getElementById('wxRain');
      if (tempEl && cur) {
        tempEl.textContent = Math.round(cur.temperature_2m) + '°C';
        clearSkeleton(tempEl);
      }
      var wmo = cur.weathercode;
      var desc = 'ensolarado';
      if (wmo >= 0 && wmo <= 1) desc = 'céu claro';
      else if (wmo === 2) desc = 'parcialmente nublado';
      else if (wmo === 3) desc = 'nublado';
      else if (wmo >= 51 && wmo <= 67) desc = 'chuva';
      else if (wmo >= 71 && wmo <= 77) desc = 'neve';
      else if (wmo >= 80 && wmo <= 99) desc = 'tempestade';
      setWeatherIcon(wmo);
      if (descEl) { descEl.textContent = desc; clearSkeleton(descEl); }

      if (data.daily) {
        var pop = Math.round(data.daily.precipitation_probability_max[0]);
        var max = Math.round(data.daily.temperature_2m_max[0]);
        if (compactEl) compactEl.textContent = 'Hoje: máx ' + max + '° · chuva ' + pop + '%';
        if (rainEl) {
          rainEl.textContent = 'chuva prevista: ' + pop + '%';
          clearSkeleton(rainEl);
        }
      }
    })
    .catch(function(){
      clearSkeleton(tempEl);
      clearSkeleton(document.getElementById('wxDesc'));
      var rainEl = document.getElementById('wxRain');
      if (rainEl) { rainEl.textContent = 'chuva: indisponível'; clearSkeleton(rainEl); }
      var compactEl = document.getElementById('wxCompact');
      if (compactEl) compactEl.textContent = 'Previsão indisponível';
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
    var banner = m.banner || ('assets/banners/' + m.id + '.png');
    var alt = 'Ofertas ' + m.nome;
    var cta = 'Ver encarte da semana';
    if (m.ofertas && m.ofertas.length > 0) {
      var o = m.ofertas[0];
      cta = (o.titulo || '') + (o.preco ? ' — ' + o.preco : '');
      cta = cta.trim() || 'Ver encarte da semana';
    }
    return (
      '<a href="' + escapeHtml(m.url) + '" target="_blank" rel="noopener" class="banner-offer" style="--market-color:' + escapeHtml(m.cor) + '">' +
        '<img src="' + escapeHtml(banner) + '" alt="' + escapeHtml(alt) + '" loading="lazy" width="480" height="270">' +
        '<div class="banner-offer__overlay">' +
          '<span class="banner-offer__badge" aria-hidden="true">' + escapeHtml(marketInitial(m.nome)) + '</span>' +
          '<div class="banner-offer__text">' +
            '<span class="banner-offer__name">' + escapeHtml(m.nome) + '</span>' +
            '<span class="banner-offer__cta">' + escapeHtml(cta) + '</span>' +
          '</div>' +
          '<span class="banner-offer__arrow" aria-hidden="true">→</span>' +
        '</div>' +
      '</a>'
    );
  }

  fetch('ofertas.json', { cache: 'no-store' })
    .then(function(r){ if (!r.ok) throw new Error('sem ofertas.json'); return r.json(); })
    .then(function(data){
      if (!data.mercados || !data.mercados.length) return;
      container.innerHTML = data.mercados.map(renderBanner).join('');
      var updateEl = document.getElementById('offersUpdate');
      if (updateEl && data.gerado_em) {
        updateEl.textContent = 'última atualização: ' + new Date(data.gerado_em).toLocaleString('pt-BR');
        clearSkeleton(updateEl);
      }
      if (window._observeReveal) window._observeReveal();
    })
    .catch(function(){
      var updateEl = document.getElementById('offersUpdate');
      if (updateEl) {
        updateEl.textContent = 'encartes estáticos';
        clearSkeleton(updateEl);
      }
    });
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
    leadEl.href = item.url;
    leadEl.hidden = false;
    leadEl.classList.remove('manchete-lead--skeleton');

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
        '<a href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener" class="manchete-item__link">' +
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
    if (updateEl && data.gerado_em) {
      var label = new Date(data.gerado_em).toLocaleString('pt-BR');
      updateEl.textContent = cached
        ? 'dados em cache: ' + label
        : 'última atualização: ' + label;
      clearSkeleton(updateEl);
    }
    if (window._observeReveal) window._observeReveal();
    return true;
  }

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
    return 'Guaipecas — notícias, rios, saúde e serviços de Guaíba: ' + window.location.href;
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
        navigator.share({ title: 'Guaipecas', text: shareText(), url: window.location.href }).catch(function(){});
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
        '<li class="manchete-item"><a href="' + esc(item.url) + '" target="_blank" rel="noopener" class="manchete-item__link">' +
          '<span class="manchete-item__source">' + esc(item.fonte || 'Fonte') + '</span>' +
          '<span class="manchete-item__title">' + esc(item.titulo) + '</span>' +
          '<span class="manchete-item__date">' + esc(item.publicado_em ? new Date(item.publicado_em).toLocaleDateString('pt-BR') : '') + '</span>' +
        '</a></li>'
      );
    }).join('');
  }

  fetch('noticias.json', { cache: 'no-store' })
    .then(function(r){ return r.json(); })
    .then(load)
    .catch(function(){ if (window.GUIBANEWS_DATA) load(window.GUIBANEWS_DATA); });
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
  }

  fetch('editais.json', { cache: 'no-store' })
    .then(function(r){ return r.json(); })
    .then(paint)
    .catch(function(){ if (window.GUIEDITAIS_DATA) paint(window.GUIEDITAIS_DATA); });
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

  fetch('servicos.json', { cache: 'no-store' })
    .then(function(r){ return r.json(); })
    .then(apply)
    .catch(function(){ if (window.GUISERVICOS_DATA) apply(window.GUISERVICOS_DATA); });

  if (vagasList) {
    fetch('editais.json', { cache: 'no-store' })
      .then(function(r){ return r.json(); })
      .then(applyVagas)
      .catch(function(){ if (window.GUIEDITAIS_DATA) applyVagas(window.GUIEDITAIS_DATA); });
  }
})();

// Mapa de saúde
(function(){
  var mapEl = document.getElementById('saudeMap');
  if (!mapEl) return;

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }

  function initMap(unidades) {
    if (!window.L || !unidades.length) return;
    var map = L.map('saudeMap').setView([-30.1137, -51.3266], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
    unidades.forEach(function(u){
      var popup = '<strong>' + esc(u.nome) + '</strong><br>' + esc(u.categoria);
      if (u.cnes_url) popup += '<br><a href="' + esc(u.cnes_url) + '" target="_blank" rel="noopener">CNES ↗</a>';
      L.marker([u.lat, u.lon]).addTo(map).bindPopup(popup);
    });
  }

  var css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(css);
  var leaflet = document.createElement('script');
  leaflet.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  leaflet.onload = function(){
    fetch('unidades-map.json', { cache: 'no-store' })
      .then(function(r){ return r.json(); })
      .then(function(d){ initMap(d.unidades || []); })
      .catch(function(){ if (window.GUIUNIDADES_DATA) initMap(window.GUIUNIDADES_DATA.unidades || []); });
  };
  document.head.appendChild(leaflet);
})();
