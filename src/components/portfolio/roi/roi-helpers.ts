/** Unit price with precision that suits its size ($1,234.56 · $0.2422 · $0.00001262). */
export function formatUnitPrice(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "$0"
  const abs = Math.abs(value)
  const digits = abs >= 1 ? 2 : abs >= 0.01 ? 4 : 0
  if (digits > 0) {
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
  }
  return `$${value.toPrecision(4)}`
}

/** "+12.3%" / "-4.5%" / "—" with the matching color class. */
export function formatRoi(pct: number | null): { text: string; colorClass: string } {
  if (pct === null || !Number.isFinite(pct)) return { text: "—", colorClass: "text-foreground-muted" }
  const text = `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`
  return { text, colorClass: pct > 0 ? "text-success" : pct < 0 ? "text-error" : "text-foreground-muted" }
}
