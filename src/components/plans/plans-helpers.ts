import { allMilestones } from "@/lib/plans/plan-milestones"
import { ageAtStart } from "@/lib/plans/plan-timing"
import type { PlanDocument, Timing } from "@/lib/plans/plan-types"

/** Short unique id for a new plan item. */
export function newItemId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/** Human label for a timing, e.g. "Age 65", "2030", "Retirement". */
export function timingLabel(timing: Timing, doc: PlanDocument): string {
  switch (timing.type) {
    case "planStart":
      return "Now"
    case "planEnd":
      return "End of plan"
    case "year":
      return String(timing.year)
    case "age": {
      const person = doc.people.find((p) => p.id === timing.personId)
      const who = doc.people.length > 1 && person ? `${person.name} ` : ""
      return `${who}age ${timing.age}`
    }
    case "milestone":
      return allMilestones(doc).find((m) => m.id === timing.milestoneId)?.name ?? "Missing milestone"
  }
}

/** Age of the first person at plan start. */
export function primaryAge(doc: PlanDocument): number {
  const person = doc.people[0]
  return person ? ageAtStart(person, doc.settings) : 0
}

/** Replace the item with `id` in a list with `patch` applied. */
export function patchItem<T extends { id: string }>(items: T[], id: string, patch: Partial<T>): T[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item))
}

/** Remove an account and every reference to it (cash-flow orders, payroll contributions). */
export function removeAccount(doc: PlanDocument, accountId: string): PlanDocument {
  return {
    ...doc,
    accounts: doc.accounts.filter((a) => a.id !== accountId),
    incomes: doc.incomes.map((inc) => ({
      ...inc,
      contributions: inc.contributions.filter((c) => c.accountId !== accountId),
    })),
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

export type DocUpdater = (doc: PlanDocument) => PlanDocument

/** Props shared by every plan editor section. */
export interface PlanEditorProps {
  doc: PlanDocument
  update: (updater: DocUpdater) => void
  /** List (cards) or compact table; only list-style tabs use it. */
  view?: "list" | "table"
  /** From the table: open an item's full editor in list view. */
  onEditItem?: (id: string) => void
}

/** DOM id of an item's card in list view, so the table can jump to it. */
export const planItemAnchor = (id: string) => `plan-item-${id}`

/** Apply `fn` to every timing in the plan. */
export function mapTimings(doc: PlanDocument, fn: (t: Timing) => Timing): PlanDocument {
  return {
    ...doc,
    incomes: doc.incomes.map((i) => ({ ...i, start: fn(i.start), end: fn(i.end) })),
    expenses: doc.expenses.map((e) => ({ ...e, start: fn(e.start), end: fn(e.end) })),
    assets: doc.assets.map((a) => ({ ...a, start: fn(a.start), end: fn(a.end) })),
    debts: doc.debts.map((d) => ({ ...d, start: fn(d.start) })),
    milestones: doc.milestones.map((m) => ({ ...m, timing: fn(m.timing) })),
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
