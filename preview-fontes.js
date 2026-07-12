(function () {
  var FONT_STACKS = {
    mare: { display: "'Fraunces', serif", body: "'Inter', sans-serif", mono: "'IBM Plex Mono', monospace" },
    jornal: { display: "'Playfair Display', serif", body: "'Source Serif 4', serif", mono: "'JetBrains Mono', monospace" },
    painel: { display: "'Space Grotesk', sans-serif", body: "'DM Sans', sans-serif", mono: "'Space Mono', monospace" },
    civico: { display: "'Bitter', serif", body: "'Nunito Sans', sans-serif", mono: "'Inconsolata', monospace" },
    geometrico: { display: "'Outfit', sans-serif", body: "'Plus Jakarta Sans', sans-serif", mono: "'Roboto Mono', monospace" },
    gaucho: { display: "'Lora', serif", body: "'Karla', sans-serif", mono: "'Courier Prime', monospace" }
  };

  var FONTS = [
    {
      id: 'mare',
      name: 'Maré atual',
      tags: ['Serif + Sans', 'Site publicado'],
      mood: 'Fraunces traz personalidade cívica; Inter garante leitura rápida. Equilíbrio entre portal público e painel de dados.',
      stack: ['Fraunces — títulos', 'Inter — corpo', 'IBM Plex Mono — dados'],
      sampleDisplay: 'Rio Guaíba em 0,68 m',
      sampleBody: 'Notícias, rios e serviços de Guaíba num só lugar.'
    },
    {
      id: 'jornal',
      name: 'Jornal',
      tags: ['Editorial', 'GuaibaNews'],
      mood: 'Tom de veículo de imprensa local — manchetes com peso, corpo serifado para textos longos. Ideal se o GuaibaNews for protagonista.',
      stack: ['Playfair Display — manchetes', 'Source Serif 4 — matérias', 'JetBrains Mono — metadados'],
      sampleDisplay: 'Manchete da região',
      sampleBody: 'Cada matéria abre com hierarquia clara, como um jornal de bairro digital.'
    },
    {
      id: 'painel',
      name: 'Painel técnico',
      tags: ['Dashboard', 'Dados'],
      mood: 'Geométrico e denso — sensação de central de monitoramento. Rios, clima e alertas ganham prioridade visual.',
      stack: ['Space Grotesk — títulos', 'DM Sans — interface', 'Space Mono — números'],
      sampleDisplay: '0,68 m · Normal',
      sampleBody: 'Números e status saltam aos olhos; menos ornamentação, mais precisão.'
    },
    {
      id: 'civico',
      name: 'Cívico',
      tags: ['Prefeitura', 'Acessível'],
      mood: 'Bitter transmite solidez institucional; Nunito Sans é amigável e legível em qualquer idade. Bom para serviços públicos.',
      stack: ['Bitter — títulos', 'Nunito Sans — corpo', 'Inconsolata — códigos'],
      sampleDisplay: 'Serviços de Guaíba',
      sampleBody: 'Linguagem visual de portal da prefeitura moderna, sem parecer burocrático.'
    },
    {
      id: 'geometrico',
      name: 'Geométrico',
      tags: ['Moderno', 'App-like'],
      mood: 'Sans-serif uniforme — sensação de app mobile nativo. Limpo, jovem, bom para feed e cards grandes.',
      stack: ['Outfit — display', 'Plus Jakarta Sans — UI', 'Roboto Mono — labels'],
      sampleDisplay: 'Tudo em um lugar',
      sampleBody: 'Interface contemporânea, próxima de fintechs e apps cívicos internacionais.'
    },
    {
      id: 'gaucho',
      name: 'Gaúcho',
      tags: ['Regional', 'Acolhedor'],
      mood: 'Lora e Karla aquecem o tom — menos “painel”, mais “portal da comunidade”. Combina bem com paletas Delta e Aurora.',
      stack: ['Lora — títulos', 'Karla — corpo', 'Courier Prime — dados'],
      sampleDisplay: 'Por quem mora em Guaíba',
      sampleBody: 'Tipografia com calor humano, sem perder clareza nos números dos rios.'
    }
  ];

  var grid = document.getElementById('fontsGrid');
  var note = document.getElementById('fontNote');
  var specimen = document.getElementById('typeSpecimen');
  if (!grid) return;

  var active = localStorage.getItem('gz_preview_font') || 'mare';
  document.documentElement.setAttribute('data-font', active);

  function applyFont(id) {
    active = id;
    document.documentElement.setAttribute('data-font', id);
    localStorage.setItem('gz_preview_font', id);
    grid.querySelectorAll('.font-card').forEach(function (card) {
      card.classList.toggle('is-active', card.dataset.font === id);
    });
    var f = FONTS.find(function (x) { return x.id === id; });
    if (note && f) {
      note.innerHTML = '<strong>' + f.name + '.</strong> ' + f.mood;
    }
    if (specimen && f) {
      specimen.querySelector('.type-specimen__display').textContent = f.sampleDisplay;
      specimen.querySelector('.type-specimen__body').textContent = f.sampleBody;
      specimen.querySelector('.type-specimen__mono').textContent = f.stack.join(' · ');
    }
  }

  grid.innerHTML = FONTS.map(function (f) {
    return '<article class="font-card' + (f.id === active ? ' is-active' : '') + '" data-font="' + f.id + '" tabindex="0" role="button" aria-pressed="' + (f.id === active) + '">' +
      '<div class="font-card__tags">' + f.tags.map(function (t) {
        return '<span class="font-tag">' + t + '</span>';
      }).join('') + '</div>' +
      '<h2>' + f.name + '</h2>' +
      '<p class="font-card__mood">' + f.mood + '</p>' +
      '<div class="font-card__stack">' + f.stack.join('<br>') + '</div>' +
      '<div class="font-card__sample" data-font-sample="' + f.id + '">' +
        '<div class="font-card__sample-display">' + f.sampleDisplay + '</div>' +
        '<div class="font-card__sample-body">' + f.sampleBody + '</div>' +
      '</div>' +
    '</article>';
  }).join('');

  Object.keys(FONT_STACKS).forEach(function (id) {
    var sample = grid.querySelector('[data-font-sample="' + id + '"]');
    var stack = FONT_STACKS[id];
    if (!sample || !stack) return;
    var display = sample.querySelector('.font-card__sample-display');
    var body = sample.querySelector('.font-card__sample-body');
    if (display) display.style.fontFamily = stack.display;
    if (body) body.style.fontFamily = stack.body;
  });

  grid.addEventListener('click', function (e) {
    var card = e.target.closest('.font-card');
    if (!card) return;
    applyFont(card.dataset.font);
  });

  grid.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var card = e.target.closest('.font-card');
    if (!card) return;
    e.preventDefault();
    applyFont(card.dataset.font);
  });

  applyFont(active);
})();
