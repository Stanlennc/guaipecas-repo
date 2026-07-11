"""
Busca o nível telemétrico atual do Guaíba e do Jacuí na API oficial da ANA
(HidroWebService) e salva um rivers.json estático para o site consumir.

Requer as variáveis de ambiente ANA_API_USER e ANA_API_PASSWORD
(configuradas como Secrets no GitHub Actions — nunca deixe no código).
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent

ANA_AUTH_URL = "https://www.ana.gov.br/hidrowebservice/EstacoesTelemetricas/OAUth/v1"
ANA_SERIE_URL = "https://www.ana.gov.br/hidrowebservice/EstacoesTelemetricas/HidroinfoanaSerieTelemetricaAdotada/v1"

# TODO: confirmar os códigos de estação exatos após liberação de acesso pela ANA.
STATIONS = {
    "guaiba": {
        "codigo": "00000000",  # TODO: código da estação Cais Mauá / Porto Alegre
        "nome": "Rio Guaíba",
        "local": "Cais Mauá, Porto Alegre",
        "cota_inundacao": 3.00,
    },
    "jacui": {
        "codigo": "00000000",  # TODO: código da estação Dona Francisca
        "nome": "Rio Jacuí",
        "local": "Dona Francisca",
        "cota_inundacao": 7.50,
    },
}


def autenticar():
    user = os.environ["ANA_API_USER"]
    password = os.environ["ANA_API_PASSWORD"]
    resp = requests.get(ANA_AUTH_URL, auth=(user, password), timeout=30)
    resp.raise_for_status()
    return resp.json()["items"]["tokenautenticacao"]


def buscar_estacao(token, codigo):
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


def main():
    try:
        token = autenticar()
    except Exception as e:
        print(f"Falha na autenticação com a ANA: {e}", file=sys.stderr)
        sys.exit(1)

    resultado = {
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "rios": {},
    }

    for chave, estacao in STATIONS.items():
        try:
            medicao = buscar_estacao(token, estacao["codigo"])
            resultado["rios"][chave] = {
                "nome": estacao["nome"],
                "local": estacao["local"],
                "nivel_m": medicao["nivel_m"],
                "cota_inundacao": estacao["cota_inundacao"],
                "data_hora_medicao": medicao["data_hora"],
            }
        except Exception as e:
            print(f"Falha ao buscar {chave}: {e}", file=sys.stderr)

    output = ROOT / "rivers.json"
    with open(output, "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=2)

    print("rivers.json atualizado com sucesso.")


if __name__ == "__main__":
    main()
