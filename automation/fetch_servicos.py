#!/usr/bin/env python3
"""Coleta links e dados de serviços municipais + agenda + notícias oficiais."""

import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "servicos.json"
BASE = "https://guaiba.atende.net"
USER_AGENT = "Mozilla/5.0 (compatible; GuaipecasBot/1.0)"


def scrape_prefeitura_noticias():
    items = []
    try:
        resp = requests.get(f"{BASE}/cidadao/noticia", headers={"User-Agent": USER_AGENT}, timeout=25)
        resp.raise_for_status()
        slugs = sorted(set(re.findall(r"/cidadao/noticia/[a-z0-9\-]+", resp.text)))
        for slug in slugs:
            url = urljoin(BASE, slug)
            title = slug.split("/")[-1].replace("-", " ").strip()
            title = title[:1].upper() + title[1:]
            items.append({
                "id": hashlib.sha1(url.encode()).hexdigest()[:12],
                "titulo": title,
                "url": url,
                "fonte": "Prefeitura de Guaíba",
                "tipo": "oficial",
            })
    except Exception as exc:
        print(f"noticias prefeitura: {exc}", file=sys.stderr)
    return items


def scrape_agenda():
    eventos = []
    keywords = ("evento", "feira", "mutirão", "inaugura", "festival", "campeonato", "palestra", "workshop")
    for item in scrape_prefeitura_noticias():
        lower = item["titulo"].lower()
        if any(k in lower for k in keywords) or "projeto" in lower or "cronograma" in lower:
            eventos.append({**item, "tipo": "agenda"})
    return eventos[:8]


def main():
    noticias_oficiais = scrape_prefeitura_noticias()
    agenda = scrape_agenda()

    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "farmacia_plantao": {
            "titulo": "Farmácia de plantão",
            "descricao": "A escala oficial é publicada pela Prefeitura e pelo conselho regional. Confira o endereço da farmácia aberta hoje.",
            "url": f"{BASE}/cidadao/pagina/informacoes-saude",
            "url_busca": "https://www.crf-rs.org.br/",
            "telefone_saude": "(51) 3480-7000",
        },
        "onibus": {
            "titulo": "Horários de ônibus",
            "descricao": "Linhas e horários do transporte coletivo municipal — fonte oficial da Prefeitura.",
            "url": f"{BASE}/#!/tipo/noticia/valor/19593",
            "url_pagina": f"{BASE}/cidadao/pagina/transporte-coletivo",
        },
        "coleta": {
            "titulo": "Coleta de lixo",
            "descricao": "Calendário e orientações de coleta domiciliar em Guaíba.",
            "url": f"{BASE}/cidadao/pagina/coleta-de-lixo",
        },
        "agenda": agenda,
        "noticias_oficiais": noticias_oficiais,
    }

    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    js_path = ROOT / "servicos-data.js"
    js_path.write_text(
        "window.GUISERVICOS_DATA = " + json.dumps(payload, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )
    print(
        f"Salvo servicos: {len(noticias_oficiais)} notícias oficiais, {len(agenda)} agenda",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
