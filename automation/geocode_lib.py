"""Geocodificação compartilhada para mapas do Guaipecaz."""

from __future__ import annotations

import json
import re
import sys
import time

from site_config import USER_AGENT
NOMINATIM_DELAY = 1.1

CITIES = {
    "guaiba": {
        "name": "Guaíba",
        "bounds": {"lat_min": -30.17, "lat_max": -30.07, "lon_min": -51.42, "lon_max": -51.25},
    },
    "poa": {
        "name": "Porto Alegre",
        "bounds": {"lat_min": -30.25, "lat_max": -29.90, "lon_min": -51.35, "lon_max": -51.00},
    },
    "canoas": {
        "name": "Canoas",
        "bounds": {"lat_min": -30.05, "lat_max": -29.85, "lon_min": -51.25, "lon_max": -51.10},
    },
    "eldorado": {
        "name": "Eldorado do Sul",
        "bounds": {"lat_min": -30.20, "lat_max": -30.00, "lon_min": -51.45, "lon_max": -51.20},
    },
}

BAD_COORDS = {(-30.1379202, -51.317427)}

GUAIBA_BAIRRO_COORDS = {
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
    "parque 35": (-30.1080, -51.3281),
    "santa rita": (-30.0890, -51.3263),
    "jardim dos lagos": (-30.1198, -51.3642),
    "moradas da colina": (-30.1209, -51.3378),
    "ermo": (-30.1250, -51.3400),
    "são jorge": (-30.1178, -51.3512),
    "sao jorge": (-30.1178, -51.3512),
}


def title_words(text: str) -> str:
    if not text:
        return ""
    return " ".join(w.capitalize() for w in text.lower().strip().split())


def simplify_street(logradouro: str) -> str:
    if not logradouro:
        return ""
    text = logradouro.strip()
    for prefix in (
        "RUA ", "R. ", "AVENIDA ", "AV. ", "AV ", "ESTRADA ", "EST. ",
        "TRAVESSA ", "TV. ", "ALAMEDA ", "RODOVIA ", "BR ",
    ):
        if text.upper().startswith(prefix):
            text = text[len(prefix):]
            break
    return title_words(text)


def city_cfg(cidade: str) -> dict:
    return CITIES.get(cidade, CITIES["guaiba"])


def in_bounds(lat: float, lon: float, cidade: str) -> bool:
    b = city_cfg(cidade)["bounds"]
    return b["lat_min"] <= lat <= b["lat_max"] and b["lon_min"] <= lon <= b["lon_max"]


def valid_coords(lat: float, lon: float, cidade: str) -> bool:
    if abs(lat - (-30.1379202)) < 0.0001 and abs(lon - (-51.317427)) < 0.0001:
        return False
    if (round(lat, 7), round(lon, 7)) in BAD_COORDS:
        return False
    return in_bounds(lat, lon, cidade)


def score_result(item: dict, addr: dict, cidade: str) -> int:
    name = item.get("display_name", "").lower()
    score = 0
    city_name = city_cfg(cidade)["name"].lower()
    bairro = (addr.get("bairro") or "").lower()
    if bairro and bairro in name:
        score += 3
    street = simplify_street(addr.get("logradouro", "")).lower()
    if street:
        for token in street.split():
            if len(token) > 3 and token in name:
                score += 1
    if city_name in name or city_name.replace("í", "i") in name:
        score += 2
    return score


def geocode_query(query=None, addr=None, structured=None, cidade="guaiba"):
    import requests

    url = "https://nominatim.openstreetmap.org/search"
    params = {"format": "json", "limit": 5, "countrycodes": "br"}
    if structured:
        params.update(structured)
    else:
        params["q"] = query
    try:
        resp = requests.get(
            url,
            params=params,
            headers={"User-Agent": USER_AGENT},
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        if not data:
            return None
        if addr:
            data.sort(key=lambda item: score_result(item, addr, cidade), reverse=True)
        for item in data:
            lat = float(item["lat"])
            lon = float(item["lon"])
            if valid_coords(lat, lon, cidade):
                return lat, lon
    except Exception as exc:
        label = query or json.dumps(structured, ensure_ascii=False)
        print(f"geocode falhou ({label}): {exc}", file=sys.stderr)
    return None


def parse_endereco_text(endereco: str, cidade: str) -> dict:
    if not endereco:
        return {}
    text = endereco.strip()
    bairro = ""
    if "—" in text:
        parts = [p.strip() for p in text.split("—")]
        text = parts[0]
        for part in parts[1:]:
            low = part.lower()
            if low.startswith("bairro "):
                bairro = part[7:].strip()
            elif not bairro and "," not in part and "cep" not in low:
                bairro = part
    logradouro = text
    numero = ""
    if "," in text:
        chunks = [c.strip() for c in text.split(",")]
        logradouro = chunks[0]
        if len(chunks) > 1 and re.search(r"\d|s/n", chunks[1], re.I):
            numero = chunks[1]
        elif len(chunks) > 2:
            bairro = bairro or chunks[-1]
    return {
        "logradouro": logradouro,
        "numero": numero,
        "bairro": bairro,
        "cidade": city_cfg(cidade)["name"],
    }


def build_queries(addr: dict, cidade: str):
    city_name = city_cfg(cidade)["name"]
    logradouro = (addr.get("logradouro") or "").strip()
    numero = (addr.get("numero") or "").strip()
    bairro = title_words(addr.get("bairro", ""))
    street_full = simplify_street(logradouro)
    street_line = f"{street_full} {numero}".strip() if street_full else ""

    queries = []
    structured = []
    if street_line:
        structured.append({
            "street": street_line,
            "city": city_name,
            "state": "Rio Grande do Sul",
            "country": "Brazil",
        })
        if bairro:
            queries.append(f"{street_line}, {bairro}, {city_name}, RS, Brasil")
        queries.append(f"{street_line}, {city_name}, RS, Brasil")
        if logradouro:
            raw = logradouro
            if numero:
                raw = f"{raw}, {numero}"
            if bairro:
                queries.append(f"{title_words(raw)}, {bairro}, {city_name}, RS, Brasil")
            queries.append(f"{title_words(raw)}, {city_name}, RS, Brasil")
        if street_full:
            short = " ".join(street_full.split()[-3:])
            if short != street_full:
                queries.append(f"{short} {numero}, {city_name}, RS".strip())

    if bairro:
        queries.append(f"{bairro}, {city_name}, RS, Brasil")

    seen = set()
    ordered = []
    for q in queries:
        if q and q not in seen:
            seen.add(q)
            ordered.append(q)
    return structured, ordered


def guess_coords(nome: str, cidade: str):
    cfg = city_cfg(cidade)
    center = (cfg["bounds"]["lat_min"] + cfg["bounds"]["lat_max"]) / 2, (
        cfg["bounds"]["lon_min"] + cfg["bounds"]["lon_max"]
    ) / 2
    if cidade == "guaiba":
        lower = nome.lower()
        for key, coords in GUAIBA_BAIRRO_COORDS.items():
            if key in lower:
                return coords, "bairro"
    return center, "centro"


def geocode_address(addr: dict, nome: str, cidade: str = "guaiba"):
    structured, queries = build_queries(addr, cidade)

    for params in structured:
        coords = geocode_query(addr=addr, structured=params, cidade=cidade)
        time.sleep(NOMINATIM_DELAY)
        if coords:
            return coords[0], coords[1], "nominatim"

    for query in queries[:-1] if addr.get("bairro") else queries:
        coords = geocode_query(query, addr=addr, cidade=cidade)
        time.sleep(NOMINATIM_DELAY)
        if coords:
            return coords[0], coords[1], "nominatim"

    if addr.get("bairro"):
        city_name = city_cfg(cidade)["name"]
        bairro_query = f"{title_words(addr['bairro'])}, {city_name}, RS, Brasil"
        coords = geocode_query(bairro_query, addr=addr, cidade=cidade)
        time.sleep(NOMINATIM_DELAY)
        if coords:
            return coords[0], coords[1], "bairro"

    coords, fonte = guess_coords(nome, cidade)
    return coords[0], coords[1], fonte


def geocode_endereco(endereco: str, nome: str, cidade: str = "guaiba"):
    addr = parse_endereco_text(endereco, cidade)
    if not addr.get("logradouro") and not addr.get("bairro"):
        lat, lon, fonte = guess_coords(nome, cidade)
        return lat, lon, fonte
    return geocode_address(addr, nome, cidade)


def apply_geocode_point(point: dict, cidade_key: str | None = None):
    cidade = cidade_key or point.get("cidade") or "guaiba"
    if cidade == "todas" or not point.get("mapa", True):
        return point
    endereco = point.get("endereco", "")
    if not endereco:
        return point
    lat, lon, fonte = geocode_endereco(endereco, point.get("nome", ""), cidade)
    out = dict(point)
    out["lat"] = lat
    out["lon"] = lon
    out["geocode_fonte"] = fonte
    out["posicao_aproximada"] = fonte != "nominatim"
    return out
