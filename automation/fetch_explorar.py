#!/usr/bin/env python3
"""Gera explorar.json + explorar-data.js a partir de explorar.seed.json (só pontos turísticos)."""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED_PATH = ROOT / "explorar.seed.json"
OUTPUT_JSON = ROOT / "explorar.json"
OUTPUT_JS = ROOT / "explorar-data.js"


def load_json(path: Path):
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def pontos_turisticos_to_itens(pontos: list) -> list[dict]:
    out = []
    for p in pontos or []:
        item = dict(p)
        item.setdefault("tipo", "lugar")
        item.setdefault("mapa", True)
        item["curado"] = True
        # url legado virava link do card; site oficial fica só no popup do mapa
        if item.get("url"):
            item.setdefault("site_url", item["url"])
            del item["url"]
        out.append(item)
    return out


def main():
    seed = load_json(SEED_PATH)
    if not seed:
        print("explorar.seed.json não encontrado", file=sys.stderr)
        sys.exit(1)

    pontos = pontos_turisticos_to_itens(seed.get("pontos_turisticos") or [])

    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "lede": seed.get("lede"),
        "cidades": seed.get("cidades") or ["guaiba", "poa", "canoas"],
        "perfis": seed.get("perfis") or {},
        "fim_de_semana": seed.get("fim_de_semana") or [],
        "itens": pontos,
    }

    for item in payload["itens"]:
        for k in list(item.keys()):
            if item[k] is None:
                del item[k]

    OUTPUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUTPUT_JS.write_text(
        "window.GUIEXPLORAR_DATA = " + json.dumps(payload, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )
    print(f"Salvo {len(pontos)} pontos turísticos em {OUTPUT_JSON.name}", file=sys.stderr)


if __name__ == "__main__":
    main()
