(function () {
  var BACKGROUNDS = [
    {
      id: 'ao-vivo',
      name: 'Rio ao vivo',
      credit: 'Nível Guaíba · atualiza a cada 30 min',
      src: 'assets/backgrounds/bg-ao-vivo.webp',
      mood: 'Dados reais do portal — coerência máxima com a seção Agora.'
    },
    {
      id: 'por-sol',
      name: 'Pôr do sol no Guaíba',
      credit: 'Glauco Umbelino · CC BY 2.0 · Wikimedia',
      src: 'assets/backgrounds/bg-por-sol.jpg',
      mood: 'Dourado e ciano — combina com Maré. Acolhedor, icônico da região.'
    },
    {
      id: 'panorama',
      name: 'Panorama de POA',
      credit: 'Boaventuravinicius · CC BY-SA 4.0 · Wikimedia',
      src: 'assets/backgrounds/bg-panorama.jpg',
      mood: 'Skyline amplo — reforça “Grande Porto Alegre”.'
    },
    {
      id: 'orla',
      name: 'Orla do lago',
      credit: 'Lenny Maidana · CC BY 2.0 · Wikimedia',
      src: 'assets/backgrounds/bg-orla.jpg',
      mood: 'Orla urbana à beira d’água — moderno e reconhecível.'
    },
    {
      id: 'remo',
      name: 'Barco no Guaíba',
      credit: 'Paulo RS Menezes · CC BY-SA 2.5 BR · Wikimedia',
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Barco_de_turismo_Porto_Alegre_10_02.jpg/1280px-Barco_de_turismo_Porto_Alegre_10_02.jpg',
      mood: 'Movimento suave na água — vida e turismo local.'
    },
    {
      id: 'cidade',
      name: 'Vista de Guaíba',
      credit: 'Wikimedia Commons · cidade de Guaíba/RS',
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Gua%C3%ADba_%2840816208914%29.jpg/1280px-Gua%C3%ADba_%2840816208914%29.jpg',
      mood: 'A cidade em si — identidade municipal direta.'
    }
  ];

  var grid = document.getElementById('bgPickerGrid');
  var note = document.getElementById('bgNote');
  if (!grid) return;

  var active = localStorage.getItem('gz_glass_bg') || 'por-sol';

  function applyBg(id) {
    var bg = BACKGROUNDS.find(function (b) { return b.id === id; });
    if (!bg) return;
    active = id;
    localStorage.setItem('gz_glass_bg', id);
    document.documentElement.style.setProperty('--gz-bg-image', "url('" + bg.src + "')");
    grid.querySelectorAll('.bg-option').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.bg === id);
    });
    if (note) {
      note.innerHTML = '<strong>' + bg.name + '.</strong> ' + bg.mood + ' <span style="opacity:0.8">(' + bg.credit + ')</span>';
    }
  }

  grid.innerHTML = BACKGROUNDS.map(function (bg) {
    return '<button type="button" class="bg-option' + (bg.id === active ? ' is-active' : '') + '" data-bg="' + bg.id + '" aria-pressed="' + (bg.id === active) + '">' +
      '<img src="' + bg.src + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' +
      '<span class="bg-option__label">' + bg.name +
        '<span class="bg-option__credit">' + bg.credit + '</span>' +
      '</span>' +
    '</button>';
  }).join('');

  grid.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-bg]');
    if (!btn) return;
    applyBg(btn.dataset.bg);
  });

  applyBg(active);
})();
