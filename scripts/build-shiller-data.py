"""Build the bundled historical dataset used by the FIRE safe-withdrawal simulator.

Source: Robert Shiller's ie_data.xls (https://shillerdata.com/).
Output: src/lib/fire/data/shiller-monthly.json

Run:  uv run --with xlrd scripts/build-shiller-data.py [path-or-url-to-ie_data.xls]

Each row is one month with REAL (CPI-adjusted) total returns, which is what the
Early Retirement Now SWR series simulates:
  e    real S&P 500 total return (dividends reinvested) for the month
  b    real 10-year Treasury total return for the month
  cape Shiller CAPE (P/E10) at the start of the month, null before 1881
  cpi  consumer price index for the month (Shiller's; BLS CPI-U from 1913, reconstructed before)
"""

import json
import sys
import urllib.request
from pathlib import Path

import xlrd

SHILLER_PAGE = "https://shillerdata.com/"
OUT = Path(__file__).resolve().parent.parent / "src/lib/fire/data/shiller-monthly.json"

COL_DATE = 0
COL_CPI = 4
COL_REAL_TR_PRICE = 9
COL_CAPE = 12
COL_REAL_BOND_INDEX = 18
FIRST_DATA_ROW = 8


def find_download_url() -> str:
    html = urllib.request.urlopen(SHILLER_PAGE, timeout=30).read().decode("utf-8", "ignore")
    marker = "/ie_data.xls"
    end = html.index(marker) + len(marker)
    start = html.rindex('"', 0, end) + 1
    url = html[start:end]
    return "https:" + url if url.startswith("//") else url


def load_workbook(source: str | None) -> xlrd.book.Book:
    if source and Path(source).exists():
        return xlrd.open_workbook(source)
    url = source or find_download_url()
    print(f"Downloading {url}")
    data = urllib.request.urlopen(url, timeout=60).read()
    return xlrd.open_workbook(file_contents=data)


def num(value) -> float | None:
    return float(value) if isinstance(value, (int, float)) else None


def to_ym(date_value: float) -> str:
    year = int(date_value)
    month = int(round((date_value - year) * 100))
    return f"{year:04d}-{month:02d}"


def read_levels(sheet) -> list[dict]:
    rows = []
    for r in range(FIRST_DATA_ROW, sheet.nrows):
        date = num(sheet.cell_value(r, COL_DATE))
        eq = num(sheet.cell_value(r, COL_REAL_TR_PRICE))
        bond = num(sheet.cell_value(r, COL_REAL_BOND_INDEX))
        if date is None or eq is None or bond is None:
            break
        rows.append({
            "ym": to_ym(date),
            "eq": eq,
            "bond": bond,
            "cape": num(sheet.cell_value(r, COL_CAPE)),
            "cpi": num(sheet.cell_value(r, COL_CPI)),
        })
    return rows


def build_months(levels: list[dict]) -> list[dict]:
    # Return for month t is level[t+1]/level[t] - 1, so the final (partial) level only closes the prior month.
    months = []
    for cur, nxt in zip(levels, levels[1:]):
        months.append({
            "ym": cur["ym"],
            "e": round(nxt["eq"] / cur["eq"] - 1, 6),
            "b": round(nxt["bond"] / cur["bond"] - 1, 6),
            "cape": round(cur["cape"], 2) if cur["cape"] else None,
            "cpi": round(cur["cpi"], 4),
        })
    return months


def main() -> None:
    book = load_workbook(sys.argv[1] if len(sys.argv) > 1 else None)
    levels = read_levels(book.sheet_by_name("Data"))
    months = build_months(levels)
    latest_cape = next(m["cape"] for m in reversed(levels) if m["cape"])
    payload = {
        "source": "Robert J. Shiller, ie_data.xls (shillerdata.com)",
        "start": months[0]["ym"],
        "dataThrough": months[-1]["ym"],
        "latestCape": round(latest_cape, 2),
        "latestCapeMonth": next(m["ym"] for m in reversed(levels) if m["cape"]),
        "fields": ["ym", "e", "b", "cape", "cpi"],
        "rows": [[m["ym"], m["e"], m["b"], m["cape"], m["cpi"]] for m in months],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"Wrote {len(months)} months ({payload['start']}..{payload['dataThrough']}) to {OUT}")


if __name__ == "__main__":
    main()
