"""Build bundled data for FIRE › Compare.

Outputs (src/lib/fire/data/):
  acs-zcta.json         Per ZIP Code Tabulation Area (ACS 2019–2023 5-year, table-based summary file):
                        state, median household income (B19013), household-income bracket counts (B19001),
                        median home value (B25077), median gross rent (B25064). Server-side only.
  acs-occupations.json  Detailed occupations with national median full-time, year-round earnings (B24121)
                        and their 2018 SOC codes (Census occupation-code crosswalk) for BLS lookups.

Run:  uv run --with openpyxl scripts/build-compare-data.py [cache-dir]
"""

import io
import json
import re
import sys
import urllib.request
from pathlib import Path

import openpyxl

OUT = Path(__file__).resolve().parent.parent / "src/lib/fire/data"
ACS = "https://www2.census.gov/programs-surveys/acs/summary_file/2023/table-based-SF"
CROSSWALK = "https://www2.census.gov/programs-surveys/demo/guidance/industry-occupation/2018-occupation-code-list-and-crosswalk.xlsx"
ZCTA_COUNTY = "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt"
ZCTA_PREFIX = "860Z200US"

STATE_FIPS = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC",
    "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
    "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT",
    "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
    "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
    "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY", "72": "PR",
}


def fetch(url: str, cache: Path | None) -> bytes:
    if cache:
        local = cache / Path(url).name
        if local.exists():
            return local.read_bytes()
    data = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=300).read()
    if cache:
        (cache / Path(url).name).write_bytes(data)
    return data


def acs_table(table: str, cache: Path | None) -> tuple[list[str], dict[str, list[str]]]:
    text = fetch(f"{ACS}/data/5YRData/acsdt5y2023-{table}.dat", cache).decode("utf-8")
    lines = text.splitlines()
    header = lines[0].split("|")
    rows = {}
    for line in lines[1:]:
        cells = line.split("|")
        rows[cells[0]] = cells
    return header, rows


def num(value: str) -> int | None:
    try:
        v = int(float(value))
        return v if v >= 0 else None
    except ValueError:
        return None


def zcta_states(cache: Path | None) -> dict[str, str]:
    """ZCTA → state postal code, by the largest land-area overlap."""
    best: dict[str, tuple[int, str]] = {}
    for line in fetch(ZCTA_COUNTY, cache).decode("utf-8-sig").splitlines()[1:]:
        c = line.split("|")
        zcta, county, area = c[1], c[9], c[16]
        if not zcta or not county:
            continue
        land = int(area or 0)
        state = STATE_FIPS.get(county[:2])
        if state and land >= best.get(zcta, (-1, ""))[0]:
            best[zcta] = (land, state)
    return {z: s for z, (_, s) in best.items()}


def build_zcta(cache: Path | None) -> dict:
    states = zcta_states(cache)
    _, median = acs_table("b19013", cache)
    h19001, dist = acs_table("b19001", cache)
    _, home = acs_table("b25077", cache)
    _, rent = acs_table("b25064", cache)
    bracket_cols = [h19001.index(f"B19001_E{i:03d}") for i in range(2, 18)]
    out = {}
    for geo, cells in dist.items():
        if not geo.startswith(ZCTA_PREFIX):
            continue
        zcta = geo[len(ZCTA_PREFIX):]
        counts = [num(cells[i]) or 0 for i in bracket_cols]
        if sum(counts) == 0:
            continue
        out[zcta] = [
            states.get(zcta),
            num(median.get(geo, ["", ""])[1]),
            counts,
            num(home.get(geo, ["", ""])[1]),
            num(rent.get(geo, ["", ""])[1]),
        ]
    return {
        "source": "U.S. Census Bureau, ACS 2019–2023 5-year estimates (B19013, B19001, B25077, B25064), 2023 dollars",
        "brackets": [0, 10_000, 15_000, 20_000, 25_000, 30_000, 35_000, 40_000, 45_000, 50_000,
                     60_000, 75_000, 100_000, 125_000, 150_000, 200_000],
        "fields": ["state", "medianIncome", "bracketCounts", "medianHomeValue", "medianRent"],
        "zips": out,
    }


def norm(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()


def build_occupations(cache: Path | None) -> dict:
    wb = openpyxl.load_workbook(io.BytesIO(fetch(CROSSWALK, cache)), read_only=True)
    soc_by_title = {}
    for row in wb["2018 Census Occ Code List"].iter_rows(values_only=True):
        title, code, soc = row[1], row[2], row[3]
        # Census codes are stored as numbers in some rows and zero-padded text in others.
        code_ok = isinstance(code, int) or (isinstance(code, str) and code.isdigit())
        if isinstance(title, str) and code_ok and isinstance(soc, str):
            soc_by_title[norm(title)] = soc.strip()
    shells = fetch(f"{ACS}/documentation/ACS20235YR_Table_Shells.txt", cache).decode("utf-8", "ignore")
    labels = {}
    for line in shells.splitlines():
        parts = line.split("|")
        if len(parts) > 4 and parts[0] == "B24121" and parts[3].startswith("B24121_") and parts[3] != "B24121_001":
            labels[parts[3].replace("B24121_", "B24121_E")] = parts[4].strip()
    header, rows = acs_table("b24121", cache)
    us = rows["0100000US"]
    occupations = []
    for col, title in labels.items():
        if col not in header:
            continue
        median = num(us[header.index(col)])
        if median:
            occupations.append({"title": title, "soc": soc_by_title.get(norm(title)), "median": median})
    occupations.sort(key=lambda o: o["title"])
    return {
        "source": "U.S. Census Bureau, ACS 2019–2023 5-year (B24121): median earnings, full-time year-round workers, 2023 dollars",
        "occupations": occupations,
    }


def main() -> None:
    cache = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    OUT.mkdir(parents=True, exist_ok=True)
    zcta = build_zcta(cache)
    (OUT / "acs-zcta.json").write_text(json.dumps(zcta, separators=(",", ":")))
    occ = build_occupations(cache)
    (OUT / "acs-occupations.json").write_text(json.dumps(occ, separators=(",", ":")))
    matched = sum(1 for o in occ["occupations"] if o["soc"])
    print(f"ZCTAs: {len(zcta['zips'])}. Occupations: {len(occ['occupations'])} ({matched} with SOC codes).")


if __name__ == "__main__":
    main()
