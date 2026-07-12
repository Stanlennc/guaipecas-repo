#!/usr/bin/env python3
"""
Gera bairros-alerta.json — risco de enchente por bairro em Guaíba + orientação em texto.

Entradas:
  - automation/bairros.seed.json (risco histórico por bairro)
  - rivers.json (níveis atuais)
  - Open-Meteo (previsão de chuva)

Texto orientativo:
  - Com OPENAI_API_KEY: geração via API (modelo configurável)
  - Sem chave: templates em português claro (mesma estrutura JSON)
"""

from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

from site_config import USER_AGENT

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "automation" / "bairros.seed.json"
RIVERS = ROOT / "rivers.json"
OUTPUT = ROOT / "bairros-alerta.json"
JS_OUTPUT = ROOT / "bairros-alerta-data.js"

GUAIBA_LAT = -30.1116
GUAIBA_LON = -51.3237

OPENAI_URL = "https://api.openai.com/v1/chat/completions"
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

RISCO_HIST_WEIGHT = {"alto": 1.0, "medio": 0.55, "baixo": 0.25}
PROX_WEIGHT = {"alta": 0.18, "media": 0.10, "baixa": 0.04}

STATUS_LABEL = {
    "normal": "Normal",
    "watch": "Atenção",
    "danger": "Alerta",
}

ACAO = {
    "normal": "Mantenha documentos e remédios separados; acompanhe o nível dos rios.",
    "watch": "Revise mochila de emergência e combine ponto de encontro com a família.",
    "danger": "Prepare deslocamento para local mais alto; em risco imediato, ligue 199.",
}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def salvar(payload: dict) -> None:
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    JS_OUTPUT.write_text(
        "window.BAIRROS_ALERTA_DATA = " + json.dumps(payload, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )


def fetch_weather() -> dict:
    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={GUAIBA_LAT}&longitude={GUAIBA_LON}"
        "&daily=precipitation_probability_max,precipitation_sum,weathercode"
        "&timezone=America%2FSao_Paulo&forecast_days=3"
    )
    resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=25)
    resp.raise_for_status()
    return resp.json()


def build_context(rivers: dict, weather: dict) -> dict:
    rios = rivers.get("rios") or {}
    guaiba = rios.get("guaiba") or {}
    jacui = rios.get("jacui") or {}

    g_nivel = float(guaiba.get("nivel_m") or 0)
    j_nivel = float(jacui.get("nivel_m") or 0)
    g_cota = float(guaiba.get("cota_inundacao") or 3.0)
    j_cota = float(jacui.get("cota_inundacao") or 7.5)

    g_ratio = g_nivel / g_cota if g_cota else 0
    j_ratio = j_nivel / j_cota if j_cota else 0
    river_pressure = max(g_ratio, j_ratio * 0.85)

    daily = weather.get("daily") or {}
    probs = daily.get("precipitation_probability_max") or []
    sums = daily.get("precipitation_sum") or []
    dates = daily.get("time") or []

    chuva_hoje = {}
    if dates and probs:
        chuva_hoje = {
            "data": dates[0],
            "prob_max": int(probs[0]) if probs else 0,
            "mm": float(sums[0]) if sums else 0.0,
        }

    prob_48h = max(int(p) for p in probs[:2]) if probs else 0
    mm_48h = round(sum(float(s) for s in sums[:2]), 1) if sums else 0.0

    return {
        "guaiba_m": g_nivel,
        "jacui_m": j_nivel,
        "guaiba_medicao": guaiba.get("data_hora_medicao"),
        "jacui_medicao": jacui.get("data_hora_medicao"),
        "river_pressure": round(river_pressure, 3),
        "chuva_prob_48h": prob_48h,
        "chuva_mm_48h": mm_48h,
        "chuva_hoje": chuva_hoje,
    }


def compute_status(bairro: dict, ctx: dict) -> tuple[str, float]:
    hist = RISCO_HIST_WEIGHT.get(bairro.get("risco_historico", "medio"), 0.55)
    prox = PROX_WEIGHT.get(bairro.get("proximidade_agua", "media"), 0.10)
    river = ctx["river_pressure"]
    rain = ctx["chuva_prob_48h"] / 100.0

    score = hist * 0.42 + river * 0.33 + rain * 0.17 + prox * 0.08
    score = round(score, 3)

    if river >= 0.88 or (hist >= 0.9 and river >= 0.5 and rain >= 0.55):
        return "danger", score
    if score >= 0.42 or river >= 0.62 or (hist >= 0.9 and rain >= 0.65):
        return "watch", score
    return "normal", score


def template_text(bairro: dict, status: str, ctx: dict) -> str:
    nome = bairro["nome"]
    g = f"{ctx['guaiba_m']:.2f}".replace(".", ",")
    j = f"{ctx['jacui_m']:.2f}".replace(".", ",")
    chuva = ctx["chuva_prob_48h"]
    hist = bairro.get("risco_historico", "medio")

    if status == "danger":
        return (
            f"{nome} tem histórico {hist} de alagamento e a região está sob pressão: "
            f"Guaíba em {g} m e Jacuí em {j} m, com até {chuva}% de chance de chuva forte nas próximas 48 h. "
            f"Separe documentos, remédios e um ponto seguro mais alto. Em risco imediato, ligue 199."
        )
    if status == "watch":
        return (
            f"Em {nome}, o cenário pede atenção: Guaíba em {g} m, Jacuí em {j} m "
            f"e previsão de chuva até {chuva}% nas próximas 48 h. "
            f"O bairro já registrou impacto em cheias anteriores — vale revisar a mochila de emergência e combinar com a família onde se encontrar."
        )
    return (
        f"Por enquanto, {nome} está em situação tranquila: Guaíba em {g} m e Jacuí em {j} m, "
        f"com chuva prevista em torno de {chuva}% nas próximas 48 h. "
        f"Mantenha o kit básico pronto e acompanhe o nível dos rios — cada evento é diferente."
    )


def build_ai_prompt(seed: dict, ctx: dict, computed: dict) -> str:
    resumo_rios = (
        f"Guaíba (Cais Mauá): {ctx['guaiba_m']:.2f} m. "
        f"Jacuí (Dona Francisca): {ctx['jacui_m']:.2f} m. "
        f"Pressão regional: {ctx['river_pressure']:.0%} da cota de referência. "
        f"Chuva prevista 48 h: até {ctx['chuva_prob_48h']}% ({ctx['chuva_mm_48h']} mm)."
    )
    linhas = []
    for b in seed["bairros"]:
        bid = b["id"]
        st, score = computed[bid]["status"], computed[bid]["score"]
        linhas.append(
            f"- {bid}: {b['nome']} | risco_hist={b['risco_historico']} | "
            f"prox_agua={b['proximidade_agua']} | atingido_2024={b['atingido_2024']} | "
            f"status_calc={st} | score={score} | nota={b.get('nota', '')}"
        )

    return f"""Você escreve alertas curtos para o portal cidadão Guaipecaz (Guaíba/RS).

DADOS ATUAIS DOS RIOS (Nível Guaíba):
{resumo_rios}

BAIRROS (status já calculado por regras — NÃO altere normal/watch/danger):
{chr(10).join(linhas)}

TAREFA:
Para CADA bairro, escreva "texto" (2-3 frases, português brasileiro, tom calmo e prático) e "acao" (1 frase curta com o que fazer agora).
- Use APENAS os dados acima; não invente cotas, horários ou avisos oficiais.
- Se status=danger, mencione ligar 199 em risco imediato.
- Se status=watch, sugira mochila de emergência e ponto de encontre.
- Se status=normal, tranquilize mas peça para acompanhar rios.
- Não use markdown.

Responda SOMENTE JSON válido neste formato:
{{"bairros": {{"<id>": {{"texto": "...", "acao": "..."}}, ...}}}}
"""


def parse_ai_json(content: str) -> dict | None:
    text = content.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        data = json.loads(text)
        if isinstance(data.get("bairros"), dict):
            return data["bairros"]
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group(0))
            if isinstance(data.get("bairros"), dict):
                return data["bairros"]
        except json.JSONDecodeError:
            return None
    return None


def generate_ai_texts(seed: dict, ctx: dict, computed: dict) -> dict | None:
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        print("OPENAI_API_KEY ausente — usando templates.", file=sys.stderr)
        return None

    prompt = build_ai_prompt(seed, ctx, computed)
    payload = {
        "model": OPENAI_MODEL,
        "temperature": 0.35,
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "system",
                "content": (
                    "Você é redator do portal Guaipecaz. Respostas só em JSON, "
                    "português brasileiro, sem inventar dados."
                ),
            },
            {"role": "user", "content": prompt},
        ],
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    try:
        resp = requests.post(OPENAI_URL, headers=headers, json=payload, timeout=90)
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        parsed = parse_ai_json(content)
        if parsed:
            print(f"Textos IA gerados ({OPENAI_MODEL}, {len(parsed)} bairros).", file=sys.stderr)
            return parsed
        print("Resposta IA inválida — fallback para templates.", file=sys.stderr)
    except Exception as exc:
        print(f"IA falhou: {exc} — fallback para templates.", file=sys.stderr)
    return None


def build_payload(seed: dict, rivers: dict, weather: dict) -> dict:
    ctx = build_context(rivers, weather)
    computed: dict[str, dict] = {}

    for bairro in seed["bairros"]:
        status, score = compute_status(bairro, ctx)
        computed[bairro["id"]] = {"status": status, "score": score}

    ai_texts = generate_ai_texts(seed, ctx, computed)
    fonte_texto = f"OpenAI ({OPENAI_MODEL})" if ai_texts else "templates Guaipecaz"

    bairros_out = []
    for bairro in seed["bairros"]:
        bid = bairro["id"]
        status, score = computed[bid]["status"], computed[bid]["score"]
        ai = (ai_texts or {}).get(bid) or {}
        texto = (ai.get("texto") or "").strip() or template_text(bairro, status, ctx)
        acao = (ai.get("acao") or "").strip() or ACAO[status]
        bairros_out.append({
            "id": bid,
            "nome": bairro["nome"],
            "risco_historico": bairro["risco_historico"],
            "proximidade_agua": bairro["proximidade_agua"],
            "atingido_2024": bairro.get("atingido_2024", False),
            "status": status,
            "status_label": STATUS_LABEL[status],
            "score": score,
            "texto": texto,
            "acao": acao,
            "nota_historica": bairro.get("nota", ""),
        })

    return {
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "fonte": "Guaipecaz — alerta por bairro",
        "fonte_texto": fonte_texto,
        "fonte_rios": rivers.get("fonte", "Nível Guaíba"),
        "contexto": ctx,
        "disclaimer": (
            "Indicativo — cruza histórico de 2024, nível dos rios e previsão de chuva. "
            "Não substitui avisos oficiais da Defesa Civil (199) ou da prefeitura."
        ),
        "bairros": bairros_out,
    }


def main() -> None:
    if not SEED.is_file():
        print(f"Seed ausente: {SEED}", file=sys.stderr)
        sys.exit(1)
    if not RIVERS.is_file():
        print(f"rivers.json ausente — rode fetch_rivers.py primeiro.", file=sys.stderr)
        sys.exit(1)

    seed = load_json(SEED)
    rivers = load_json(RIVERS)

    try:
        weather = fetch_weather()
    except Exception as exc:
        print(f"Open-Meteo falhou: {exc}", file=sys.stderr)
        weather = {"daily": {}}

    payload = build_payload(seed, rivers, weather)
    salvar(payload)
    print(f"bairros-alerta.json atualizado ({len(payload['bairros'])} bairros).", file=sys.stderr)


if __name__ == "__main__":
    main()
