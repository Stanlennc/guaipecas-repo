#!/usr/bin/env python3
"""Regenera arquivos *-data.js a partir dos JSON fonte."""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# Essenciais — falha interrompe o script
REQUIRED = [
    ("fetch_apoio.py", []),
    ("fetch_emergencia.py", []),
    ("fetch_explorar.py", []),
    ("fetch_unidades_map.py", ["--from-json"]),
]

# Opcionais — dependem de rede ou bs4; falha só avisa
OPTIONAL = [
    ("fetch_news.py", []),
    ("fetch_rivers.py", []),
    ("fetch_offers.py", []),
    ("fetch_editais.py", []),
    ("fetch_servicos.py", []),
]


def run_script(name, args):
    path = ROOT / name
    if not path.exists():
        print(f"pular {name} (não encontrado)", file=sys.stderr)
        return 0
    print(f"→ {name} {' '.join(args)}".strip(), file=sys.stderr)
    return subprocess.call([sys.executable, str(path), *args], cwd=ROOT.parent)


def main():
    failed = []
    for name, args in REQUIRED:
        if run_script(name, args) != 0:
            failed.append(name)
    for name, args in OPTIONAL:
        if run_script(name, args) != 0:
            print(f"aviso: {name} falhou (opcional)", file=sys.stderr)
    if failed:
        print(f"Falhou: {', '.join(failed)}", file=sys.stderr)
        sys.exit(1)
    print("Dados essenciais regenerados.", file=sys.stderr)


if __name__ == "__main__":
    main()
