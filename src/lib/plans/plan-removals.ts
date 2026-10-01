import type { PlanDocument } from "./plan-types"

type Named = { id: string; name?: string }

/** Lists of named things in a plan, and what to call one with no name. */
const LISTS: { pick: (doc: PlanDocument) => Named[]; noun: string }[] = [
  { pick: (d) => d.accounts, noun: "account" },
  { pick: (d) => d.incomes, noun: "income" },
  { pick: (d) => d.expenses, noun: "expense" },
  { pick: (d) => d.assets, noun: "asset" },
  { pick: (d) => d.debts, noun: "debt" },
  { pick: (d) => d.milestones, noun: "milestone" },
  { pick: (d) => d.children ?? [], noun: "child" },
  { pick: (d) => d.people, noun: "person" },
]

/** Names of the things in `before` that are gone from `after` (by id), in list order. */
export function removedItems(before: PlanDocument, after: PlanDocument): string[] {
  return LISTS.flatMap(({ pick, noun }) => {
    const kept = new Set(pick(after).map((x) => x.id))
    return pick(before)
      .filter((x) => !kept.has(x.id))
      .map((x) => x.name?.trim() || `Untitled ${noun}`)
  })
}

/** "Mortgage", "Mortgage and Car loan", or "Mortgage and 3 more". */
export function removalLabel(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ""
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names[0]} and ${names.length - 1} more`
}
