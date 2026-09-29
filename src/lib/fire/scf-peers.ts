export interface ScfCell {
  ageClass: number
  key: number
  households: number
  values: number[]
}

export interface ScfData {
  source: string
  dollars: number
  percentiles: number[]
  groups: { ages: [number, number]; values: number[] }[]
  incomeBrackets?: number[]
  educationClasses?: Record<string, string>
  ageClasses?: Record<string, [number, number]>
  byIncome?: ScfCell[]
  byEducation?: ScfCell[]
}

export interface PeerComparison {
  ages: [number, number]
  median: number
  /** Estimated percentile of `netWorth` within the group (0–100), linearly interpolated. */
  percentile: number
  /** Net worth at the percentiles shown on the bar. */
  marks: { p: number; value: number }[]
}

export type PeerDimension = "age" | "income" | "education"

export interface PeerQuery {
  age: number
  netWorth: number
  dimension?: PeerDimension
  householdIncome?: number | null
  education?: number | null
}

export interface PeerResult extends PeerComparison {
  dimension: PeerDimension
  /** Human label for the comparison group, e.g. "earning $100k–$150k". */
  groupLabel: string | null
  /** True when the requested cell was too thin and the age-only group was used. */
  fellBack: boolean
}

const MARKS = [25, 50, 75, 90]
/** Cells with fewer surveyed households than this fall back to the age-only group. */
export const MIN_HOUSEHOLDS = 40

function percentileOf(ps: number[], vs: number[], x: number): number {
  if (x <= vs[0]) return (ps[0] * Math.max(0, x)) / Math.max(1, vs[0])
  if (x >= vs[vs.length - 1]) return ps[ps.length - 1]
  const i = vs.findIndex((v) => v >= x)
  const t = (x - vs[i - 1]) / (vs[i] - vs[i - 1] || 1)
  return ps[i - 1] + t * (ps[i] - ps[i - 1])
}

function describe(ps: number[], vs: number[], x: number, ages: [number, number]): PeerComparison {
  return {
    ages,
    median: vs[ps.indexOf(50)],
    percentile: percentileOf(ps, vs, x),
    marks: MARKS.map((p) => ({ p, value: vs[ps.indexOf(p)] })),
  }
}

export function comparePeers(data: ScfData, age: number, netWorth: number): PeerComparison | null {
  const group = data.groups.find((g) => age >= g.ages[0] && age <= g.ages[1])
  return group ? describe(data.percentiles, group.values, netWorth, group.ages) : null
}

function ageClassOf(data: ScfData, age: number): number | null {
  const idx = data.groups.findIndex((g) => age >= g.ages[0] && age <= g.ages[1])
  return idx < 0 ? null : idx + 1
}

function fmtK(v: number): string {
  return v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`
}

function incomeLabel(brackets: number[], key: number): string {
  const lo = brackets[key]
  const hi = brackets[key + 1]
  if (lo === 0) return `earning under ${fmtK(hi)}`
  return hi ? `earning ${fmtK(lo)}–${fmtK(hi)}` : `earning ${fmtK(lo)}+`
}

/** Net worth percentile among households of your age, optionally also your income bracket or education. */
export function comparePeersBy(data: ScfData, q: PeerQuery): PeerResult | null {
  const base = comparePeers(data, q.age, q.netWorth)
  if (!base) return null
  const dimension = q.dimension ?? "age"
  const ageClass = ageClassOf(data, q.age)
  const fallback: PeerResult = { ...base, dimension, groupLabel: null, fellBack: dimension !== "age" }

  if (dimension === "income" && q.householdIncome != null && data.byIncome && data.incomeBrackets) {
    const brackets = data.incomeBrackets
    const key = Math.max(0, brackets.reduce((k, lo, i) => (q.householdIncome! >= lo ? i : k), 0))
    const cell = data.byIncome.find((c) => c.ageClass === ageClass && c.key === key)
    if (!cell || cell.households < MIN_HOUSEHOLDS) return fallback
    return { ...describe(data.percentiles, cell.values, q.netWorth, base.ages), dimension, groupLabel: incomeLabel(brackets, key), fellBack: false }
  }
  if (dimension === "education" && q.education != null && data.byEducation && data.educationClasses) {
    const cell = data.byEducation.find((c) => c.ageClass === ageClass && c.key === q.education)
    if (!cell || cell.households < MIN_HOUSEHOLDS) return fallback
    const label = data.educationClasses[String(q.education)]?.toLowerCase() ?? null
    return { ...describe(data.percentiles, cell.values, q.netWorth, base.ages), dimension, groupLabel: label ? `with ${label}` : null, fellBack: false }
  }
  return dimension === "age" ? { ...base, dimension, groupLabel: null, fellBack: false } : fallback
}
