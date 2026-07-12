(function () {
  var grid = document.getElementById('palettesGrid');
  if (!grid) return;

  var PALETTES = [
    { id: 'noite', name: 'Noite', mood: 'Escuro refinado — herda o Guaipecaz atual com mais ar.', tags: ['Escuro', 'Base'], colors: ['#0a0f14', '#e8edf2', '#3dadb8', '#e8a87c', '#243040'] },
    { id: 'lagoa', name: 'Lagoa', mood: 'Água profunda à noite — turquesa vivo sobre fundo quase preto.', tags: ['Escuro', 'Água'], colors: ['#061018', '#dce9f2', '#2ec4c8', '#7ec8e3', '#1a3044'] },
    { id: 'jacui', name: 'Jacuí', mood: 'Âmbar de alerta + água — rios e Defesa Civil em evidência.', tags: ['Escuro', 'Alertas'], colors: ['#141210', '#f2ece4', '#5ab4c4', '#e8a050', '#3a342c'] },
    { id: 'mare', name: 'Maré', mood: 'Alto contraste cívico — ciano brilhante, alertas saltam aos olhos.', tags: ['Escuro', 'Contraste'], colors: ['#071828', '#f0f6fc', '#48d4f0', '#ffd166', '#1a3a52'] },
    { id: 'crepusculo', name: 'Crepúsculo', mood: 'Entardecer sobre a lagoa — violeta, rosa e azul poéticos.', tags: ['Escuro', 'Poético'], colors: ['#12101f', '#e8e4f8', '#6eb8d4', '#d4a0c8', '#2e2a42'] },
    { id: 'aurora', name: 'Aurora', mood: 'Papel quente e sol — portal público acolhedor para o dia.', tags: ['Claro', 'Acolhedor'], colors: ['#f6f3ee', '#1a2332', '#1d8f9a', '#c47a42', '#e4ddd3'] },
    { id: 'delta', name: 'Delta', mood: 'Margem do Guaíba — areia, barro e verde-água da comunidade.', tags: ['Claro', 'Terroso'], colors: ['#f0ebe3', '#2a241c', '#2a8f8a', '#b86b3a', '#d9cfc0'] },
    { id: 'alvorada', name: 'Alvorada', mood: 'Nascer do sol — pêssego e céu claro, sensação de portal vivo.', tags: ['Claro', 'Solar'], colors: ['#fff8f2', '#2c2220', '#3a9eae', '#e07a52', '#f0e0d4'] },
    { id: 'serra', name: 'Serra', mood: 'Verde-cinza da serra — chuva que desce pelo Jacuí.', tags: ['Claro', 'Chuva'], colors: ['#e8ede9', '#1a2822', '#3d8f7a', '#8a7a4a', '#c5d0c8'] },
    { id: 'neblina', name: 'Neblina', mood: 'Cinza-azul metropolitano — dashboard limpo e técnico.', tags: ['Claro', 'Técnico'], colors: ['#eef2f6', '#0f172a', '#0e7490', '#b45309', '#cbd5e1'] },
    { id: 'bruma', name: 'Bruma', mood: 'Quase monocromático — elegância discreta, conteúdo primeiro.', tags: ['Claro', 'Minimal'], colors: ['#f2f4f5', '#1c1f23', '#4a6fa5', '#6d7379', '#dde1e4'] }
  ];

  var LABELS = ['Fundo', 'Texto', 'Água', 'Comunidade', 'Borda'];

  grid.innerHTML = PALETTES.map(function (p) {
    var swatches = p.colors.map(function (hex, i) {
      return '<div class="palette-swatch" style="background:' + hex + '" title="' + LABELS[i] + ' ' + hex + '"><span>' + hex + '</span></div>';
    }).join('');

    return '<article class="palette-card" data-theme="' + p.id + '">' +
      '<div class="palette-card__head">' +
        '<h2>' + p.name + '</h2>' +
        '<p class="palette-card__mood">' + p.mood + '</p>' +
        '<div class="palette-card__tags">' + p.tags.map(function (t) {
          return '<span class="palette-tag">' + t + '</span>';
        }).join('') + '</div>' +
      '</div>' +
      '<div class="palette-swatches">' + swatches + '</div>' +
      '<div class="palette-demo" data-theme="' + p.id + '">' +
        '<div class="palette-demo__mini">' +
          '<div class="palette-demo__emergency"><strong>EMERGÊNCIA</strong> SAMU 192 · Defesa Civil 199</div>' +
          '<div class="palette-demo__body">' +
            '<div class="palette-demo__row">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--river)" stroke-width="1.6"><path d="M16 13a4 4 0 0 0-8 0"/><path d="M8 17v2M12 17v3M16 17v2"/></svg>' +
              '<span class="palette-demo__value">22°</span>' +
              '<span class="palette-demo__status">Chuva 78%</span>' +
            '</div>' +
            '<span class="palette-demo__btn">Participe</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="palette-card__actions">' +
        '<button type="button" class="palette-apply" data-apply-theme="' + p.id + '">Aplicar</button>' +
        '<a href="preview-home.html">Ver na Home</a>' +
      '</div>' +
    '</article>';
  }).join('');

  document.querySelectorAll('[data-apply-theme]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (window.gzApplyTheme) window.gzApplyTheme(btn.dataset.applyTheme);
    });
  });
})();
