#!/usr/bin/env python3
"""Atualiza marca Guaipecaz no nav das páginas públicas."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SKIP = {
    "preview-glass.html",
    "preview-home.html",
    "preview-layouts.html",
    "preview-paletas.html",
    "preview-fontes.html",
    "preview-regiao.html",
}


def patch_html(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    orig = text

    text = text.replace("Guaipecas · Guaíba em Dia", "Guaipecaz · Guaíba e região")
    text = text.replace("Portal cidadão · Guaíba/RS", "Guaíba e região")
    text = text.replace("Guaipecas", "Guaipecaz")

    text = re.sub(r'script\.js\?v=\d+', 'script.js?v=9', text)
    if 'script.js?v=' not in text and 'script.js"' in text:
        text = text.replace('script.js"', 'script.js?v=9"')

    if text != orig:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main():
    changed = []
    for path in sorted(ROOT.glob("*.html")):
        if path.name in SKIP:
            continue
        if patch_html(path):
            changed.append(path.name)
    print("Atualizados:", ", ".join(changed) or "(nenhum)")


if __name__ == "__main__":
    main()
