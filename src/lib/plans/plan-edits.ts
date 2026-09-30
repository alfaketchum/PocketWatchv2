import type { PlanDocument, Timing } from "./plan-types"

/** Plan edits that must also clean up references, shared by the editors and milestone removal. */

/** Remove an account and every reference to it (cash-flow orders, payroll contributions). */
export function removeAccount(doc: PlanDocument, accountId: string): PlanDocument {
  return {
    ...doc,
    accounts: doc.accounts.filter((a) => a.id !== accountId),
    incomes: doc.incomes.map((inc) => ({
      ...inc,
      contributions: inc.contributions.filter((c) => c.accountId !== accountId),
    })),
    deposits: (doc.deposits ?? []).filter((d) => d.accountId !== accountId),
    cashFlow: {
      surplusOrder: doc.cashFlow.surplusOrder.filter((t) => t.accountId !== accountId),
      withdrawalOrder: doc.cashFlow.withdrawalOrder.filter((id) => id !== accountId),
    },
  }
}

/** Remove a child along with the 529 account created for them (and every reference to it). */
export function removeChild(doc: PlanDocument, childId: string): PlanDocument {
  const child = doc.children.find((c) => c.id === childId)
  const next = { ...doc, children: doc.children.filter((c) => c.id !== childId) }
  const accountId = child?.plan529.accountId
  const sharedWithAnother = next.children.some((c) => c.plan529.accountId === accountId)
  return accountId && !sharedWithAnother ? removeAccount(next, accountId) : next
}

/** Apply `fn` to every timing in the plan. */
export function mapTimings(doc: PlanDocument, fn: (t: Timing) => Timing): PlanDocument {
  return {
    ...doc,
    incomes: doc.incomes.map((i) => ({ ...i, start: fn(i.start), end: fn(i.end) })),
    expenses: doc.expenses.map((e) => ({ ...e, start: fn(e.start), end: fn(e.end) })),
    assets: doc.assets.map((a) => ({ ...a, start: fn(a.start), end: fn(a.end) })),
    debts: doc.debts.map((d) => ({ ...d, start: fn(d.start) })),
    milestones: doc.milestones.map((m) => ({ ...m, timing: fn(m.timing) })),
    adjustments: (doc.adjustments ?? []).map((a) => ({ ...a, timing: fn(a.timing) })),
    deposits: (doc.deposits ?? []).map((d) => ({ ...d, timing: fn(d.timing) })),
  }
}

/** Remove a person; ages that referred to them are re-pointed at the first person. */
export function removePerson(doc: PlanDocument, personId: string): PlanDocument {
  const people = doc.people.filter((p) => p.id !== personId)
  const primary = people[0]
  if (!primary) return doc
  const remapped = mapTimings(doc, (t) => (t.type === "age" && t.personId === personId ? { ...t, personId: primary.id } : t))
  return {
    ...remapped,
    people,
    accounts: remapped.accounts.map((a) => (a.owner === personId ? { ...a, owner: null } : a)),
  }
}

/** Remove an asset and the loans that financed it (a mortgage without its home means nothing). */
export function removeAsset(doc: PlanDocument, assetId: string): PlanDocument {
  return {
    ...doc,
    assets: doc.assets.filter((a) => a.id !== assetId),
    debts: doc.debts.filter((d) => d.assetId !== assetId),
  }
}
