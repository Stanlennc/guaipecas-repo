"""
Atualiza rivers.json com níveis do Guaíba e do Jacuí.

Ordem de fontes:
1. API oficial da ANA (se ANA_API_USER e ANA_API_PASSWORD estiverem configurados)
2. Feed JSON público do Nível Guaíba (https://nivelguaiba.com.br/feed)
3. Meta tags das páginas do Nível Guaíba (fallback)
"""

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import requests

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "rivers.json"
JS_OUTPUT = ROOT / "rivers-data.js"
USER_AGENT = "GuaipecasBot/1.0 (+https://github.com/Stanlennc/guaipecas-repo)"

ANA_AUTH_URL = "https://www.ana.gov.br/hidrowebservice/EstacoesTelemetricas/OAUth/v1"
ANA_SERIE_URL = "https://www.ana.gov.br/hidrowebservice/EstacoesTelemetricas/HidroinfoanaSerieTelemetricaAdotada/v1"
NIVEL_FEED_URL = "https://nivelguaiba.com.br/feed"

STATIONS = {
    "guaiba": {
        "id": "guaiba",
        "codigo": "00000000",
        "nome": "Rio Guaíba",
        "local": "Cais Mauá, Porto Alegre",
        "cota_inundacao": 3.00,
        "fonte_url": "https://nivelguaiba.com.br/portoalegre",
        "feed_paths": {"", "portoalegre"},
        "title_markers": ("porto alegre", "guaíba"),
    },
    "jacui": {
        "id": "jacui",
        "codigo": "00000000",
        "nome": "Rio Jacuí",
        "local": "Dona Francisca",
        "cota_inundacao": 7.50,
        "fonte_url": "https://nivelguaiba.com.br/donafrancisca",
        "feed_paths": {"donafrancisca"},
        "title_markers": ("dona francisca",),
    },
}


def fetch_text(url):
    headers = {"User-Agent": USER_AGENT}
    resp = requests.get(url, headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.text


def parse_level_value(text):
    if not text:
        return None
    match = re.search(r"(\d+[.,]\d+|\d+)\s*m", text, re.I)
    if not match:
        match = re.search(r"(\d+\.?\d*)\s*metros", text, re.I)
    if not match:
        return None
    return float(match.group(1).replace(",", "."))


def parse_status(text):
    if not text:
        return None
    lower = text.lower()
    if "alagado" in lower or "inunda" in lower:
        return "alagado"
    if "alerta" in lower or "vigiar" in lower or "atenção" in lower or "atencao" in lower:
        return "alerta"
    if "normal" in lower:
        return "normal"
    return None


def feed_path(url):
    path = urlparse(url).path.strip("/")
    return path.split("/")[-1] if path else ""


def match_feed_item(item, station):
    url_path = feed_path(item.get("url", ""))
    if url_path in station["feed_paths"]:
        return True
    title = (item.get("title") or "").lower()
    if station.get("id") == "guaiba":
        return "porto alegre" in title and "guaíba" in title
    if station.get("id") == "jacui":
        return "dona francisca" in title
    return any(marker in title for marker in station["title_markers"])


def parse_feed_item(item):
    title = item.get("title") or ""
    content = item.get("content_text") or ""
    nivel = parse_level_value(title) or parse_level_value(content)
    status = parse_status(title) or parse_status(content)
    return {
        "nivel_m": nivel,
        "status": status,
        "data_hora_medicao": item.get("date_published"),
    }


def fetch_nivelguaiba_feed():
    data = json.loads(fetch_text(NIVEL_FEED_URL))
    items = data.get("items") or []
    resultado = {}
    for chave, station in STATIONS.items():
        item = next((it for it in items if match_feed_item(it, station)), None)
        if not item:
            continue
        parsed = parse_feed_item(item)
        if parsed["nivel_m"] is None:
            continue
        resultado[chave] = {
            "nome": station["nome"],
            "local": station["local"],
            "nivel_m": parsed["nivel_m"],
            "cota_inundacao": station["cota_inundacao"],
            "data_hora_medicao": parsed["data_hora_medicao"],
            "status": parsed["status"],
            "fonte": "Nível Guaíba",
            "fonte_url": station["fonte_url"],
        }
    return resultado


def fetch_nivelguaiba_html():
    resultado = {}
    meta_pattern = re.compile(
        r'<meta[^>]+name="description"[^>]+content="[^"]*Cota atual:\s*([\d.,]+)m',
        re.I,
    )
    for chave, station in STATIONS.items():
        try:
            html = fetch_text(station["fonte_url"])
        except Exception as exc:
            print(f"HTML {chave}: {exc}", file=sys.stderr)
            continue
        match = meta_pattern.search(html)
        if not match:
            continue
        nivel = float(match.group(1).replace(",", "."))
        resultado[chave] = {
            "nome": station["nome"],
            "local": station["local"],
            "nivel_m": nivel,
            "cota_inundacao": station["cota_inundacao"],
            "data_hora_medicao": datetime.now(timezone.utc).isoformat(),
            "status": None,
            "fonte": "Nível Guaíba",
            "fonte_url": station["fonte_url"],
        }
    return resultado


def autenticar_ana():
    user = os.environ.get("ANA_API_USER", "").strip()
    password = os.environ.get("ANA_API_PASSWORD", "").strip()
    if not user or not password:
        return None
    resp = requests.get(ANA_AUTH_URL, auth=(user, password), timeout=30)
    resp.raise_for_status()
    return resp.json()["items"]["tokenautenticacao"]


def buscar_estacao_ana(token, codigo):
    headers = {"Authorization": f"Bearer {token}"}
    params = {"codEstacao": codigo}
    resp = requests.get(ANA_SERIE_URL, headers=headers, params=params, timeout=30)
    resp.raise_for_status()
    dados = resp.json()["items"]
    ultima_medicao = dados[-1]
    return {
        "nivel_m": ultima_medicao.get("Nivel_Adotado"),
        "data_hora": ultima_medicao.get("Data_Hora_Medicao"),
    }


def fetch_ana():
    token = autenticar_ana()
    if not token:
        return {}

    resultado = {}
    for chave, station in STATIONS.items():
        if station["codigo"] == "00000000":
            continue
        try:
            medicao = buscar_estacao_ana(token, station["codigo"])
            resultado[chave] = {
                "nome": station["nome"],
                "local": station["local"],
                "nivel_m": float(medicao["nivel_m"]),
                "cota_inundacao": station["cota_inundacao"],
                "data_hora_medicao": medicao["data_hora"],
                "fonte": "ANA HidroWebService",
                "fonte_url": "https://www.ana.gov.br/",
            }
        except Exception as exc:
            print(f"ANA {chave}: {exc}", file=sys.stderr)
    return resultado


def merge_rios(*fontes):
    merged = {}
    for fonte in fontes:
        for chave, dados in fonte.items():
            if chave not in merged and dados.get("nivel_m") is not None:
                merged[chave] = dados
    return merged


def salvar(payload):
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    JS_OUTPUT.write_text(
        "window.RIVERS_DATA = " + json.dumps(payload, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )


def main():
    fonte_principal = "Nível Guaíba"

    rios = fetch_ana()
    if rios:
        fonte_principal = "ANA HidroWebService"
        print("Fonte: ANA", file=sys.stderr)
    else:
        try:
            rios = fetch_nivelguaiba_feed()
            print(f"Fonte: feed JSON Nível Guaíba ({len(rios)} rios)", file=sys.stderr)
        except Exception as exc:
            print(f"Feed Nível Guaíba falhou: {exc}", file=sys.stderr)
            rios = {}

        if len(rios) < len(STATIONS):
            html_rios = fetch_nivelguaiba_html()
            rios = merge_rios(rios, html_rios)
            print(f"Complemento HTML: {len(rios)} rios", file=sys.stderr)

    if not rios:
        print("Nenhum dado de rio obtido.", file=sys.stderr)
        sys.exit(1)

    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "fonte": fonte_principal,
        "rios": rios,
    }
    salvar(payload)
    print(f"rivers.json atualizado ({len(rios)} rios).", file=sys.stderr)


if __name__ == "__main__":
    main()
