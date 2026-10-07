import { fmtCompact } from "@/components/fire/fire-helpers"
import type { PlanSummary } from "@/lib/plans/plan-types"

export type CashTone = "ok" | "warn" | "bad"

/**
 * Whether the accounts keep paying the bills, said second to net worth: "Lasts", "Runs out at 49" (amber while
 * the plan doesn't go broke), or "Goes broke at 52" (red, the real failure: nothing meaningful left to sell).
 */
export function cashStatus(s: PlanSummary): { value: string; tone: CashTone; note: string } {
  const sale = s.homeSales?.[0]
  if (s.depletedAge === null) {
    return { value: "Lasts", tone: "ok", note: sale ? `by selling ${sale.name} at ${sale.age}` : `to ${s.endAge}` }
  }
  if (s.brokeAge !== null) {
    return { value: `Goes broke at ${s.brokeAge}`, tone: "bad", note: `cash runs out at ${s.depletedAge}${sale ? `, even after selling ${sale.name}` : ""}` }
  }
  const eq = s.equityAtDepletion
  const left = eq ? `${fmtCompact(eq.value)} of property left` : "property left"
  return { value: `Runs out at ${s.depletedAge}`, tone: "warn", note: `${left}${sale ? ` · sold ${sale.name} at ${sale.age}` : ""}` }
}

export const CASH_TONE_CLASS: Record<CashTone, string> = { ok: "text-foreground", warn: "text-warning", bad: "text-error" }
