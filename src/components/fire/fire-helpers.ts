import { formatCurrency } from "@/lib/utils"

export function fmtPct(value: number | null | undefined, decimals = 1): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return `${(value * 100).toFixed(decimals)}%`
}

/** Success rates round down, so a single failed cohort never displays as 100%. */
export function fmtSuccess(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return "—"
  return `${Math.floor(rate * 100 + 1e-9)}%`
}

export function fmtMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return formatCurrency(value, "USD", 0)
}

/** $1.2M / $850k style for chart axes and dense tiles. */
export function fmtCompact(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? "-" : ""
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(abs >= 1e13 ? 0 : 1)}T`
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(abs >= 1e10 ? 0 : 1)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}k`
  return `${sign}$${abs.toFixed(0)}`
}

/** "Reached", "in 7.3 years", or "Not on current path". */
export function fmtYearsAway(years: number | null): string {
  if (years === null) return "Not on current path"
  if (years <= 0) return "Reached"
  if (years < 1) return `in ${Math.max(1, Math.round(years * 12))} months`
  return `in ${years.toFixed(1)} years`
}

export function fmtAge(age: number | null): string {
  return age === null ? "—" : `age ${Math.floor(age)}`
}

/** "2026-09" → "Sep 2026". */
export function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number)
  if (!y || !m) return ym
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

/** Background for a success-rate / WR heat cell: error → warning → success. */
export function heatColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t))
  if (clamped < 0.5) {
    return `color-mix(in oklab, var(--error) ${Math.round((1 - clamped * 2) * 100)}%, var(--warning))`
  }
  return `color-mix(in oklab, var(--success) ${Math.round((clamped - 0.5) * 200)}%, var(--warning))`
}
