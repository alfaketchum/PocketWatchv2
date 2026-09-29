export interface ScfData {
  source: string
  dollars: number
  percentiles: number[]
  groups: { ages: [number, number]; values: number[] }[]
}

export interface PeerComparison {
  ages: [number, number]
  median: number
  /** Estimated percentile of `netWorth` within the age group (0–100), linearly interpolated. */
  percentile: number
  /** Net worth at the percentiles shown on the bar. */
  marks: { p: number; value: number }[]
}

const MARKS = [25, 50, 75, 90, 99]

export function comparePeers(data: ScfData, age: number, netWorth: number): PeerComparison | null {
  const group = data.groups.find((g) => age >= g.ages[0] && age <= g.ages[1])
  if (!group) return null
  const ps = data.percentiles
  const vs = group.values
  let percentile: number
  if (netWorth <= vs[0]) percentile = ps[0] * Math.max(0, netWorth) / Math.max(1, vs[0])
  else if (netWorth >= vs[vs.length - 1]) percentile = ps[ps.length - 1]
  else {
    const i = vs.findIndex((v) => v >= netWorth)
    const t = (netWorth - vs[i - 1]) / (vs[i] - vs[i - 1] || 1)
    percentile = ps[i - 1] + t * (ps[i] - ps[i - 1])
  }
  return {
    ages: group.ages,
    median: vs[ps.indexOf(50)],
    percentile,
    marks: MARKS.map((p) => ({ p, value: vs[ps.indexOf(p)] })),
  }
}
