#!/usr/bin/env python3
"""Regenera apoio-data.js com geocodificação dos pontos no mapa."""

import json
import sys
import time
from pathlib import Path

from geocode_lib import apply_geocode_point

ROOT = Path(__file__).resolve().parent.parent
INPUT = ROOT / "apoio.json"
OUTPUT = ROOT / "apoio-data.js"


def main():
    data = json.loads(INPUT.read_text(encoding="utf-8"))
    pontos = []
    for i, ponto in enumerate(data.get("pontos", []), 1):
        if not ponto.get("mapa") or not ponto.get("endereco"):
            pontos.append(ponto)
            continue
        cidade = ponto.get("cidade", "guaiba")
        if cidade == "todas":
            pontos.append(ponto)
            continue
        print(f"[{i}] {cidade}: {ponto.get('nome', '')}", file=sys.stderr)
        pontos.append(apply_geocode_point(ponto, cidade))
    data["pontos"] = pontos
    data["gerado_em"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    INPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUTPUT.write_text(
        "window.GUIAPOIO_DATA = " + json.dumps(data, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )
    ok = sum(1 for p in pontos if p.get("geocode_fonte") == "nominatim")
    print(f"Salvo {len(pontos)} pontos ({ok} geocodificados) em {OUTPUT.name}", file=sys.stderr)


if __name__ == "__main__":
    main()
