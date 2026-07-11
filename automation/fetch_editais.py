#!/usr/bin/env python3
"""Agrega editais e publicações oficiais de Guaíba via Google Notícias / RSS."""

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
OUTPUT = ROOT / "editais.json"
USER_AGENT = "GuaipecasBot/1.0"
MAX_ITEMS = 12

FEEDS = [
    {
        "id": "concurso",
        "url": "https://news.google.com/rss/search?q=concurso+Gua%C3%ADba&hl=pt-BR&gl=BR&ceid=BR:pt-419",
        "tipo": "concurso",
    },
    {
        "id": "edital",
        "url": "https://news.google.com/rss/search?q=edital+Gua%C3%ADba&hl=pt-BR&gl=BR&ceid=BR:pt-419",
        "tipo": "edital",
    },
    {
        "id": "licitacao",
        "url": "https://news.google.com/rss/search?q=licita%C3%A7%C3%A3o+Gua%C3%ADba&hl=pt-BR&gl=BR&ceid=BR:pt-419",
        "tipo": "licitacao",
    },
    {
        "id": "famurs",
        "url": "https://news.google.com/rss/search?q=Gua%C3%ADba+site:diariomunicipal.com.br&hl=pt-BR&gl=BR&ceid=BR:pt-419",
        "tipo": "diario",
    },
    {
        "id": "vagas",
        "url": "https://news.google.com/rss/search?q=vagas+emprego+Gua%C3%ADba&hl=pt-BR&gl=BR&ceid=BR:pt-419",
        "tipo": "vaga",
    },
]

KEYWORDS_VAGA = ("vaga", "emprego", "seleção", "processo seletivo", "contratação")
KEYWORDS_EDITAL = ("edital", "concurso", "licita", "pregão", "chamamento", "seleção pública")


def fetch_xml(url):
    try:
        resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=20)
        resp.raise_for_status()
        return resp.text
    except Exception as exc:
        print(f"Erro: {url}: {exc}", file=sys.stderr)
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


def mentions_guaiba(title):
    lower = title.lower()
    return "guaíba" in lower or "guaiba" in lower


def parse_feed(xml_text, feed_cfg):
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return []

    items = []
    for item_el in root.findall(".//item"):
        title_el = item_el.find("title")
        link_el = item_el.find("link")
        date_el = item_el.find("pubDate")
        titulo = clean_title(title_el.text if title_el is not None else "")
        url = (link_el.text or "").strip() if link_el is not None else ""
        if not titulo or not url or not mentions_guaiba(titulo):
            continue
        source_el = item_el.find("source")
        fonte = source_el.text.strip() if source_el is not None and source_el.text else "Fonte"
        pub = parse_date(date_el.text if date_el is not None else None)
        tipo = feed_cfg["tipo"]
        lower = titulo.lower()
        if tipo == "vaga" and not any(k in lower for k in KEYWORDS_VAGA):
            continue
        if tipo in ("edital", "concurso", "licitacao", "diario") and not any(
            k in lower for k in KEYWORDS_EDITAL + KEYWORDS_VAGA
        ):
            if tipo != "diario":
                continue
        items.append({
            "id": hashlib.sha1(url.encode()).hexdigest()[:12],
            "titulo": titulo,
            "url": url,
            "fonte": fonte,
            "tipo": tipo,
            "publicado_em": pub.isoformat() if pub else None,
            "feed": feed_cfg["id"],
        })
    return items


def dedupe_sort(items):
    seen = set()
    out = []
    for item in items:
        key = re.sub(r"[^a-z0-9]+", "", item["titulo"].lower())[:80]
        if key in seen:
            continue
        seen.add(key)
        out.append(item)

    def sort_key(it):
        v = it.get("publicado_em")
        if not v:
            return datetime.min.replace(tzinfo=timezone.utc)
        try:
            return datetime.fromisoformat(v.replace("Z", "+00:00"))
        except ValueError:
            return datetime.min.replace(tzinfo=timezone.utc)

    out.sort(key=sort_key, reverse=True)
    return out[:MAX_ITEMS]


def write_js(payload):
    js_path = ROOT / "editais-data.js"
    js_path.write_text(
        "window.GUIEDITAIS_DATA = " + json.dumps(payload, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )


def main():
    collected = []
    for feed in FEEDS:
        xml = fetch_xml(feed["url"])
        if not xml:
            continue
        parsed = parse_feed(xml, feed)
        print(f"{feed['id']}: {len(parsed)}", file=sys.stderr)
        collected.extend(parsed)

    editais = dedupe_sort(collected)
    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "fonte_oficial": "https://www.diariomunicipal.com.br/famurs/pesquisar",
        "entidade_famurs": "963876",
        "editais": editais,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_js(payload)
    print(f"Salvo {len(editais)} editais", file=sys.stderr)


if __name__ == "__main__":
    main()
