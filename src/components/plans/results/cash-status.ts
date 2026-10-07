import { fmtCompact } from "@/components/fire/fire-helpers"
import type { PlanSummary } from "@/lib/plans/plan-types"

export type CashTone = "ok" | "warn" | "bad"

/**
 * Whether the accounts fund every year's spending, said second to net worth: "Funded to 95", "Portfolio depleted at 49"
 * (amber while assets remain), or "Assets exhausted at 52" (red, the real failure: net worth under a year of spending).
 */
export function cashStatus(s: PlanSummary): { value: string; tone: CashTone; note: string } {
  const sale = s.homeSales?.[0]
  if (s.depletedAge === null) {
    return { value: `Funded to ${s.endAge}`, tone: "ok", note: sale ? `after selling ${sale.name} at ${sale.age}` : "no unfunded years" }
  }
  if (s.brokeAge !== null) {
    return { value: `Assets exhausted at ${s.brokeAge}`, tone: "bad", note: `portfolio depleted at ${s.depletedAge}${sale ? `, even after selling ${sale.name}` : ""}` }
  }
  const eq = s.equityAtDepletion
  const left = eq ? `${fmtCompact(eq.value)} property equity remaining` : "property equity remaining"
  return { value: `Portfolio depleted at ${s.depletedAge}`, tone: "warn", note: `${left}${sale ? ` · sold ${sale.name} at ${sale.age}` : ""}` }
}

export const CASH_TONE_CLASS: Record<CashTone, string> = { ok: "text-foreground", warn: "text-warning", bad: "text-error" }
