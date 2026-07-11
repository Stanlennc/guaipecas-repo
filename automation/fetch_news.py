#!/usr/bin/env python3
"""
Agrega notícias de Guaíba/RS e da Região Metropolitana de Porto Alegre.
Gera noticias.json para o site consumir.
"""

import base64
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
USER_AGENT = "GuaipecasBot/1.0 (+https://github.com/Stanlennc/guaipecas-repo)"
MAX_ITEMS_HOME = 8
MAX_ITEMS = 30
MAX_IMAGE_FETCH = 28

MEDIA_NS = {"media": "http://search.yahoo.com/mrss/"}
CONTENT_NS = "{http://purl.org/rss/1.0/modules/content/}encoded"
REPORTER_HOME = "https://www.reporterguaibense.com.br/"
REPORTER_ARTICLE_RE = re.compile(
    r"https://www\.reporterguaibense\.com\.br/noticia/[a-z0-9-]+",
    re.I,
)

# Municípios e termos da Região Metropolitana de Porto Alegre (RMPA).
REGIAO_METRO_TERMOS = [
    "porto alegre",
    "região metropolitana",
    "regiao metropolitana",
    "grande porto alegre",
    "metropolitana de porto alegre",
    "rmpa",
    "canoas",
    "gravataí",
    "gravatai",
    "cachoeirinha",
    "viamão",
    "viamao",
    "alvorada",
    "sapucaia do sul",
    "esteio",
    "são leopoldo",
    "sao leopoldo",
    "novo hamburgo",
    "eldorado do sul",
    "charqueadas",
    "triunfo",
    "portão",
    "portao",
    "nova santa rita",
    "guaíba",
    "guaiba",
    "dois irmãos",
    "dois irmaos",
    "ivoti",
    "campo bom",
    "br-116",
    "br 116",
    "freeway",
    "zona sul",
    "zona norte",
    "zona leste",
    "zona oeste",
]

# Feeds testados — diretos (com imagem) primeiro, depois Google Notícias.
FEEDS = [
    {
        "id": "reporter_direto",
        "nome": "Repórter Guaibense",
        "tipo": "scrape_reporter",
        "filtro": "nenhum",
        "prioridade": 11,
    },
    {
        "id": "g1_rs",
        "nome": "G1 RS",
        "url": "https://g1.globo.com/rss/g1/rs/",
        "filtro": "regiao_metro",
        "prioridade": 9,
    },
    {
        "id": "expansao_direto",
        "nome": "Expansão",
        "url": "https://expansao.co/feed/",
        "filtro": "regiao_metro",
        "prioridade": 8,
    },
    {
        "id": "sul21_direto",
        "nome": "Sul21",
        "url": "https://sul21.com.br/feed/",
        "filtro": "regiao_metro",
        "prioridade": 8,
    },
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
        "url": "https://news.google.com/rss/search?q=site:portallitoralsul.com.br+(Gua%C3%ADba+OR+Eldorado+OR+Charqueadas)&hl=pt-BR&gl=BR&ceid=BR:pt-419",
        "filtro": "regiao_metro",
        "prioridade": 9,
    },
    {
        "id": "correio",
        "nome": "Correio do Povo",
        "url": "https://news.google.com/rss/search?q=Gua%C3%ADba+site:correiodopovo.com.br&hl=pt-BR&gl=BR&ceid=BR:pt-419",
        "filtro": "guaiba",
        "prioridade": 9,
    },
    {
        "id": "correio_metro",
        "nome": "Correio do Povo",
        "url": "https://news.google.com/rss/search?q=site:correiodopovo.com.br+regi%C3%A3o+metropolitana+Porto+Alegre&hl=pt-BR&gl=BR&ceid=BR:pt-419",
        "filtro": "regiao_metro",
        "prioridade": 8,
    },
    {
        "id": "gzh_metro",
        "nome": "GZH",
        "url": "https://news.google.com/rss/search?q=site:gauchazh.clicrbs.com.br+regi%C3%A3o+metropolitana&hl=pt-BR&gl=BR&ceid=BR:pt-419",
        "filtro": "regiao_metro",
        "prioridade": 7,
    },
    {
        "id": "vizinhos",
        "nome": "Google Notícias",
        "url": "https://news.google.com/rss/search?q=Gua%C3%ADba+OR+Eldorado+do+Sul+OR+Charqueadas+when:7d&hl=pt-BR&gl=BR&ceid=BR:pt-419",
        "filtro": "regiao_metro",
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
        "id": "metro_recentes",
        "nome": "Google Notícias",
        "url": "https://news.google.com/rss/search?q=regi%C3%A3o+metropolitana+Porto+Alegre+when:7d&hl=pt-BR&gl=BR&ceid=BR:pt-419",
        "filtro": "regiao_metro",
        "prioridade": 7,
    },
    {
        "id": "google",
        "nome": "Google Notícias",
        "url": "https://news.google.com/rss/search?q=Gua%C3%ADba+RS&hl=pt-BR&gl=BR&ceid=BR:pt-419",
        "filtro": "guaiba_cidade",
        "prioridade": 6,
    },
    {
        "id": "metro_poars",
        "nome": "Google Notícias",
        "url": "https://news.google.com/rss/search?q=Porto+Alegre+OR+Canoas+OR+Gravata%C3%AD+when:7d&hl=pt-BR&gl=BR&ceid=BR:pt-419",
        "filtro": "regiao_metro",
        "prioridade": 6,
    },
]

SOURCE_PRIORITY = {
    "repórter guaibense": 10,
    "portal litoral sul": 9,
    "agora rs": 9,
    "g1": 8,
    "correio do povo": 8,
    "expansão": 7,
    "expansao": 7,
    "sul21": 7,
    "defensoria": 7,
    "prefeitura": 7,
    "gzh": 6,
    "zero hora": 6,
    "gauchazh": 5,
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
        r"\bminera[cç][aã]o.*gua[ií]ba\b",
        r"\bareia.*gua[ií]ba\b",
    ]
    return any(re.search(pattern, text) for pattern in river_patterns)


def is_junk_item(item):
    titulo = (item.get("titulo") or "").lower()
    fonte = (item.get("fonte") or "").lower()
    if "moovit" in fonte or "moovit" in titulo:
        return True
    if re.search(r"\bparada\s*$", titulo) and re.search(r"\d{5}", titulo):
        return True
    return False


def mentions_regiao_metro(text):
    if not text:
        return False
    lower = text.lower()
    if is_river_not_city(lower) and not any(
        term in lower for term in ("guaíba", "guaiba", "eldorado", "charqueadas", "porto alegre")
    ):
        return False
    return any(term in lower for term in REGIAO_METRO_TERMOS)


def relevance_boost(item):
    titulo = item.get("titulo", "").lower()
    if mentions_guaiba_city(titulo):
        return 3
    if ("guaíba" in titulo or "guaiba" in titulo) and not is_river_not_city(titulo):
        return 2
    if mentions_regiao_metro(titulo):
        return 1
    return 0


def passes_filter(item, filtro):
    titulo = item.get("titulo", "")
    if filtro == "nenhum":
        return bool(titulo.strip())
    if filtro == "guaiba":
        lower = titulo.lower()
        return ("guaíba" in lower or "guaiba" in lower) and not is_river_not_city(lower)
    if filtro == "guaiba_cidade":
        return mentions_guaiba_city(titulo)
    if filtro == "regiao_metro":
        return mentions_regiao_metro(titulo)
    return True


def source_priority(fonte):
    lower = (fonte or "").lower()
    for key, score in SOURCE_PRIORITY.items():
        if key in lower:
            return score
    return 5


def image_from_rss_item(item_el):
    """Extrai URL de imagem do item RSS (media:content, media:thumbnail, enclosure)."""
    for tag in ("media:content", "media:thumbnail"):
        el = item_el.find(tag, MEDIA_NS)
        if el is not None:
            url = (el.get("url") or "").strip()
            if url.startswith("http"):
                return url

    enclosure = item_el.find("enclosure")
    if enclosure is not None:
        url = (enclosure.get("url") or "").strip()
        enc_type = (enclosure.get("type") or "").lower()
        if url.startswith("http") and enc_type.startswith("image/"):
            return url
    return None


def normalize_image_url(url):
    if not url:
        return None
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        return None
    if any(bad in url.lower() for bad in (
        "favicon", "logo.", "/icon", "pixel", "1x1", "social-image",
        "logo_site", "logo-site", "logo_viacao", "sicredi",
    )):
        return None
    return url


def strip_html_text(html):
    if not html:
        return ""
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    for old, new in (("&nbsp;", " "), ("&amp;", "&"), ("&quot;", '"'), ("&#39;", "'"), ("&lt;", "<"), ("&gt;", ">")):
        text = text.replace(old, new)
    return text


def clean_resumo(text):
    if not text:
        return None
    text = strip_html_text(text) if "<" in text else text.strip()
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) < 40:
        return None
    return text[:600].rstrip() + ("…" if len(text) > 600 else "")


def extract_og_description(html):
    if not html:
        return None
    patterns = (
        r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:description["\']',
        r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']description["\']',
    )
    for pattern in patterns:
        match = re.search(pattern, html, re.I)
        if match:
            return clean_resumo(match.group(1))
    return None


def resumo_from_rss_item(item_el):
    for tag in (CONTENT_NS, "description"):
        block = item_el.find(tag)
        if block is not None and block.text:
            resumo = clean_resumo(block.text)
            if resumo:
                return resumo
    return None


def extract_og_image(html):
    if not html:
        return None
    patterns = [
        r'<meta[^>]+property=["\']og:image(?::secure_url)?["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image(?::secure_url)?["\']',
        r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)["\']',
    ]
    for pattern in patterns:
        match = re.search(pattern, html, re.I)
        if match:
            return normalize_image_url(match.group(1))
    return None


def decode_google_news_url(url):
    """Extrai URL da matéria original embutida no link do Google Notícias."""
    if "/articles/" not in url:
        return url

    article_id = url.split("/articles/")[1].split("?")[0]
    decoders = (
        lambda s: base64.urlsafe_b64decode(s),
        lambda s: base64.b64decode(s),
    )
    for decoder in decoders:
        for padding in range(4):
            try:
                decoded = decoder(article_id + "=" * padding)
            except Exception:
                continue

            for prefix in range(0, min(80, len(decoded))):
                chunk = decoded[prefix:]
                match = re.search(
                    rb"https?://[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+",
                    chunk,
                )
                if not match:
                    continue
                candidate = match.group(0).decode("utf-8", errors="ignore").rstrip(".,;)")
                if "google.com" in candidate or "gstatic.com" in candidate:
                    continue
                return candidate
    return url


def image_from_html(html):
    if not html:
        return None
    for pattern in (
        r'<img[^>]+src=["\']([^"\']+)["\']',
        r'<img[^>]+data-src=["\']([^"\']+)["\']',
    ):
        for match in re.finditer(pattern, html, re.I):
            img = normalize_image_url(match.group(1))
            if img:
                return img
    return None


def fetch_article_meta(url):
    """Busca imagem e resumo na página da matéria (og: tags)."""
    if not url:
        return None, None

    target = decode_google_news_url(url)
    headers = {"User-Agent": USER_AGENT}
    try:
        resp = requests.get(target, headers=headers, timeout=12, allow_redirects=True)
        resp.raise_for_status()
        if "text/html" not in (resp.headers.get("Content-Type") or "").lower():
            return None, None
        html = resp.text[:150000]
        return (
            extract_og_image(html) or image_from_html(html),
            extract_og_description(html),
        )
    except Exception as exc:
        print(f"meta {target[:60]}: {exc}", file=sys.stderr)
        return None, None


def fetch_article_image(url):
    """Busca imagem na página da matéria (og:image ou primeira img relevante)."""
    img, _ = fetch_article_meta(url)
    return img


PT_MONTHS = {
    "janeiro": 1, "fevereiro": 2, "março": 3, "marco": 3, "abril": 4,
    "maio": 5, "junho": 6, "julho": 7, "agosto": 8, "setembro": 9,
    "outubro": 10, "novembro": 11, "dezembro": 12,
}


def parse_pt_date(text):
    if not text:
        return None
    match = re.search(
        r"(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})",
        text.lower(),
        re.I,
    )
    if not match:
        return None
    day, month_name, year = match.groups()
    month = PT_MONTHS.get(month_name)
    if not month:
        return None
    try:
        return datetime(int(year), month, int(day), tzinfo=timezone.utc)
    except ValueError:
        return None


def extract_page_meta(html):
    """Extrai título, imagem, data e resumo de uma página HTML."""
    if not html:
        return None, None, None, None
    title = None
    for pattern in (
        r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:title["\']',
        r"<title>([^<]+)</title>",
    ):
        match = re.search(pattern, html, re.I)
        if match:
            title = match.group(1).strip()
            break
    if title:
        title = re.sub(r"\s*[-|]\s*Repórter Guaibense\s*$", "", title, flags=re.I)
        title = re.sub(r"\s+", " ", title).strip()

    image = extract_og_image(html) or image_from_html(html)
    published = None
    for pattern in (
        r'<meta[^>]+property=["\']article:published_time["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']article:published_time["\']',
        r'<time[^>]+datetime=["\']([^"\']+)["\']',
    ):
        match = re.search(pattern, html, re.I)
        if match:
            published = match.group(1).strip()
            break
    if not published:
        pt_match = re.search(
            r"(\d{1,2}\s+de\s+[A-Za-zç]+\s+de\s+\d{4})",
            html[:120000],
            re.I,
        )
        if pt_match:
            published = pt_match.group(1)
    resumo = extract_og_description(html)
    return title, image, published, resumo


def parse_published_value(value):
    if not value:
        return None
    if re.search(r"\d{1,2}\s+de\s+", value, re.I):
        return parse_pt_date(value)
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        return parse_date(value)


def scrape_reporter_home(max_items=14):
    """Coleta notícias e imagens direto do site do Repórter Guaibense."""
    headers = {"User-Agent": USER_AGENT}
    try:
        resp = requests.get(REPORTER_HOME, headers=headers, timeout=20)
        resp.raise_for_status()
        html = resp.text
    except Exception as exc:
        print(f"reporter_direto: {exc}", file=sys.stderr)
        return []

    urls = []
    seen = set()
    for match in REPORTER_ARTICLE_RE.finditer(html):
        url = match.group(0).rstrip("/")
        if url in seen:
            continue
        seen.add(url)
        urls.append(url)

    items = []
    for url in urls[:max_items]:
        try:
            page = requests.get(url, headers=headers, timeout=15)
            page.raise_for_status()
            titulo, imagem, published, resumo = extract_page_meta(page.text[:160000])
            if not titulo:
                continue
            pub_dt = parse_published_value(published)

            entry = {
                "id": hashlib.sha1(url.encode("utf-8")).hexdigest()[:12],
                "titulo": titulo,
                "url": url,
                "fonte": "Repórter Guaibense",
                "publicado_em": pub_dt.isoformat() if pub_dt else None,
                "categoria": None,
                "feed": "reporter_direto",
                "prioridade": 11,
            }
            if imagem:
                entry["imagem"] = imagem
                entry["imagem_credito"] = "Repórter Guaibense"
            if resumo:
                entry["resumo"] = resumo
            if passes_filter(entry, "nenhum") and not is_junk_item(entry):
                items.append(entry)
        except Exception as exc:
            print(f"reporter artigo {url[:50]}: {exc}", file=sys.stderr)
    print(f"reporter_direto: {len(items)} itens com imagem", file=sys.stderr)
    return items


def enrich_metadata(noticias):
    """Preenche imagem, resumo e crédito quando a fonte original publica metadados."""
    pending = [
        item for item in noticias
        if not item.get("imagem") or not item.get("resumo")
    ]
    direct = [item for item in pending if "news.google.com" not in (item.get("url") or "")]
    google = [item for item in pending if item not in direct]
    fetched = 0

    for item in direct + google:
        if fetched >= MAX_IMAGE_FETCH:
            break
        if item.get("imagem") and item.get("resumo"):
            continue
        img, resumo = fetch_article_meta(item.get("url"))
        fetched += 1
        if img and not item.get("imagem"):
            item["imagem"] = img
            item["imagem_credito"] = item.get("fonte")
            print(f"imagem og: {item['titulo'][:50]}…", file=sys.stderr)
        if resumo and not item.get("resumo"):
            item["resumo"] = resumo
            print(f"resumo og: {item['titulo'][:50]}…", file=sys.stderr)

    for item in noticias:
        if item.get("imagem"):
            item.setdefault("imagem_credito", item.get("fonte"))
    return noticias


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

        rss_image = normalize_image_url(image_from_rss_item(item_el))
        if not rss_image:
            for tag in (CONTENT_NS, "description"):
                block = item_el.find(tag)
                if block is not None and block.text:
                    rss_image = normalize_image_url(image_from_html(block.text))
                    if rss_image:
                        break
        if rss_image:
            entry["imagem"] = rss_image
            entry["imagem_credito"] = fonte

        resumo = resumo_from_rss_item(item_el)
        if resumo:
            entry["resumo"] = resumo

        if passes_filter(entry, feed_cfg.get("filtro")) and not is_junk_item(entry):
            items.append(entry)

    return items


def dedupe_and_sort(items):
    seen = {}

    def item_rank(it):
        pub = it.get("publicado_em")
        if not pub:
            dt = datetime.min.replace(tzinfo=timezone.utc)
        else:
            try:
                dt = datetime.fromisoformat(pub.replace("Z", "+00:00"))
            except ValueError:
                dt = datetime.min.replace(tzinfo=timezone.utc)
        has_img = 1 if it.get("imagem") else 0
        direct = 1 if it.get("feed") in {"reporter_direto", "g1_rs", "expansao_direto", "sul21_direto"} else 0
        return (item_rank_score(it), has_img, direct, relevance_boost(it), dt, it.get("prioridade", 5))

    def item_rank_score(it):
        if it.get("feed") == "reporter_direto":
            return 2
        if it.get("feed") in {"g1_rs", "expansao_direto", "sul21_direto"}:
            return 1
        return 0

    for item in items:
        key = re.sub(r"[^a-z0-9]+", "", item["titulo"].lower())[:80]
        current = seen.get(key)
        if current is None or item_rank(item) > item_rank(current):
            seen[key] = item

    unique = list(seen.values())

    def sort_key(item):
        pub = item.get("publicado_em")
        if not pub:
            dt = datetime.min.replace(tzinfo=timezone.utc)
        else:
            try:
                dt = datetime.fromisoformat(pub.replace("Z", "+00:00"))
            except ValueError:
                dt = datetime.min.replace(tzinfo=timezone.utc)
        has_img = 1 if item.get("imagem") else 0
        direct = 1 if item.get("feed") in {"reporter_direto", "g1_rs", "expansao_direto", "sul21_direto"} else 0
        return (relevance_boost(item), has_img, direct, item_rank_score(item), dt, item.get("prioridade", 5))

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
        "<description>Notícias de Guaíba e da Região Metropolitana de Porto Alegre</description>",
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
        if feed.get("tipo") == "scrape_reporter":
            parsed = scrape_reporter_home()
        else:
            xml_text = fetch_xml(feed["url"])
            if not xml_text:
                continue
            parsed = parse_rss(xml_text, feed)
        print(f"{feed['id']}: {len(parsed)} itens", file=sys.stderr)
        collected.extend(parsed)

    noticias = dedupe_and_sort(collected)
    noticias = enrich_metadata(noticias)
    noticias_home = noticias[:MAX_ITEMS_HOME]

    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "fontes": [
            {
                "id": feed["id"],
                "nome": feed["nome"],
                "url": feed.get("url", REPORTER_HOME),
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
