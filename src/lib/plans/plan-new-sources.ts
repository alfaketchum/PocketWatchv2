import type { DebtKind, PlanAccount, PlanDebt, PlanDocument, PlanSource } from "./plan-types"

/** Everything in the user's linked accounts a plan can hold, and when each was linked (ISO date, by finance account id). */
export interface LinkedSources {
  accounts: PlanAccount[]
  debts: PlanDebt[]
  linkedAt: Record<string, string>
}

export type NewSource = { type: "account"; account: PlanAccount } | { type: "debt"; debt: PlanDebt }

/**
 * Debts offered here. Mortgages and auto loans are matched to homes and cars by the loan suggestions;
 * card balances are usually paid in full each month (the import leaves them out too).
 */
const OFFERED_DEBTS = new Set<DebtKind>(["student", "other"])

function refIdOf(source: PlanSource | null | undefined): string | null {
  return source?.kind === "finance-account" ? source.refId : null
}

export function newSourceRefId(s: NewSource): string {
  return refIdOf(s.type === "account" ? s.account.source : s.debt.source) ?? ""
}

/**
 * Linked accounts and loans added since the plan was created that it doesn't hold or ignore. One with the same
 * name as something in the plan is skipped: that's usually the same account, reconnected.
 */
export function newSources(doc: PlanDocument, linked: LinkedSources, planCreatedAt: string): NewSource[] {
  const items = [...doc.accounts, ...doc.debts]
  const inPlan = new Set(items.map((i) => refIdOf(i.source)).filter((id): id is string => id !== null))
  const names = new Set(items.map((i) => i.name.trim().toLowerCase()))
  const ignored = new Set(doc.ignoredSources ?? [])
  const created = new Date(planCreatedAt).getTime()
  const isNew = (source: PlanSource | null, name: string) => {
    const id = refIdOf(source)
    if (!id || inPlan.has(id) || ignored.has(id) || names.has(name.trim().toLowerCase())) return false
    const at = linked.linkedAt[id]
    return at !== undefined && new Date(at).getTime() > created
  }
  return [
    ...linked.accounts.filter((a) => isNew(a.source, a.name)).map((account): NewSource => ({ type: "account", account })),
    ...linked.debts
      .filter((d) => OFFERED_DEBTS.has(d.kind) && isNew(d.source, d.name))
      .map((debt): NewSource => ({ type: "debt", debt })),
  ]
}

/** Adds the linked account or loan to the plan as it is today, linked back for "Refresh balances". */
export function applyNewSource(doc: PlanDocument, s: NewSource, newId: (prefix: string) => string): PlanDocument {
  if (s.type === "account") return { ...doc, accounts: [...doc.accounts, { ...s.account, id: newId("acct") }] }
  return { ...doc, debts: [...doc.debts, { ...s.debt, id: newId("debt"), start: { type: "planStart" } }] }
}

/** Stop offering this linked account or loan for this plan. */
export function ignoreNewSource(doc: PlanDocument, s: NewSource): PlanDocument {
  return { ...doc, ignoredSources: [...new Set([...(doc.ignoredSources ?? []), newSourceRefId(s)])] }
}
