import { HELOC_DEFAULTS } from "@/lib/plans/plan-debt-payments"
import type { DebtKind, PlanDebt, PlanDocument } from "@/lib/plans/plan-types"

export const DEBT_KINDS: { value: DebtKind; label: string }[] = [
  { value: "mortgage", label: "Mortgage" },
  { value: "heloc", label: "HELOC" },
  { value: "student", label: "Student loan" },
  { value: "auto", label: "Auto loan" },
  { value: "credit", label: "Credit card" },
  { value: "other", label: "Other" },
]

/** Changing a debt's type: a HELOC gets typical terms and, if it has none, the plan's first home. */
export function withDebtKind(debt: PlanDebt, kind: DebtKind, doc: PlanDocument): Partial<PlanDebt> {
  if (kind !== "heloc") return { kind, heloc: undefined }
  const home = doc.assets.find((a) => a.kind === "home")
  return { kind, heloc: debt.heloc ?? HELOC_DEFAULTS, assetId: debt.assetId ?? home?.id ?? null }
}
