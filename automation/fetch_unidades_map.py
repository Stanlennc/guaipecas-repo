#!/usr/bin/env python3
"""Gera coordenadas aproximadas das unidades de saúde para o mapa."""

import json
import re
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
SAUDE_HTML = ROOT / "saude.html"
OUTPUT = ROOT / "unidades-map.json"
USER_AGENT = "GuaipecasBot/1.0 (geocode)"

# Fallback por bairro conhecido no nome da unidade
BAIRRO_COORDS = {
    "centro": (-30.1137, -51.3266),
    "cohab": (-30.0985, -51.3195),
    "colina": (-30.1082, -51.3381),
    "columbia": (-30.1215, -51.3012),
    "iolanda": (-30.1055, -51.3455),
    "primavera": (-30.1178, -51.3512),
    "pedras": (-30.1295, -51.3125),
    "são francisco": (-30.1195, -51.3188),
    "sao francisco": (-30.1195, -51.3188),
    "ipê": (-30.1012, -51.3298),
    "ipe": (-30.1012, -51.3298),
    "garibaldi": (-30.1255, -51.3345),
    "vila nova": (-30.1088, -51.3155),
    "industrial": (-30.1165, -51.3055),
}


def guess_coords(name):
    lower = name.lower()
    for key, coords in BAIRRO_COORDS.items():
        if key in lower:
            return coords
    return (-30.1137, -51.3266)


def geocode(name):
    query = f"{name}, Guaíba, RS, Brasil"
    url = "https://nominatim.openstreetmap.org/search"
    try:
        resp = requests.get(
            url,
            params={"q": query, "format": "json", "limit": 1},
            headers={"User-Agent": USER_AGENT},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception as exc:
        print(f"geocode falhou {name}: {exc}", file=sys.stderr)
    return guess_coords(name)


def parse_units():
    html = SAUDE_HTML.read_text(encoding="utf-8")
    soup = BeautifulSoup(html, "html.parser")
    units = []
    for row in soup.select("#dataList .data-row"):
        name_el = row.select_one(".name")
        cat_el = row.select_one(".cat")
        link_el = row.select_one("a.link")
        if not name_el:
            continue
        units.append({
            "nome": name_el.get_text(strip=True),
            "categoria": cat_el.get_text(strip=True) if cat_el else "",
            "cnes_url": link_el["href"] if link_el else "",
            "data_cat": row.get("data-cat", ""),
        })
    return units


def main():
    units = parse_units()
    mapped = []
    for unit in units:
        lat, lon = guess_coords(unit["nome"])
        mapped.append({**unit, "lat": lat, "lon": lon})

    payload = {"gerado_em": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "unidades": mapped}
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    js_path = ROOT / "unidades-map-data.js"
    js_path.write_text(
        "window.GUIUNIDADES_DATA = " + json.dumps(payload, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )
    print(f"Salvo {len(mapped)} unidades", file=sys.stderr)


if __name__ == "__main__":
    main()
