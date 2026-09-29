/**
 * BLS Occupational Employment and Wage Statistics (OEWS) annual wage percentiles.
 * Series ID: "OEU" + area type (N national / S state) + area (7) + industry (6, all = 000000)
 *            + SOC occupation (6, no dash) + datatype (11–15 = annual 10th/25th/median/75th/90th).
 * Uses API v2 with a registration key when available, else keyless v1 (25 queries/day).
 */
import type { PayPercentiles } from "./compare-income"

const V2_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/"
const V1_URL = "https://api.bls.gov/publicAPI/v1/timeseries/data/"
const TIMEOUT_MS = 20_000

const DATATYPES: [keyof PayPercentiles, string][] = [
  ["p10", "11"],
  ["p25", "12"],
  ["p50", "13"],
  ["p75", "14"],
  ["p90", "15"],
]

/** State postal code → FIPS, for OEWS state area codes. */
const STATE_FIPS: Record<string, string> = {
  AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09", DE: "10", DC: "11", FL: "12", GA: "13",
  HI: "15", ID: "16", IL: "17", IN: "18", IA: "19", KS: "20", KY: "21", LA: "22", ME: "23", MD: "24", MA: "25",
  MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NE: "31", NV: "32", NH: "33", NJ: "34", NM: "35", NY: "36",
  NC: "37", ND: "38", OH: "39", OK: "40", OR: "41", PA: "42", RI: "44", SC: "45", SD: "46", TN: "47", TX: "48",
  UT: "49", VT: "50", VA: "51", WA: "53", WV: "54", WI: "55", WY: "56", PR: "72",
}

export interface OewsResult {
  year: string | null
  national: PayPercentiles | null
  state: PayPercentiles | null
}

function areaPrefix(state: string | null): string | null {
  if (!state) return "N0000000"
  const fips = STATE_FIPS[state]
  return fips ? `S${fips}00000` : null
}

function seriesIds(soc: string, state: string | null): { area: "national" | "state"; key: keyof PayPercentiles; id: string }[] {
  const occ = soc.replace("-", "")
  const out: { area: "national" | "state"; key: keyof PayPercentiles; id: string }[] = []
  for (const area of ["national", "state"] as const) {
    const prefix = areaPrefix(area === "national" ? null : state)
    if (!prefix || (area === "state" && !state)) continue
    for (const [key, dt] of DATATYPES) out.push({ area, key, id: `OEU${prefix}000000${occ}${dt}` })
  }
  return out
}

interface BlsResponse {
  status: string
  message?: string[]
  Results?: { series: { seriesID: string; data: { year: string; value: string }[] }[] }
}

/** Latest OEWS annual wage percentiles for a SOC code, nationally and (optionally) in a state. */
export async function fetchOewsPercentiles(soc: string, state: string | null, apiKey: string | null): Promise<OewsResult> {
  if (!/^\d{2}-\d{4}$/.test(soc)) return { year: null, national: null, state: null }
  const ids = seriesIds(soc, state)
  const body: Record<string, unknown> = { seriesid: ids.map((s) => s.id) }
  if (apiKey) body.registrationkey = apiKey
  const res = await fetch(apiKey ? V2_URL : V1_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`BLS API ${res.status}`)
  const json = (await res.json()) as BlsResponse
  if (json.status !== "REQUEST_SUCCEEDED") throw new Error(`BLS API: ${json.message?.[0] ?? json.status}`)
  const latest = new Map<string, { year: string; value: number }>()
  for (const s of json.Results?.series ?? []) {
    const point = s.data[0]
    const value = point ? Number(point.value) : NaN
    if (point && Number.isFinite(value)) latest.set(s.seriesID, { year: point.year, value })
  }
  const empty = (): PayPercentiles => ({ p10: null, p25: null, p50: null, p75: null, p90: null })
  const out = { national: empty(), state: empty() }
  let year: string | null = null
  for (const s of ids) {
    const hit = latest.get(s.id)
    if (hit) {
      out[s.area][s.key] = hit.value
      year = year ?? hit.year
    }
  }
  const hasAny = (p: PayPercentiles) => Object.values(p).some((v) => v != null)
  return { year, national: hasAny(out.national) ? out.national : null, state: hasAny(out.state) ? out.state : null }
}
