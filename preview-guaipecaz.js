(function () {
  var STORAGE_KEY = 'gz-theme';
  var DEFAULT_THEME = 'mare';

  var THEME_LABELS = {
    noite: 'Noite — escuro refinado, painel noturno e alertas (base atual do Guaipecaz).',
    aurora: 'Aurora — claro quente, papel e sol; portal público acolhedor para o dia.',
    neblina: 'Neblina — claro frio, cinza-azul; dashboard metropolitano limpo.',
    lagoa: 'Lagoa — escuro aquático, turquesa intenso; sensação de água profunda à noite.',
    delta: 'Delta — claro terroso, margem do Guaíba; calor humano + verde-água.',
    crepusculo: 'Crepúsculo — escuro violeta-azul; pôr do sol sobre a lagoa, poético.',
    alvorada: 'Alvorada — claro pêssego; nascer do sol, comunidade acordando.',
    serra: 'Serra — verde-cinza claro; chuva vinda da serra, Jacuí e bacia.',
    bruma: 'Bruma — minimalista neutro; elegância discreta, foco no conteúdo.',
    mare: 'Maré — escuro alto contraste; painel cívico forte, alertas saltam aos olhos.',
    jacui: 'Jacuí — escuro âmbar + água; rios e alertas em primeiro plano.'
  };

  var THEME_NAMES = Object.keys(THEME_LABELS);

  function applyTheme(name) {
    if (THEME_NAMES.indexOf(name) === -1) name = DEFAULT_THEME;
    document.documentElement.setAttribute('data-theme', name);

    document.querySelectorAll('.theme-btn').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.theme === name);
    });

    var select = document.getElementById('themeSelect');
    if (select) select.value = name;

    document.querySelectorAll('.palette-card').forEach(function (card) {
      card.classList.toggle('is-selected', card.dataset.theme === name);
    });

    var note = document.getElementById('themeNote');
    if (note) {
      var label = name.charAt(0).toUpperCase() + name.slice(1);
      note.innerHTML = '<strong>Paleta ' + label + '.</strong> ' + (THEME_LABELS[name] || '');
    }

    try { localStorage.setItem(STORAGE_KEY, name); } catch (e) {}
  }

  window.gzApplyTheme = applyTheme;

  document.querySelectorAll('.theme-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { applyTheme(btn.dataset.theme); });
  });

  var themeSelect = document.getElementById('themeSelect');
  if (themeSelect) {
    themeSelect.addEventListener('change', function () { applyTheme(themeSelect.value); });
  }

  document.querySelectorAll('[data-apply-theme]').forEach(function (btn) {
    btn.addEventListener('click', function () { applyTheme(btn.dataset.applyTheme); });
  });

  var saved = DEFAULT_THEME;
  try { saved = localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME; } catch (e) {}
  applyTheme(saved);

  var toggle = document.getElementById('gzNavToggle');
  var mobile = document.getElementById('gzMobileNav');
  if (toggle && mobile) {
    toggle.addEventListener('click', function () {
      var open = mobile.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
})();

(function () {
  var WEATHER_ICONS = {
    clear: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
    partly: '<path d="M18 10a4 4 0 0 0-7-2"/><path d="M4 14a5 5 0 0 1 8.5-2.5"/><path d="M12 2v2"/>',
    cloudy: '<path d="M18 10a4.5 4.5 0 0 0-8-2.5A5 5 0 1 0 6 18h13a4 4 0 0 0 0-8z"/>',
    rain: '<path d="M16 13a4 4 0 0 0-8 0"/><path d="M8 17v2M12 17v3M16 17v2"/>',
    snow: '<path d="M12 2v20M4.93 4.93l14.14 14.14M19.07 4.93 4.93 19.07M2 12h20"/>',
    storm: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>'
  };

  function iconKey(wmo) {
    if (wmo <= 1) return 'clear';
    if (wmo === 2) return 'partly';
    if (wmo === 3) return 'cloudy';
    if (wmo >= 51 && wmo <= 67) return 'rain';
    if (wmo >= 71 && wmo <= 77) return 'snow';
    if (wmo >= 80) return 'storm';
    return 'partly';
  }

  function weatherSvg(wmo, cls) {
    var key = iconKey(wmo);
    return '<svg class="' + (cls || 'gz-wx-icon') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">' + WEATHER_ICONS[key] + '</svg>';
  }

  function wmoLabel(code) {
    if (code <= 1) return 'sol';
    if (code === 2) return 'parcialmente nublado';
    if (code === 3) return 'nublado';
    if (code >= 51 && code <= 67) return 'chuva';
    if (code >= 71 && code <= 77) return 'granizo';
    if (code >= 80) return 'tempestade';
    return 'variável';
  }

  var CITIES = {
    guaiba: { name: 'Guaíba', lat: -30.1116, lon: -51.3237 },
    poa: { name: 'Porto Alegre', lat: -30.0346, lon: -51.2177 },
    canoas: { name: 'Canoas', lat: -29.9178, lon: -51.1836 },
    eldorado: { name: 'Eldorado do Sul', lat: -30.0847, lon: -51.2936 }
  };

  function fetchCity(id, cfg) {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + cfg.lat + '&longitude=' + cfg.lon +
      '&current=temperature_2m,weathercode,wind_speed_10m' +
      '&daily=temperature_2m_max,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max' +
      '&timezone=America%2FSao_Paulo&forecast_days=3';
    return fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      return { id: id, name: cfg.name, data: data };
    });
  }

  function fillHomePills(results) {
    results.forEach(function (row) {
      var cur = row.data.current;
      var daily = row.data.daily;
      if (!cur || !daily) return;
      var pop = Math.round(daily.precipitation_probability_max[0]);
      var wind = Math.round(daily.wind_speed_10m_max[0]);
      var temp = Math.round(cur.temperature_2m);
      var pill = document.querySelector('[data-clima-pill="' + row.id + '"]');
      if (!pill) return;
      var iconEl = pill.querySelector('[data-wx-icon]');
      if (iconEl) iconEl.outerHTML = weatherSvg(cur.weathercode, 'gz-clima-pill__icon');
      pill.querySelector('[data-temp]').textContent = temp + '°';
      pill.querySelector('[data-detail]').textContent = 'Chuva ' + pop + '% · Vento ' + wind + ' km/h';
      pill.classList.remove('skeleton');
    });
  }

  function fillRegionTable(results) {
    var tbody = document.getElementById('climaTableBody');
    if (!tbody) return;

    tbody.innerHTML = results.map(function (row) {
      var cur = row.data.current;
      var d = row.data.daily;
      var pop0 = Math.round(d.precipitation_probability_max[0]);
      var pop1 = Math.round(d.precipitation_probability_max[1]);
      var wind = Math.round(d.wind_speed_10m_max[0]);
      var gust = Math.round(d.wind_gusts_10m_max[0]);
      var temp = Math.round(cur.temperature_2m);
      var desc = wmoLabel(cur.weathercode);
      return '<tr>' +
        '<td>' + row.name + '</td>' +
        '<td><div class="gz-wx-cell">' + weatherSvg(cur.weathercode) +
        '<span><strong>' + temp + '°</strong> · ' + desc + '</span></div></td>' +
        '<td class="mono">' + pop0 + '% hoje · ' + pop1 + '% amanhã</td>' +
        '<td class="mono">' + wind + ' km/h · rajada ' + gust + '</td>' +
        '</tr>';
    }).join('');

    var cards = document.getElementById('climaIconCards');
    if (cards) {
      cards.innerHTML = results.map(function (row) {
        var cur = row.data.current;
        var d = row.data.daily;
        var pop = Math.round(d.precipitation_probability_max[0]);
        var wind = Math.round(d.wind_speed_10m_max[0]);
        return '<article class="gz-clima-icon-card">' +
          weatherSvg(cur.weathercode, 'gz-clima-icon-card__icon') +
          '<div class="gz-clima-icon-card__city">' + row.name + '</div>' +
          '<div class="gz-clima-icon-card__temp">' + Math.round(cur.temperature_2m) + '°</div>' +
          '<div class="gz-clima-icon-card__desc">' + wmoLabel(cur.weathercode) + '</div>' +
          '<div class="gz-clima-icon-card__meta">Chuva ' + pop + '% · Vento ' + wind + ' km/h</div>' +
          '</article>';
      }).join('');
    }

    var rainBars = document.getElementById('rainBars');
    var windBars = document.getElementById('windBars');
    if (rainBars && windBars) {
      rainBars.innerHTML = results.map(function (row) {
        var pop = Math.round(row.data.daily.precipitation_probability_max[0]);
        return '<div class="gz-bar-row"><span>' + row.name.split(' ')[0] + '</span>' +
          '<div class="gz-bar-track"><div class="gz-bar-fill" style="width:' + pop + '%"></div></div>' +
          '<span class="mono">' + pop + '%</span></div>';
      }).join('');
      windBars.innerHTML = results.map(function (row) {
        var w = Math.round(row.data.daily.wind_speed_10m_max[0]);
        var pct = Math.min(100, Math.round((w / 60) * 100));
        return '<div class="gz-bar-row"><span>' + row.name.split(' ')[0] + '</span>' +
          '<div class="gz-bar-track"><div class="gz-bar-fill" style="width:' + pct + '%"></div></div>' +
          '<span class="mono">' + w + '</span></div>';
      }).join('');
    }

    var pulseRain = document.getElementById('pulseRain');
    if (pulseRain && results.length) {
      var maxPop = 0;
      results.forEach(function (r) {
        var p = r.data.daily.precipitation_probability_max[0];
        if (p > maxPop) maxPop = p;
      });
      pulseRain.textContent = 'Chuva região até ' + Math.round(maxPop) + '%';
    }
  }

  function updatePulseTime() {
    var el = document.getElementById('pulseTime');
    if (el) {
      el.textContent = 'Atualizado ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
  }

  var hasClima = document.querySelector('[data-clima-pill]') || document.getElementById('climaTableBody');
  if (!hasClima) return;

  Promise.all(Object.keys(CITIES).map(function (id) { return fetchCity(id, CITIES[id]); }))
    .then(function (results) {
      fillHomePills(results);
      fillRegionTable(results);
      updatePulseTime();
    })
    .catch(function () { updatePulseTime(); });
})();
