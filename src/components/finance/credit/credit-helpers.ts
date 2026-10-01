import type { CreditScoreItem } from "@/hooks/finance/use-credit-scores"

const YEAR_MS = 365 * 24 * 60 * 60 * 1000

export function fmtScoreDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

/** Change from the previous entry of the same model, and from the entry closest to a year before. */
export function scoreChanges(scores: CreditScoreItem[]): { sinceLast: number | null; overYear: number | null } {
  const [latest, ...rest] = scores
  if (!latest) return { sinceLast: null, overYear: null }
  const same = rest.filter((s) => s.model === latest.model)
  const target = new Date(latest.date).getTime() - YEAR_MS
  const yearAgo = same.reduce<CreditScoreItem | null>((best, s) => {
    const t = new Date(s.date).getTime()
    if (t > target + YEAR_MS / 4) return best
    return !best || Math.abs(t - target) < Math.abs(new Date(best.date).getTime() - target) ? s : best
  }, null)
  return { sinceLast: same[0] ? latest.score - same[0].score : null, overYear: yearAgo ? latest.score - yearAgo.score : null }
}

export function signed(n: number): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)}`
}
