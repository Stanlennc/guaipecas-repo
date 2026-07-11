#!/usr/bin/env python3
"""
Agrega notícias sobre Guaíba/RS de feeds RSS públicos.
Gera noticias.json para o site consumir.
"""

import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "noticias.json"
USER_AGENT = "GuaipecasBot/1.0 (+https://github.com/guaipecas)"
MAX_ITEMS_HOME = 8
MAX_ITEMS = 24

# Feeds testados — prioridade local primeiro.
FEEDS = [
    {
        "id": "reporter",
        "nome": "Repórter Guaibense",
        "url": "https://news.google.com/rss/search?q=site:reporterguaibense.com.br&hl=pt-BR&gl=BR&ceid=BR:pt-419",
        "filtro": "nenhum",
        "prioridade": 10,
    },
    {
        "id": "litoral",
        "nome": "Portal Litoral Sul",
        "url": "https://news.google.com/rss/search?q=site:portallitoralsul.com.br+Gua%C3%ADba&hl=pt-BR&gl=BR&ceid=BR:pt-419",
        "filtro": "guaiba",
        "prioridade": 9,
    },
    {
        "id": "correio",
        "nome": "Correio do Povo",
        "url": "https://news.google.com/rss/search?q=Gua%C3%ADba+site:correiodopovo.com.br&hl=pt-BR&gl=BR&ceid=BR:pt-419",
        "filtro": "guaiba",
        "prioridade": 8,
    },
    {
        "id": "recentes",
        "nome": "Google Notícias",
        "url": "https://news.google.com/rss/search?q=Gua%C3%ADba+when:7d&hl=pt-BR&gl=BR&ceid=BR:pt-419",
        "filtro": "guaiba_cidade",
        "prioridade": 7,
    },
    {
        "id": "google",
        "nome": "Google Notícias",
        "url": "https://news.google.com/rss/search?q=Gua%C3%ADba+RS&hl=pt-BR&gl=BR&ceid=BR:pt-419",
        "filtro": "guaiba_cidade",
        "prioridade": 6,
    },
]

SOURCE_PRIORITY = {
    "repórter guaibense": 10,
    "portal litoral sul": 9,
    "agora rs": 9,
    "correio do povo": 8,
    "defensoria": 7,
    "prefeitura": 7,
    "g1": 4,
    "gzh": 4,
}


def fetch_xml(url):
    headers = {"User-Agent": USER_AGENT}
    try:
        resp = requests.get(url, headers=headers, timeout=20)
        resp.raise_for_status()
        return resp.text
    except Exception as exc:
        print(f"Erro ao acessar {url}: {exc}", file=sys.stderr)
        return None


def parse_date(value):
    if not value:
        return None
    try:
        dt = parsedate_to_datetime(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def clean_title(title):
    if not title:
        return ""
    title = re.sub(r"\s+-\s+[^-]+$", "", title.strip())
    return re.sub(r"\s+", " ", title)


def mentions_guaiba_city(text):
    if not text:
        return False
    lower = text.lower()
    if "guaíba" not in lower and "guaiba" not in lower:
        return False
    if is_river_not_city(lower):
        return False
    if re.search(r"\bem\s+gua[ií]ba\b", lower):
        return True
    if re.search(r"\bgua[ií]ba/rs\b", lower):
        return True
    if re.search(r"\bgua[ií]ba\s*\(", lower):
        return True
    if re.search(r"prefeitura de gua[ií]ba", lower):
        return True
    if re.search(r"munic[ií]pio de gua[ií]ba", lower):
        return True
    if re.search(r"cidade de gua[ií]ba", lower):
        return True
    if re.search(r"cidade inteligente gua[ií]ba", lower):
        return True
    if re.search(r"projeto terra", lower):
        return True
    if re.search(r"guaibense", lower):
        return True
    if re.search(r"hospital de gua[ií]ba", lower):
        return True
    if re.search(r"escola.*gua[ií]ba|gua[ií]ba.*escola", lower):
        return True
    return "guaíba" in lower or "guaiba" in lower


def is_river_not_city(text):
    river_patterns = [
        r"\brio gua[ií]ba\b",
        r"\bn[ií]vel.*gua[ií]ba\b",
        r"\bareia.*gua[ií]ba\b",
        r"\bextração.*gua[ií]ba\b",
        r"\bretirada de areia\b",
        r"\bn[ií]vel do gua[ií]ba\b",
        r"\bgua[ií]ba recua\b",
        r"\bcheia.*porto alegre\b",
        r"\benchente.*porto alegre\b",
        r"\belevação do n[ií]vel\b",
    ]
    return any(re.search(pattern, text) for pattern in river_patterns)


def passes_filter(item, filtro):
    titulo = item.get("titulo", "")
    if filtro == "nenhum":
        return bool(titulo.strip())
    if filtro == "guaiba":
        lower = titulo.lower()
        return ("guaíba" in lower or "guaiba" in lower) and not is_river_not_city(lower)
    if filtro == "guaiba_cidade":
        return mentions_guaiba_city(titulo)
    return True


def source_priority(fonte):
    lower = (fonte or "").lower()
    for key, score in SOURCE_PRIORITY.items():
        if key in lower:
            return score
    return 5


def source_from_item(item_el, default_fonte):
    source_el = item_el.find("source")
    if source_el is not None and source_el.text:
        return source_el.text.strip()
    return default_fonte


def parse_rss(xml_text, feed_cfg):
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as exc:
        print(f"XML inválido ({feed_cfg['id']}): {exc}", file=sys.stderr)
        return []

    channel = root.find("channel")
    if channel is None:
        return []

    default_fonte = feed_cfg.get("nome", "Fonte")
    base_priority = feed_cfg.get("prioridade", 5)
    items = []

    for item_el in channel.findall("item"):
        title_el = item_el.find("title")
        link_el = item_el.find("link")
        date_el = item_el.find("pubDate")

        titulo = clean_title(title_el.text if title_el is not None else "")
        url = (link_el.text or "").strip() if link_el is not None else ""
        if not titulo or not url or titulo.strip() in {"-", "Repórter Guaibense"}:
            continue

        pub = parse_date(date_el.text if date_el is not None else None)
        fonte = source_from_item(item_el, default_fonte)

        category_el = item_el.find("category")
        categoria = category_el.text.strip() if category_el is not None and category_el.text else None

        entry = {
            "id": hashlib.sha1(url.encode("utf-8")).hexdigest()[:12],
            "titulo": titulo,
            "url": url,
            "fonte": fonte,
            "publicado_em": pub.isoformat() if pub else None,
            "categoria": categoria,
            "feed": feed_cfg["id"],
            "prioridade": max(base_priority, source_priority(fonte)),
        }

        if passes_filter(entry, feed_cfg.get("filtro")):
            items.append(entry)

    return items


def dedupe_and_sort(items):
    seen = set()
    unique = []
    for item in items:
        key = re.sub(r"[^a-z0-9]+", "", item["titulo"].lower())[:80]
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)

    def sort_key(item):
        pub = item.get("publicado_em")
        if not pub:
            dt = datetime.min.replace(tzinfo=timezone.utc)
        else:
            try:
                dt = datetime.fromisoformat(pub.replace("Z", "+00:00"))
            except ValueError:
                dt = datetime.min.replace(tzinfo=timezone.utc)
        return (dt, item.get("prioridade", 5))

    unique.sort(key=sort_key, reverse=True)
    trimmed = unique[:MAX_ITEMS]
    for item in trimmed:
        item.pop("prioridade", None)
    return trimmed


def write_rss(noticias):
    rss_path = ROOT / "noticias.rss"
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0"><channel>',
        "<title>Guibanews — Guaipecas</title>",
        "<link>https://guaipecas.github.io/</link>",
        "<description>Notícias sobre Guaíba/RS</description>",
        "<language>pt-BR</language>",
    ]
    for item in noticias[:20]:
        title = item["titulo"].replace("&", "&amp;").replace("<", "&lt;")
        url = item["url"]
        pub = item.get("publicado_em") or ""
        lines.append("<item>")
        lines.append(f"<title>{title}</title>")
        lines.append(f"<link>{url}</link>")
        lines.append(f"<guid>{item['id']}</guid>")
        if pub:
            lines.append(f"<pubDate>{pub}</pubDate>")
        fonte = item.get("fonte", "").replace("&", "&amp;")
        lines.append(f"<source>{fonte}</source>")
        lines.append("</item>")
    lines.append("</channel></rss>")
    rss_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    collected = []

    for feed in FEEDS:
        xml_text = fetch_xml(feed["url"])
        if not xml_text:
            continue
        parsed = parse_rss(xml_text, feed)
        print(f"{feed['id']}: {len(parsed)} itens", file=sys.stderr)
        collected.extend(parsed)

    noticias = dedupe_and_sort(collected)
    noticias_home = noticias[:MAX_ITEMS_HOME]

    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "fontes": [
            {
                "id": feed["id"],
                "nome": feed["nome"],
                "url": feed["url"],
            }
            for feed in FEEDS
        ],
        "noticias": noticias,
        "noticias_home": noticias_home,
    }

    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    js_path = ROOT / "noticias-data.js"
    js_path.write_text(
        "window.GUIBANEWS_DATA = " + json.dumps(payload, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )
    write_rss(noticias)
    print(f"Salvo {len(noticias)} notícias ({len(noticias_home)} na home) em {OUTPUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
