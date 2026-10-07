import { UNCATEGORIZED } from "./plan-constants"
import { heirsTaxRate } from "./plan-conversions"
import { ITEM_KINDS, money, pct, ruleLabel, yesNo, type ItemKind } from "./plan-diff-items"
import type { PlanDocument, PlanExpense, PlanSettings } from "./plan-types"

/**
 * What differs between two plans' inputs, for Compare: changed fields on items both plans have (matched by id, as a
 * duplicated plan keeps them, then by name), and items only one of them has. Values are display text.
 */
export interface InputChange {
  label: string
  /** Null when the item is only in the other plan. */
  a: string | null
  b: string | null
}

export interface InputDiffGroup {
  key: string
  title: string
  changes: InputChange[]
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

const SETTING_FIELDS: { label: string; value: (s: PlanSettings) => string }[] = [
  { label: "Plan starts", value: (s) => `${MONTHS[s.startMonth - 1] ?? s.startMonth} ${s.startYear}` },
  { label: "Plan runs to age", value: (s) => String(s.endAge) },
  { label: "Inflation", value: (s) => pct(s.inflation) },
  { label: "Inflation source", value: (s) => s.inflationMode ?? "custom" },
  { label: "Tax mode", value: (s) => (s.taxMode === "brackets" ? "Brackets" : "Flat") },
  { label: "Income tax rate", value: (s) => (s.taxMode === "flat" ? pct(s.incomeTaxRate) : "—") },
  { label: "Capital gains rate", value: (s) => (s.taxMode === "flat" ? pct(s.capitalGainsRate) : "—") },
  { label: "State", value: (s) => s.state ?? "None" },
  { label: "Filing status", value: (s) => (s.filingStatus === "joint" ? "Joint" : "Single") },
  { label: "Cash buffer", value: (s) => money(s.cashBuffer) },
  { label: "Protect buffer", value: (s) => yesNo(s.protectBuffer) },
  { label: "Spending rule", value: (s) => ruleLabel(s.spendingRule) },
  { label: "Spending profile", value: (s) => s.spendingProfile ?? "None" },
  { label: "Returns shown", value: (s) => s.returnBasis ?? "nominal" },
  { label: "Social Security cut", value: (s) => (s.ssCut ? `${pct(s.ssCut.share, 0)} from ${s.ssCut.fromYear}` : "None") },
  { label: "Credit score", value: (s) => (s.credit ? String(s.credit.score) : "—") },
  { label: "Heirs' tax rate", value: (s) => pct(heirsTaxRate(s), 0) },
]

function settingChanges(a: PlanDocument, b: PlanDocument): InputChange[] {
  return SETTING_FIELDS.map((f) => ({ label: f.label, a: f.value(a.settings), b: f.value(b.settings) })).filter((c) => c.a !== c.b)
}

function cashFlowChanges(a: PlanDocument, b: PlanDocument): InputChange[] {
  const names = (doc: PlanDocument, ids: string[]) => ids.map((id) => doc.accounts.find((x) => x.id === id)?.name ?? "?").join(" → ") || "Default"
  const fields: { label: string; value: (d: PlanDocument) => string }[] = [
    { label: "Surplus goes to", value: (d) => names(d, d.cashFlow.surplusOrder.map((t) => t.accountId)) },
    { label: "Withdraw from", value: (d) => names(d, d.cashFlow.withdrawalOrder) },
    { label: "Pre-tax accounts last before 59½", value: (d) => yesNo(d.cashFlow.avoidEarlyPenalty ?? true) },
  ]
  return fields.map((f) => ({ label: f.label, a: f.value(a), b: f.value(b) })).filter((c) => c.a !== c.b)
}

/** JSON with keys sorted, so two copies of the same item compare equal whatever order their keys were saved in. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined)
    return `{${entries.sort(([x], [y]) => x.localeCompare(y)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`
  }
  return JSON.stringify(value)
}

/** Pairs each of A's items with B's: same id first, then same name among those left. */
export function matchItems<T extends { id: string }>(as: T[], bs: T[], name: (item: T) => string) {
  const pairs: [T, T][] = []
  const restB = new Map(bs.map((b) => [b.id, b]))
  const restA: T[] = []
  for (const a of as) {
    const b = restB.get(a.id)
    if (b) {
      pairs.push([a, b])
      restB.delete(a.id)
    } else restA.push(a)
  }
  const onlyA: T[] = []
  for (const a of restA) {
    const b = [...restB.values()].find((x) => name(x) === name(a))
    if (b) {
      pairs.push([a, b])
      restB.delete(b.id)
    } else onlyA.push(a)
  }
  return { pairs, onlyA, onlyB: [...restB.values()] }
}

function itemChanges<T extends { id: string }>(kind: ItemKind<T>, a: PlanDocument, b: PlanDocument): InputChange[] {
  const { pairs, onlyA, onlyB } = matchItems(kind.items(a), kind.items(b), (x) => kind.name(x, a))
  const summary = (item: T, doc: PlanDocument) => kind.fields[0]?.value(item, doc) ?? "Included"
  const changed = pairs.flatMap(([x, y]) => {
    const fields = kind.fields
      .map((f) => ({ label: `${kind.name(y, b)} · ${f.label}`, a: f.value(x, a), b: f.value(y, b) }))
      .filter((c) => c.a !== c.b)
    // Something we don't list by name changed (a vesting schedule, a running cost…): still say so.
    if (fields.length === 0 && stable({ ...x, id: null }) !== stable({ ...y, id: null })) {
      return [{ label: `${kind.name(y, b)} · Other details`, a: "Differs", b: "Differs" }]
    }
    return fields
  })
  return [
    ...changed,
    ...onlyA.map((x) => ({ label: kind.name(x, a), a: summary(x, a), b: null })),
    ...onlyB.map((y) => ({ label: kind.name(y, b), a: null, b: summary(y, b) })),
  ]
}

interface CategoryTotal {
  /** Recurring lines' yearly amounts and one-time costs, today's dollars. */
  yearly: number
  once: number
  /** Every line in it, ids left out, to tell when something besides the totals differs. */
  lines: string[]
}

function categoryTotals(expenses: PlanExpense[]): Map<string, CategoryTotal> {
  const out = new Map<string, CategoryTotal>()
  for (const e of expenses) {
    const key = e.category ?? UNCATEGORIZED
    const cur = out.get(key) ?? { yearly: 0, once: 0, lines: [] }
    out.set(key, {
      yearly: cur.yearly + (e.oneTime ? 0 : e.amount),
      once: cur.once + (e.oneTime ? e.amount : 0),
      lines: [...cur.lines, stable({ ...e, id: null })],
    })
  }
  return out
}

function categoryText(t: CategoryTotal): string {
  const parts = [...(t.yearly > 0 || t.once === 0 ? [`${money(t.yearly)}/yr`] : []), ...(t.once > 0 ? [`${money(t.once)} once`] : [])]
  return parts.join(" + ")
}

/**
 * Expenses compared by category, not line by line (two plans rarely name their lines alike): each category's yearly
 * total and one-time costs; when those match but its lines differ (timing, growth, how it's split), that's said too.
 */
function expenseCategoryChanges(a: PlanDocument, b: PlanDocument): InputChange[] {
  const ta = categoryTotals(a.expenses)
  const tb = categoryTotals(b.expenses)
  const names = [...new Set([...ta.keys(), ...tb.keys()])].sort((x, y) => Number(x === UNCATEGORIZED) - Number(y === UNCATEGORIZED) || x.localeCompare(y))
  return names.flatMap((name): InputChange[] => {
    const x = ta.get(name)
    const y = tb.get(name)
    const change = { label: name, a: x ? categoryText(x) : null, b: y ? categoryText(y) : null }
    if (change.a !== change.b) return [change]
    const same = x && y && [...x.lines].sort().join("\n") === [...y.lines].sort().join("\n")
    return same ? [] : [{ label: `${name} · Timing, growth or lines`, a: "Differs", b: "Differs" }]
  })
}

/** Every input that differs between plan A and plan B, grouped like the editor's tabs; groups with no changes left out. */
export function diffPlanInputs(a: PlanDocument, b: PlanDocument): InputDiffGroup[] {
  const items = ITEM_KINDS.map((kind) => ({ key: kind.key, title: kind.title, changes: itemChanges(kind, a, b) }))
  // Expenses sit after income, as in the editor's tabs.
  const afterIncome = items.findIndex((g) => g.key === "incomes") + 1
  const groups: InputDiffGroup[] = [
    { key: "settings", title: "Assumptions", changes: settingChanges(a, b) },
    ...items.slice(0, afterIncome),
    { key: "expenses", title: "Expenses", changes: expenseCategoryChanges(a, b) },
    ...items.slice(afterIncome),
    { key: "cashflow", title: "Cash flow", changes: cashFlowChanges(a, b) },
  ]
  return groups.filter((g) => g.changes.length > 0)
}
