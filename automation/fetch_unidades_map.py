#!/usr/bin/env python3
"""Gera coordenadas das unidades de saúde (Guaíba via CNES + referência regional)."""

import json
import re
import sys
import time
from pathlib import Path

from geocode_lib import (
    NOMINATIM_DELAY,
    USER_AGENT,
    geocode_address,
    geocode_endereco,
    guess_coords,
    title_words,
)

ROOT = Path(__file__).resolve().parent.parent
SAUDE_HTML = ROOT / "saude.html"
OUTPUT = ROOT / "unidades-map.json"
REGIAO_SEED = ROOT / "regiao-saude.seed.json"
CNES_DELAY = 0.4


def format_cep(cep):
    digits = re.sub(r"\D", "", cep or "")
    if len(digits) == 8:
        return f"{digits[:5]}-{digits[5:]}"
    return cep or ""


def format_endereco(logradouro, numero, complemento, bairro, cep, cidade="guaiba"):
    from geocode_lib import city_cfg

    parts = []
    if logradouro:
        line = logradouro.strip()
        if numero:
            line = f"{line}, {numero.strip()}"
        parts.append(line)
    if complemento:
        parts.append(complemento.strip())
    if bairro:
        parts.append(f"Bairro {bairro.strip()}")
    cep_fmt = format_cep(cep)
    if cep_fmt:
        parts.append(f"CEP {cep_fmt}")
    parts.append(f"{city_cfg(cidade)['name']}, RS")
    return " — ".join(parts)


def fetch_cnes_address(cnes_url):
    import requests
    from bs4 import BeautifulSoup

    if not cnes_url:
        return {}

    soup = None
    for attempt in range(3):
        try:
            resp = requests.get(
                cnes_url,
                headers={"User-Agent": USER_AGENT},
                timeout=35,
            )
            resp.raise_for_status()
            soup = BeautifulSoup(resp.content, "html.parser", from_encoding="latin-1")
            break
        except Exception as exc:
            if attempt == 2:
                print(f"CNES falhou {cnes_url}: {exc}", file=sys.stderr)
                return {}
            time.sleep(2 * (attempt + 1))
    if soup is None:
        return {}

    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        for i, tr in enumerate(rows):
            cells = [td.get_text(" ", strip=True) for td in tr.find_all("td")]
            if not cells or not cells[0].startswith("Logradouro"):
                continue

            logradouro = numero = ""
            if i + 1 < len(rows):
                vals = [td.get_text(" ", strip=True) for td in rows[i + 1].find_all("td")]
                logradouro = vals[0] if len(vals) > 0 else ""
                numero = vals[1] if len(vals) > 1 else ""

            complemento = bairro = cep = ""
            for j in range(i, min(i + 8, len(rows))):
                labels = [td.get_text(" ", strip=True) for td in rows[j].find_all("td")]
                if labels and labels[0].startswith("Complemento") and j + 1 < len(rows):
                    vals = [td.get_text(" ", strip=True) for td in rows[j + 1].find_all("td")]
                    complemento = vals[0] if len(vals) > 0 else ""
                    bairro = vals[1] if len(vals) > 1 else ""
                    cep = vals[2] if len(vals) > 2 else ""
                    break

            if logradouro or bairro or cep:
                return {
                    "logradouro": logradouro,
                    "numero": numero,
                    "complemento": complemento,
                    "bairro": bairro,
                    "cep": cep,
                }
    return {}


def parse_units():
    from bs4 import BeautifulSoup

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
            "cidade": "guaiba",
            "nome": name_el.get_text(strip=True),
            "categoria": cat_el.get_text(strip=True) if cat_el else "",
            "cnes_url": link_el["href"] if link_el else "",
            "data_cat": row.get("data-cat", ""),
        })
    return units


def load_regiao_seed():
    if not REGIAO_SEED.exists():
        return []
    data = json.loads(REGIAO_SEED.read_text(encoding="utf-8"))
    return data.get("unidades", [])


def write_outputs(payload):
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    js_path = ROOT / "unidades-map-data.js"
    js_path.write_text(
        "window.GUIUNIDADES_DATA = " + json.dumps(payload, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )


def map_guaiba_unit(unit, index, total):
    print(f"[guaiba {index}/{total}] {unit['nome']}", file=sys.stderr)
    addr = fetch_cnes_address(unit["cnes_url"])
    time.sleep(CNES_DELAY)

    endereco = ""
    if addr:
        endereco = format_endereco(
            addr.get("logradouro", ""),
            addr.get("numero", ""),
            addr.get("complemento", ""),
            addr.get("bairro", ""),
            addr.get("cep", ""),
            "guaiba",
        )

    if addr.get("logradouro") or addr.get("cep") or addr.get("bairro"):
        lat, lon, fonte = geocode_address(addr, unit["nome"], "guaiba")
    else:
        coords, fonte = guess_coords(unit["nome"], "guaiba")
        lat, lon = coords
        print(f"  sem endereço CNES, usando fallback ({fonte})", file=sys.stderr)

    return {
        **unit,
        "endereco": endereco,
        "lat": lat,
        "lon": lon,
        "geocode_fonte": fonte,
        "posicao_aproximada": fonte != "nominatim",
    }


def map_regiao_unit(unit, index, total):
    cidade = unit.get("cidade", "poa")
    print(f"[{cidade} {index}/{total}] {unit['nome']}", file=sys.stderr)
    endereco = unit.get("endereco", "")
    lat, lon, fonte = geocode_endereco(endereco, unit["nome"], cidade)
    return {
        **unit,
        "endereco": endereco,
        "lat": lat,
        "lon": lon,
        "geocode_fonte": fonte,
        "posicao_aproximada": fonte != "nominatim",
        "regional": True,
    }


def regen_js_only():
    if not OUTPUT.exists():
        print(f"{OUTPUT.name} não encontrado", file=sys.stderr)
        sys.exit(1)
    payload = json.loads(OUTPUT.read_text(encoding="utf-8"))
    write_outputs(payload)
    print(f"Salvo {len(payload.get('unidades', []))} unidades em unidades-map-data.js", file=sys.stderr)


def main():
    guaiba_units = parse_units()
    mapped = []
    for i, unit in enumerate(guaiba_units, 1):
        mapped.append(map_guaiba_unit(unit, i, len(guaiba_units)))

    regiao = load_regiao_seed()
    for i, unit in enumerate(regiao, 1):
        mapped.append(map_regiao_unit(unit, i, len(regiao)))

    payload = {
        "gerado_em": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "unidades": mapped,
    }
    write_outputs(payload)
    ok = sum(1 for u in mapped if u["geocode_fonte"] == "nominatim")
    print(
        f"Salvo {len(mapped)} unidades ({len(guaiba_units)} Guaíba + {len(regiao)} regional; "
        f"{ok} via Nominatim)",
        file=sys.stderr,
    )


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--from-json":
        regen_js_only()
    elif len(sys.argv) > 1 and sys.argv[1] == "--regiao-only":
        if not OUTPUT.exists():
            print("unidades-map.json não encontrado", file=sys.stderr)
            sys.exit(1)
        payload = json.loads(OUTPUT.read_text(encoding="utf-8"))
        guaiba = [u for u in payload.get("unidades", []) if u.get("cidade", "guaiba") == "guaiba"]
        regiao = load_regiao_seed()
        mapped = list(guaiba)
        for i, unit in enumerate(regiao, 1):
            mapped.append(map_regiao_unit(unit, i, len(regiao)))
        payload["gerado_em"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        payload["unidades"] = mapped
        write_outputs(payload)
        print(f"Atualizado com {len(regiao)} unidades regionais", file=sys.stderr)
    else:
        main()
