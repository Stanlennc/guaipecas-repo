#!/usr/bin/env python3
"""
Busca ofertas dos supermercados de Guaíba via web scraping.
Gera um arquivo ofertas.json para o site consumir.
"""

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "ofertas.json"
JS_OUTPUT = ROOT / "ofertas-data.js"

# ------------------------------------------------------------
# 1. Configuração de cada mercado
# ------------------------------------------------------------

MARKETS = {
    "stok": {
        "name": "Stok Center",
        "url": "https://www.stokonline.com.br/ofertas",
        "color": "#48d4f0",
        "banner_fallback": "assets/banners/stok.png",
        "scraper": "scrape_stok"
    },
    "indio": {
        "name": "Supermercado Índio",
        "url": "https://supermercadosindio.app.br/promocoes",
        "color": "#4ec9a0",
        "banner_fallback": "assets/banners/indio.png",
        "scraper": "scrape_indio"
    },
    "paulinho": {
        "name": "Supermercado Paulinho",
        "url": "https://supermercadopaulinho.com.br/promocoes",
        "color": "#ffd166",
        "banner_fallback": "assets/banners/paulinho.png",
        "scraper": "scrape_paulinho"
    },
}

# ------------------------------------------------------------
# 2. Funções de scraping para cada mercado
# ------------------------------------------------------------

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
BANNERS_DIR = ROOT / "assets" / "banners"


def fetch_html(url):
    """Baixa o HTML da página com um cabeçalho simples."""
    headers = {"User-Agent": USER_AGENT}
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        return resp.text
    except Exception as e:
        print(f"Erro ao acessar {url}: {e}", file=sys.stderr)
        return None


def _normalize_url(url, base=None):
    if not url:
        return None
    url = url.strip()
    if url.startswith("//"):
        url = "https:" + url
    elif url.startswith("/") and base:
        url = urljoin(base, url)
    return url


def _ibecom_from_og(og_url):
    """Converte og:image local em URL do CDN ibecom."""
    if not og_url:
        return None
    name = og_url.rstrip("/").split("/")[-1]
    if re.match(r"^[a-f0-9]{32}\.png$", name, re.I):
        return f"https://assets.ibecom.com.br/ib.store.image.medium/m-{name}"
    return None


def _collect_banner_candidates(html, page_url, market_id):
    """Coleta URLs candidatas a banner, em ordem de prioridade."""
    candidates = []
    soup = BeautifulSoup(html, "lxml")

    for prop in ("og:image", "twitter:image"):
        tag = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
        if tag and tag.get("content"):
            candidates.append(_normalize_url(tag["content"], page_url))

    for img in soup.select("img[src], img[data-src]"):
        src = _normalize_url(img.get("src") or img.get("data-src"), page_url)
        if not src:
            continue
        low = src.lower()
        if any(skip in low for skip in ("google-play", "app-store", "logo", "favicon", ".svg")):
            continue
        if "ibecom.com.br" in low or "vtexassets.com" in low:
            candidates.insert(0, src)
        elif any(k in low for k in ("banner", "oferta", "promo", "encarte")):
            candidates.append(src)

    if market_id == "carrefour":
        for match in re.findall(
            r"https://carrefourbrfood\.vtexassets\.com[^\"'<>\\s]+\.png",
            html,
        ):
            candidates.insert(0, match)

    # ibecom: derivar CDN a partir de og:image quebrado
    for url in list(candidates):
        alt = _ibecom_from_og(url)
        if alt:
            candidates.insert(0, alt)

    seen = set()
    unique = []
    for url in candidates:
        if url and url not in seen:
            seen.add(url)
            unique.append(url)
    return unique


def _guess_ext(url, content_type=""):
    low = url.lower()
    if ".png" in low or "png" in content_type:
        return ".png"
    if ".webp" in low or "webp" in content_type:
        return ".webp"
    return ".jpg"


def _download_image(url, dest_path):
    headers = {"User-Agent": USER_AGENT}
    resp = requests.get(url, headers=headers, timeout=25)
    resp.raise_for_status()
    if len(resp.content) < 2048:
        raise ValueError("imagem muito pequena")
    dest_path.write_bytes(resp.content)
    return dest_path


def generate_fallback_banner(market_id, name, color_hex):
    """Gera PNG estilizado quando o site não expõe banner (SPA/Facebook)."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        print(f"Pillow ausente — mantendo fallback para {market_id}", file=sys.stderr)
        return None

    BANNERS_DIR.mkdir(parents=True, exist_ok=True)
    w, h = 960, 540
    img = Image.new("RGB", (w, h), "#0a0f14")
    draw = ImageDraw.Draw(img)

    accent = color_hex.lstrip("#")
    r, g, b = int(accent[0:2], 16), int(accent[2:4], 16), int(accent[4:6], 16)
    for y in range(h):
        t = y / h
        cr = int(10 + (r - 10) * (1 - t) * 0.35)
        cg = int(15 + (g - 15) * (1 - t) * 0.35)
        cb = int(20 + (b - 20) * (1 - t) * 0.35)
        draw.line([(0, y), (w, y)], fill=(cr, cg, cb))

    draw.rectangle([(0, 0), (10, h)], fill=(r, g, b))
    draw.ellipse([(w - 220, -60), (w + 60, 220)], fill=(r, g, b))

    try:
        font_lg = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf", 52)
        font_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 26)
        font_xs = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 20)
    except OSError:
        font_lg = ImageFont.load_default()
        font_sm = font_lg
        font_xs = font_lg

    draw.text((48, 180), name, fill=(232, 237, 242), font=font_lg)
    draw.text((48, 260), "Ofertas da semana", fill=(139, 154, 171), font=font_sm)
    draw.text((48, h - 72), "Ver encarte →", fill=(r, g, b), font=font_xs)

    dest = BANNERS_DIR / f"{market_id}.png"
    img.save(dest, "PNG", optimize=True)
    return f"assets/banners/{market_id}.png"


def resolve_banner(market_id, page_url, fallback, name="", color="#3dadb8"):
    """Baixa banner real ou gera PNG de fallback."""
    BANNERS_DIR.mkdir(parents=True, exist_ok=True)
    html = fetch_html(page_url)

    if html:
        for img_url in _collect_banner_candidates(html, page_url, market_id):
            ext = _guess_ext(img_url)
            dest = BANNERS_DIR / f"{market_id}{ext}"
            try:
                _download_image(img_url, dest)
                print(f"Banner real: {market_id} ← {img_url[:80]}…")
                return f"assets/banners/{market_id}{ext}", img_url
            except Exception as e:
                print(f"Tentativa falhou ({market_id}): {e}", file=sys.stderr)

    generated = generate_fallback_banner(market_id, name, color)
    if generated:
        print(f"Banner gerado: {market_id}")
        return generated, None

    return fallback, None


def _is_store_logo(url, titulo=""):
    if not url:
        return True
    low = url.lower()
    titulo_low = (titulo or "").lower()
    if "store.image" in low or "logo" in low:
        return True
    if titulo_low in {"supermercado índio", "supermercado indio", "supermercado paulinho", "stok center"}:
        return True
    return False


def pick_promo_highlight(ofertas, banner_origem, banner_local):
    """Escolhe a melhor imagem de promoção e um título curto para o card."""
    for oferta in ofertas:
        img = _normalize_url(oferta.get("imagem"))
        titulo = (oferta.get("titulo") or "").strip()
        if img and not _is_store_logo(img, titulo) and len(titulo) > 3:
            return img, titulo[:72]

    if banner_origem and not _is_store_logo(banner_origem):
        return banner_origem, "Encarte da semana"

    return banner_local, "Ver encarte da semana"


def scrape_ibecom_promo_page(url):
    """Extrai ofertas visíveis em páginas ibecom (se houver)."""
    html = fetch_html(url)
    if not html:
        return []
    soup = BeautifulSoup(html, "lxml")
    ofertas = []
    seen = set()

    for img in soup.select(
        "img[src*='ibecom'], img[data-src*='ibecom'], img[src*='produto'], img[src*='product']"
    ):
        src = _normalize_url(img.get("src") or img.get("data-src"), url)
        alt = img.get("alt", "").strip()
        if not src or src in seen:
            continue
        seen.add(src)
        if _is_store_logo(src, alt):
            continue
        parent = img.find_parent("a")
        link = parent.get("href") if parent else None
        if link:
            link = _normalize_url(link, url)
        titulo = alt if alt and len(alt) > 2 else "Oferta da semana"
        ofertas.append({
            "titulo": titulo[:80],
            "preco": "",
            "imagem": src,
            "link": link,
        })
    return ofertas[:10]


def scrape_stok():
    """Exemplo de scraping do Stok Center."""
    html = fetch_html("https://www.stokonline.com.br/ofertas")
    if not html:
        return []
    soup = BeautifulSoup(html, "lxml")
    ofertas = []
    # Exemplo: pegar itens com a classe .produto-oferta
    # classe fictícia – inspecione o site real!
    for item in soup.select(".produto-oferta"):
        nome = item.select_one(".nome-produto")
        preco = item.select_one(".preco-promocional")
        imagem = item.select_one("img")
        if nome and preco:
            ofertas.append({
                "titulo": nome.get_text(strip=True),
                "preco": preco.get_text(strip=True),
                "imagem": imagem.get("src") if imagem else None,
                "link": item.get("href") if item.get("href") else None
            })
    return ofertas


def scrape_indio():
    return scrape_ibecom_promo_page("https://supermercadosindio.app.br/promocoes")


def scrape_paulinho():
    return scrape_ibecom_promo_page("https://supermercadopaulinho.com.br/promocoes")


def scrape_atual():
    html = fetch_html("https://www.atualmercado.com.br/ofertas")
    if not html:
        return []
    soup = BeautifulSoup(html, "lxml")
    ofertas = []
    for item in soup.select(".item-oferta"):
        nome = item.select_one(".descricao")
        preco = item.select_one(".preco")
        imagem = item.select_one("img")
        if nome and preco:
            ofertas.append({
                "titulo": nome.get_text(strip=True),
                "preco": preco.get_text(strip=True),
                "imagem": imagem.get("src") if imagem else None,
                "link": item.get("href") if item.get("href") else None
            })
    return ofertas

# Para mercados com link direto (sem scraping), retornamos uma lista vazia,
# mas com uma flag indicando que é link externo.


def empty_scraper():
    return []  # os dados virão do JSON estático ou do frontend


# Mapeamento de funções
SCRAPERS = {
    "scrape_stok": scrape_stok,
    "scrape_indio": scrape_indio,
    "scrape_paulinho": scrape_paulinho,
    "scrape_atual": scrape_atual
}

# ------------------------------------------------------------
# 3. Orquestração
# ------------------------------------------------------------


def main():
    result = {
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "mercados": []
    }

    for key, config in MARKETS.items():
        mercado_data = {
            "id": key,
            "nome": config["name"],
            "cor": config["color"],
            "url": config["url"],
            "banner": config.get("banner_fallback", f"assets/banners/{key}.png"),
            "ofertas": [],
            "tipo": "scraping"
        }

        banner_path, banner_origem = resolve_banner(
            key,
            config["url"],
            mercado_data["banner"],
            name=config["name"],
            color=config["color"],
        )
        mercado_data["banner"] = banner_path
        if banner_origem:
            mercado_data["banner_origem"] = banner_origem

        if config.get("link_direto"):
            mercado_data["tipo"] = "link_direto"
            # Não faz scraping; os dados vêm do frontend
        else:
            scraper_func = SCRAPERS.get(config["scraper"])
            if scraper_func:
                try:
                    ofertas = scraper_func()
                    # limita a 10 ofertas
                    mercado_data["ofertas"] = ofertas[:10]
                    mercado_data["quantidade"] = len(ofertas)
                except Exception as e:
                    print(
                        f"Erro no scraping de {config['name']}: {e}", file=sys.stderr)
                    mercado_data["erro"] = str(e)
            else:
                print(
                    f"Nenhum scraper definido para {config['name']}", file=sys.stderr)

        result["mercados"].append(mercado_data)

        promo_img, promo_titulo = pick_promo_highlight(
            mercado_data.get("ofertas", []),
            mercado_data.get("banner_origem"),
            mercado_data["banner"],
        )
        mercado_data["promocao_imagem"] = promo_img
        mercado_data["promocao_titulo"] = promo_titulo
        mercado_data["imagem_credito"] = config["name"]

    output = ROOT / "ofertas.json"
    with open(output, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    JS_OUTPUT.write_text(
        "window.OFERTAS_DATA = " + json.dumps(result, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )

    print("ofertas.json e ofertas-data.js atualizados com sucesso.")


if __name__ == "__main__":
    main()
