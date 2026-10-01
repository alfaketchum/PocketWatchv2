import { requiredPayment } from "./plan-debt-payments"
import { allMilestones } from "./plan-milestones"
import type { PlanDocument } from "./plan-types"

export type BuildTab = "assumptions" | "accounts" | "income" | "expenses" | "assets" | "cashflow" | "milestones"

export interface TabStatus {
  state: "empty" | "filled" | "attention"
  /** One line for the tooltip. */
  note: string
}

const MONTHS = 12
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** Things on Assets & debts that make the plan wrong until fixed. */
function debtProblems(doc: PlanDocument): string[] {
  return doc.debts.flatMap((d) => {
    if (d.kind === "heloc") {
      const home = doc.assets.find((a) => a.id === d.assetId && a.kind === "home")
      return home ? [] : [`${d.name} isn't linked to a home`]
    }
    return d.balance > 0 && requiredPayment(d, 0) + (d.extraMonthly ?? 0) <= (d.balance * d.rate) / MONTHS ? [`${d.name}'s payment doesn't cover its interest`] : []
  })
}

function listStatus(count: number, emptyNote: string, noun: string): TabStatus {
  return count === 0 ? { state: "empty", note: emptyNote } : { state: "filled", note: plural(count, noun) }
}

/** Whether each build tab is still empty, filled in, or has something to fix. */
export function planTabStatus(doc: PlanDocument): Record<BuildTab, TabStatus> {
  const problems = debtProblems(doc)
  const owned = doc.assets.length + doc.debts.length
  return {
    assumptions: { state: "filled", note: "People, timeline, inflation and taxes" },
    accounts: listStatus(doc.accounts.filter((a) => a.balance > 0).length, "No money in any account yet", "account"),
    income: listStatus(doc.incomes.length, "No income yet", "income"),
    expenses: listStatus(doc.expenses.length, "No spending yet", "expense"),
    assets:
      problems.length > 0
        ? { state: "attention", note: problems.join("; ") }
        : owned === 0
          ? { state: "empty", note: "Nothing owned or owed yet" }
          : { state: "filled", note: `${plural(doc.assets.length, "asset")}, ${plural(doc.debts.length, "debt")}` },
    cashflow: { state: "filled", note: "Where leftover money goes, and what's spent first" },
    milestones: listStatus(allMilestones(doc).length, "No milestones yet", "milestone"),
  }
}
