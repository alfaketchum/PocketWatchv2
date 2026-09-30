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
      return doc.milestones.find((m) => m.id === timing.milestoneId)?.name ?? "Missing milestone"
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

export type DocUpdater = (doc: PlanDocument) => PlanDocument

/** Props shared by every plan editor section. */
export interface PlanEditorProps {
  doc: PlanDocument
  update: (updater: DocUpdater) => void
}
