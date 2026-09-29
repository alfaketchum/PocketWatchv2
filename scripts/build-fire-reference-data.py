"""Build bundled reference data for the FIRE pages.

Outputs:
  src/lib/fire/data/us-life-table.json   CDC/NCHS United States Life Tables, 2023 (NVSR 74-06):
                                         probability of dying within the year (qx) by age, total/male/female.
  src/lib/fire/data/scf-networth.json    Federal Reserve Survey of Consumer Finances 2022 (summary extract):
                                         weighted net-worth percentiles by age of household head, 2022 dollars.

Run:  uv run --with openpyxl scripts/build-fire-reference-data.py
"""

import csv
import io
import json
import urllib.request
import zipfile
from pathlib import Path

import openpyxl

OUT_DIR = Path(__file__).resolve().parent.parent / "src/lib/fire/data"
CDC_BASE = "https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Publications/NVSR/74-06"
CDC_TABLES = {"total": "Table01.xlsx", "male": "Table02.xlsx", "female": "Table03.xlsx"}
SCF_URL = "https://www.federalreserve.gov/econres/files/scfp2022excel.zip"
SCF_AGE_CLASSES = {1: [0, 34], 2: [35, 44], 3: [45, 54], 4: [55, 64], 5: [65, 74], 6: [75, 120]}
PERCENTILES = [5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95, 99]
MAX_AGE = 100


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(req, timeout=60).read()


def read_qx(xlsx: bytes) -> list[float]:
    ws = openpyxl.load_workbook(io.BytesIO(xlsx), read_only=True).active
    qx = []
    for row in ws.iter_rows(values_only=True):
        label, value = row[0], row[1]
        if isinstance(label, str) and isinstance(value, (int, float)) and label[:1].isdigit():
            qx.append(round(float(value), 6))
    # Final row is the open-ended "100 and over" interval: everyone dies within it.
    return qx[:MAX_AGE] + [1.0]


def weighted_percentile(pairs: list[tuple[float, float]], p: float) -> float:
    pairs = sorted(pairs)
    total = sum(w for _, w in pairs)
    acc = 0.0
    for value, weight in pairs:
        acc += weight
        if acc >= p * total:
            return value
    return pairs[-1][0]


def build_scf() -> dict:
    archive = zipfile.ZipFile(io.BytesIO(fetch(SCF_URL)))
    rows = csv.DictReader(io.TextIOWrapper(archive.open("SCFP2022.csv"), encoding="utf-8"))
    groups: dict[int, list[tuple[float, float]]] = {}
    for row in rows:
        groups.setdefault(int(row["AGECL"]), []).append((float(row["NETWORTH"]), float(row["WGT"])))
    return {
        "source": "Federal Reserve, Survey of Consumer Finances 2022 (summary extract, weighted)",
        "dollars": 2022,
        "percentiles": PERCENTILES,
        "groups": [
            {"ages": SCF_AGE_CLASSES[k], "values": [round(weighted_percentile(groups[k], p / 100)) for p in PERCENTILES]}
            for k in sorted(groups)
        ],
    }


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    life = {
        "source": "CDC/NCHS, United States Life Tables, 2023 (NVSR vol. 74 no. 6)",
        "year": 2023,
        **{name: read_qx(fetch(f"{CDC_BASE}/{file}")) for name, file in CDC_TABLES.items()},
    }
    (OUT_DIR / "us-life-table.json").write_text(json.dumps(life, separators=(",", ":")))
    scf = build_scf()
    (OUT_DIR / "scf-networth.json").write_text(json.dumps(scf, separators=(",", ":")))
    medians = [g["values"][PERCENTILES.index(50)] for g in scf["groups"]]
    print(f"Life table: {len(life['total'])} ages. SCF medians by age group: {medians}")


if __name__ == "__main__":
    main()
