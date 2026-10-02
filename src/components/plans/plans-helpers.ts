import type { ReactNode } from "react"
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
    case "milestone": {
      const name = allMilestones(doc).find((m) => m.id === timing.milestoneId)?.name ?? "Missing milestone"
      const after = timing.offsetYears ?? 0
      return after > 0 ? `${after} yr${after === 1 ? "" : "s"} after ${name}` : name
    }
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



export type DocUpdater = (doc: PlanDocument) => PlanDocument

/** Props shared by every plan editor section. */
export interface PlanEditorProps {
  doc: PlanDocument
  update: (updater: DocUpdater) => void
  /** Compact (table) or Detailed (cards); only tabs holding lists use it. */
  view?: "compact" | "detailed"
  /** From the compact table: open an item's full editor in the detailed view. */
  onEditItem?: (id: string) => void
  /** The Compact / Detailed switch, shown at the right of the tab's toolbar. */
  viewToggle?: ReactNode
  /** When the plan was created (ISO); accounts linked after it are offered to the plan. */
  planCreatedAt?: string
}

/** DOM id of an item's card in detailed view, so the table can jump to it. */
export const planItemAnchor = (id: string) => `plan-item-${id}`


