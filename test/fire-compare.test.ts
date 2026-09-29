import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { MIN_HOUSEHOLDS, comparePeersBy, type ScfData } from "@/lib/fire/scf-peers"
import { millionaireNextDoor, payPosition, zipIncomePercentile } from "@/lib/fire/compare-income"
import { fireInputsSchema } from "@/lib/fire/fire-schema"
import { DEFAULT_FIRE_INPUTS } from "@/lib/fire/fire-constants"

function assertClose(actual: number, expected: number, tolerance: number, message?: string) {
  const diff = Math.abs(actual - expected)
  assert.ok(diff < tolerance, message ?? `Expected ${actual} to be within ${tolerance} of ${expected} (diff: ${diff})`)
}

const load = <T,>(file: string) => JSON.parse(readFileSync(join(process.cwd(), "src/lib/fire/data", file), "utf8")) as T
const scf = load<ScfData>("scf-networth.json")
const zcta = load<{ zips: Record<string, [string | null, number | null, number[], number | null, number | null]> }>("acs-zcta.json")
const occupations = load<{ occupations: { title: string; soc: string | null; median: number }[] }>("acs-occupations.json").occupations

test("peers by income: a cell median maps to the 50th percentile and differs from age-only", () => {
  const cell = scf.byIncome!.find((c) => c.ageClass === 2 && c.key === 2)!
  assert.ok(cell.households >= MIN_HOUSEHOLDS)
  const median = cell.values[scf.percentiles.indexOf(50)]
  const r = comparePeersBy(scf, { age: 40, netWorth: median, dimension: "income", householdIncome: 120_000 })!
  assertClose(r.percentile, 50, 0.5)
  assert.equal(r.groupLabel, "earning $100k–$150k")
  const ageOnly = comparePeersBy(scf, { age: 40, netWorth: median, dimension: "age" })!
  assert.ok(Math.abs(ageOnly.percentile - r.percentile) > 5)
})

test("peers by education, and fallback when the input is missing", () => {
  const r = comparePeersBy(scf, { age: 40, netWorth: 300_000, dimension: "education", education: 4 })!
  assert.equal(r.fellBack, false)
  assert.equal(r.groupLabel, "with college degree")
  const missing = comparePeersBy(scf, { age: 40, netWorth: 300_000, dimension: "education", education: null })!
  assert.equal(missing.fellBack, true)
})

test("Millionaire Next Door thresholds", () => {
  assert.equal(millionaireNextDoor(40, 100_000, 800_000)!.label, "PAW")
  assert.equal(millionaireNextDoor(40, 100_000, 400_000)!.label, "AAW")
  assert.equal(millionaireNextDoor(40, 100_000, 200_000)!.label, "UAW")
  assert.equal(millionaireNextDoor(40, 0, 1)!, null)
})

test("zip income: the zip's own median lands near the 50th percentile", () => {
  for (const zip of ["10001", "94110", "60614"]) {
    const [, median, counts] = zcta.zips[zip]
    assertClose(zipIncomePercentile(counts, median!)!, 50, 6, `${zip} median percentile`)
  }
  const [, , counts] = zcta.zips["94110"]
  assert.ok(zipIncomePercentile(counts, 1_000_000)! > 99)
  assert.ok(zipIncomePercentile(counts, 0)! < 1)
})

test("zip data: state assigned and occupations carry SOC codes", () => {
  assert.equal(zcta.zips["94110"][0], "CA")
  assert.equal(zcta.zips["10001"][0], "NY")
  assert.ok(occupations.length > 500 && occupations.every((o) => o.soc && /^\d{2}-[\dX]{4}$/.test(o.soc)))
})

test("pay position: median = 1×, percentiles interpolate between bands", () => {
  const bands = { p10: 80_000, p25: 100_000, p50: 130_000, p75: 170_000, p90: 210_000 }
  const at = payPosition(130_000, 130_000, bands)
  assert.equal(at.multiple, 1)
  assertClose(at.percentile!, 50, 1e-9)
  assertClose(payPosition(150_000, 130_000, bands).percentile!, 62.5, 1e-9)
  assert.equal(payPosition(150_000, 130_000, null).percentile, null)
})

test("compare inputs validate (zip / SOC format)", () => {
  const ok = { ...DEFAULT_FIRE_INPUTS, compare: { zip: "94110", occupation: "15-1252", education: 4, householdIncome: 200_000, earnedIncome: 150_000 } }
  assert.ok(fireInputsSchema.safeParse(ok).success)
  assert.ok(!fireInputsSchema.safeParse({ ...ok, compare: { ...ok.compare, zip: "9411" } }).success)
  assert.ok(!fireInputsSchema.safeParse({ ...ok, compare: { ...ok.compare, occupation: "151252" } }).success)
  assert.ok(fireInputsSchema.safeParse({ ...ok, compare: { ...ok.compare, occupation: "15-124X" } }).success)
})
