(function () {
  var LAYOUTS = [
    {
      id: 'painel',
      name: 'Painel',
      mood: 'Layout atual do site — seções empilhadas, rios lado a lado, clima em faixa, ofertas em scroll. Familiar e funcional.',
      pros: 'Já validado · Fácil de escanear · Bom em desktop',
      best: 'Manter evolução incremental'
    },
    {
      id: 'revista',
      name: 'Revista',
      mood: 'Hero editorial + coluna principal (notícias) e sidebar (rios/clima). Hierarquia visual forte para manchetes.',
      pros: 'GuaibaNews em destaque · Sensação premium',
      best: 'Se notícias forem o carro-chefe'
    },
    {
      id: 'dashboard',
      name: 'Dashboard',
      mood: 'Menu lateral fixo + grade de widgets. Dados ao vivo (rios, clima, alertas) ocupam o centro.',
      pros: 'Máxima densidade · Monitoramento',
      best: 'Usuários que consultam várias vezes ao dia'
    },
    {
      id: 'feed',
      name: 'Feed',
      mood: 'Coluna única estreita, cards grandes, mobile-first. Parece app social — rolagem contínua.',
      pros: 'Excelente no celular · Toque amigável',
      best: 'Público majoritariamente mobile'
    },
    {
      id: 'hub',
      name: 'Hub 4 zonas',
      mood: 'Navegação por hubs (Início, Região, Guaíba, Participe). Home vira mapa de entrada, não mural de tudo.',
      pros: 'Escala bem · Guaipecaz reframe',
      best: 'Portal metropolitano completo'
    }
  ];

  var canvas = document.getElementById('layoutCanvas');
  var picker = document.getElementById('layoutPicker');
  var note = document.getElementById('layoutNote');
  var compare = document.getElementById('layoutCompare');
  if (!canvas) return;

  var active = localStorage.getItem('gz_preview_layout') || 'painel';

  function renderMock(layoutId) {
    var hubs = layoutId === 'hub'
      ? '<div class="lm-hub-grid">' +
          '<a class="lm-hub-card" href="#"><span class="tag">Início</span><h3>Agora</h3><p>Rios, clima e manchete</p></a>' +
          '<a class="lm-hub-card" href="#"><span class="tag">Região</span><h3>Metro POA</h3><p>4 cidades · chuva · vento</p></a>' +
          '<a class="lm-hub-card" href="#"><span class="tag">Guaíba</span><h3>Serviços</h3><p>Saúde · ônibus · editais</p></a>' +
          '<a class="lm-hub-card" href="#"><span class="tag">Participe</span><h3>Comunidade</h3><p>Enquetes e sugestões</p></a>' +
        '</div>'
      : '';

    var sidebarNav = layoutId === 'dashboard'
      ? '<nav class="lm-sidebar-nav" aria-label="Menu">' +
          '<a href="#" class="active">Painel</a>' +
          '<a href="#">Região</a>' +
          '<a href="#">GuaibaNews</a>' +
          '<a href="#">Guaíba</a>' +
          '<a href="#">Participe</a>' +
        '</nav>'
      : '';

    var bodyPainel =
      '<div class="lm-section-title">Agora</div>' +
      '<div class="lm-row-agora">' +
        '<div class="lm-card"><div style="font-size:0.7rem;color:var(--ink-soft)">Rio Guaíba</div><div class="lm-card__value">0,68 m</div><div class="lm-card__meta">Normal · Cota 3 m</div></div>' +
        '<div class="lm-card"><div style="font-size:0.7rem;color:var(--ink-soft)">Rio Jacuí</div><div class="lm-card__value">0,99 m</div><div class="lm-card__meta">Vigiar · Cota 7,5 m</div></div>' +
        '<div class="lm-card"><div style="font-size:0.7rem;color:var(--ink-soft)">Clima · Guaíba</div><div class="lm-card__value">24°</div><div class="lm-card__meta">Semana · chuva sáb 78%</div></div>' +
      '</div>' +
      '<div class="lm-section-title">GuaibaNews</div>' +
      '<div class="lm-row-news">' +
        '<div class="lm-card"><div class="lm-news-title">Circuito Sesc reúne 400 corredores em Guaíba</div><div class="lm-card__meta">Repórter Guaibense · há 2 h</div></div>' +
        '<div class="lm-card"><div class="lm-news-title" style="font-size:0.85rem">PRF prende em BR-116</div><div class="lm-card__meta">Studio · ontem</div></div>' +
      '</div>' +
      '<div class="lm-section-title">Ofertas</div>' +
      '<div class="lm-offers"><div class="lm-offer">Stok</div><div class="lm-offer">Índio</div><div class="lm-offer">Paulinho</div></div>' +
      '<div class="lm-section-title">Em Guaíba</div>' +
      '<div class="lm-services">' +
        '<div class="lm-card"><div class="lm-card__value" style="font-size:0.9rem">Saúde</div><div class="lm-card__meta">28 UBS</div></div>' +
        '<div class="lm-card"><div class="lm-card__value" style="font-size:0.9rem">Serviços</div><div class="lm-card__meta">Ônibus</div></div>' +
      '</div>';

    var bodyRevista =
      '<div class="lm-main-grid">' +
        '<div>' +
          '<div class="lm-news-feature"><div class="lm-section-title">Manchete</div><div class="lm-news-title">Circuito Sesc reúne mais de 400 corredores sob chuva em Guaíba</div><div class="lm-card__meta">Repórter Guaibense · foto · resumo completo no site</div></div>' +
          '<div class="lm-section-title">Ofertas locais</div>' +
          '<div class="lm-offers"><div class="lm-offer">Stok Center</div><div class="lm-offer">Índio</div></div>' +
        '</div>' +
        '<aside class="lm-sidebar">' +
          '<div class="lm-card"><div class="lm-section-title">Rio Guaíba</div><div class="lm-card__value">0,68 m</div><div class="lm-card__meta">Normal</div></div>' +
          '<div class="lm-card"><div class="lm-section-title">Clima</div><div class="lm-card__value">24°</div><div class="lm-card__meta">Guaíba · chuva 45%</div></div>' +
        '</aside>' +
      '</div>' +
      '<div class="lm-section-title" style="margin-top:14px">Em Guaíba</div>' +
      '<div class="lm-services"><div class="lm-card"><div class="lm-card__value" style="font-size:0.8rem">Saúde</div></div><div class="lm-card"><div class="lm-card__value" style="font-size:0.8rem">Serviços</div></div><div class="lm-card"><div class="lm-card__value" style="font-size:0.8rem">Editais</div></div><div class="lm-card"><div class="lm-card__value" style="font-size:0.8rem">Contatos</div></div></div>';

    var bodyDashboard =
      '<div class="lm-card lm-widget-tall"><div class="lm-section-title">Rios</div><div class="lm-card__value">0,68 m</div><div class="lm-card__meta">Guaíba Normal</div><div style="margin-top:10px" class="lm-card__value">0,99 m</div><div class="lm-card__meta">Jacuí Vigiar</div></div>' +
      '<div class="lm-card"><div class="lm-section-title">Clima</div><div class="lm-card__value">24°</div><div class="lm-card__meta">Guaíba · semana</div></div>' +
      '<div class="lm-card"><div class="lm-section-title">Alerta</div><div class="lm-card__meta" style="color:var(--gold)">Chuva 78% sábado</div></div>' +
      '<div class="lm-card lm-widget-wide"><div class="lm-section-title">Manchete</div><div class="lm-news-title">Circuito Sesc em Guaíba</div></div>' +
      '<div class="lm-card lm-widget-wide"><div class="lm-section-title">Ofertas</div><div class="lm-offers"><div class="lm-offer">Stok</div><div class="lm-offer">Índio</div><div class="lm-offer">Paulinho</div></div></div>';

    var bodyFeed =
      '<div class="lm-card"><div class="lm-section-title">Rio Guaíba · agora</div><div class="lm-card__value">0,68 m</div><div class="lm-card__meta">Normal · atualizado há 12 min</div></div>' +
      '<div class="lm-card"><div class="lm-section-title">Manchete</div><div class="lm-news-title">Circuito Sesc reúne 400 corredores em Guaíba</div><div class="lm-card__meta">Repórter Guaibense</div></div>' +
      '<div class="lm-card"><div class="lm-section-title">Clima · semana</div><div class="lm-card__value">24°</div><div class="lm-card__meta">Guaíba · máx 26° · chuva sáb</div></div>' +
      '<div class="lm-card"><div class="lm-section-title">Ofertas</div><div class="lm-offers"><div class="lm-offer">Stok Center — encarte</div><div class="lm-offer">Supermercado Índio</div></div></div>' +
      '<div class="lm-card"><div class="lm-section-title">Saúde</div><div class="lm-news-title">28 unidades em Guaíba</div></div>';

    var bodyHub =
      hubs +
      '<div class="lm-body-secondary">' +
        '<div class="lm-card"><div class="lm-section-title">Pulse</div><div class="lm-card__meta"><strong style="color:var(--river)">Rios normais</strong> · chuva 45% amanhã</div></div>' +
        '<div class="lm-card"><div class="lm-section-title">Manchete</div><div class="lm-news-title">Circuito Sesc em Guaíba</div></div>' +
      '</div>';

    var bodies = {
      painel: bodyPainel,
      revista: bodyRevista,
      dashboard: bodyDashboard,
      feed: bodyFeed,
      hub: bodyHub
    };

    var navItems = layoutId === 'hub'
      ? '<a href="#" class="active">Início</a><a href="#">Região</a><a href="#">Guaíba</a><a href="#">Participe</a>'
      : '<a href="#" class="active">Início</a><a href="#">Região</a><a href="#">Guaíba</a><a href="#">GuaibaNews</a><a href="#">Participe</a>';

    return (
      '<div class="layout-mock" data-layout-inner="' + layoutId + '">' +
        sidebarNav +
        '<div class="lm-main-area">' +
          '<div class="lm-emergency"><span class="label">Emergência</span><a href="#">SAMU 192</a><a href="#">Bombeiros 193</a><a href="#">Defesa Civil 199</a></div>' +
          '<header class="lm-header"><a class="lm-brand" href="#">Guaipecaz<small>Guaíba · Grande POA</small></a><nav class="lm-nav">' + navItems + '</nav></header>' +
          '<div class="lm-pulse"><strong>Rios normais</strong> · chuva prevista 45% · Jacuí vigiar</div>' +
          (layoutId !== 'dashboard' && layoutId !== 'feed' ? '<section class="lm-hero"><span class="pulse-label">Portal cidadão</span><h1>Tudo que importa agora.</h1><p>Rios, clima, notícias e serviços — atualizado para quem mora aqui.</p></section>' : '') +
          (layoutId === 'hub' ? bodies.hub : '<div class="lm-body">' + (bodies[layoutId] || bodyPainel) + '</div>') +
        '</div>' +
      '</div>'
    );
  }

  function applyLayout(id) {
    active = id;
    localStorage.setItem('gz_preview_layout', id);
    document.documentElement.setAttribute('data-layout', id);
    canvas.innerHTML =
      '<div class="layout-canvas__chrome">' +
        '<span class="layout-canvas__dot"></span><span class="layout-canvas__dot"></span><span class="layout-canvas__dot"></span>' +
        '<span>Prévia · layout <strong>' + id + '</strong></span>' +
      '</div>' +
      renderMock(id);

    var L = LAYOUTS.find(function (x) { return x.id === id; });
    if (note && L) {
      note.innerHTML = '<strong>' + L.name + '.</strong> ' + L.mood + ' <em>Ideal quando:</em> ' + L.best + '.';
    }

    if (picker) {
      picker.querySelectorAll('.layout-btn').forEach(function (btn) {
        btn.classList.toggle('is-active', btn.dataset.layout === id);
      });
    }
    if (compare) {
      compare.querySelectorAll('.layout-compare-card').forEach(function (card) {
        card.classList.toggle('is-active', card.dataset.layout === id);
      });
    }
  }

  if (picker) {
    picker.innerHTML = LAYOUTS.map(function (l) {
      return '<button type="button" class="layout-btn' + (l.id === active ? ' is-active' : '') + '" data-layout="' + l.id + '">' + l.name + '</button>';
    }).join('');
    picker.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-layout]');
      if (!btn) return;
      applyLayout(btn.dataset.layout);
    });
  }

  if (compare) {
    compare.innerHTML = LAYOUTS.map(function (l) {
      return '<article class="layout-compare-card' + (l.id === active ? ' is-active' : '') + '" data-layout="' + l.id + '" tabindex="0" role="button">' +
        '<h3>' + l.name + '</h3>' +
        '<p>' + l.pros + '</p>' +
      '</article>';
    }).join('');
    compare.addEventListener('click', function (e) {
      var card = e.target.closest('[data-layout]');
      if (!card) return;
      applyLayout(card.dataset.layout);
    });
  }

  applyLayout(active);
})();
