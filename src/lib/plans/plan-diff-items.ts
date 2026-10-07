import { fmtMoney, fmtPct } from "@/components/fire/fire-helpers"
import { timingLabel } from "@/components/plans/plans-helpers"
import { conversionModeLabel } from "./plan-conversions"
import type { PlanAdjustment, PlanConversion, PlanDocument, SpendingRule, Timing } from "./plan-types"

/**
 * What Compare lists for each kind of plan item: the fields worth naming, each shown as text. Values are formatted
 * against their own plan (a timing reads "Retirement" or "Age 60" in the words that plan uses).
 */
export interface DiffField<T> {
  label: string
  value: (item: T, doc: PlanDocument) => string
}

export interface ItemKind<T extends { id: string }> {
  key: string
  title: string
  items: (doc: PlanDocument) => T[]
  name: (item: T, doc: PlanDocument) => string
  fields: DiffField<T>[]
}

export const money = (v: number | null | undefined) => fmtMoney(v)
export const pct = (v: number | null | undefined, decimals = 1) => fmtPct(v, decimals)
export const yesNo = (v: boolean | undefined) => (v ? "Yes" : "No")
const growth = (g: number | null) => (g === null ? "Inflation" : pct(g))
const when = (t: Timing, doc: PlanDocument) => timingLabel(t, doc)
const perYear = (v: number) => `${money(v)}/yr`
const accountName = (doc: PlanDocument, id: string | null | undefined) =>
  doc.accounts.find((a) => a.id === id)?.name ?? "—"

const RULE_LABEL: Record<SpendingRule["kind"], string> = { guardrails: "Guardrails", percent: "% of portfolio", cape: "CAPE-based" }

export function ruleLabel(rule: SpendingRule | undefined): string {
  if (!rule) return "Spend as planned"
  if (rule.kind === "guardrails") return `${RULE_LABEL.guardrails} (±${pct(rule.band, 0)} band, ${pct(rule.step, 0)} step)`
  if (rule.kind === "percent") return `${RULE_LABEL.percent} (${pct(rule.rate)})`
  return `${RULE_LABEL.cape} (${rule.a} + ${rule.b}/CAPE)`
}

function adjustmentName(adj: PlanAdjustment): string {
  if (adj.kind === "taxRates") return "Tax rates change"
  if (adj.kind === "spending") return "Spending change"
  if (adj.kind === "filingStatus") return "Filing status change"
  return "Move"
}

function adjustmentValue(adj: PlanAdjustment): string {
  if (adj.kind === "taxRates") return `${pct(adj.incomeTaxRate)} income · ${pct(adj.capitalGainsRate)} gains`
  if (adj.kind === "spending") return `${adj.percent > 0 ? "+" : ""}${pct(adj.percent, 0)}`
  if (adj.kind === "filingStatus") return adj.status === "joint" ? "Joint" : "Single"
  return adj.state ?? "No state tax"
}

/** Every kind of item a plan holds, in the order the editor tabs show them. */
export const ITEM_KINDS: ItemKind<{ id: string }>[] = [
  {
    key: "people",
    title: "People",
    items: (d) => d.people,
    name: (p) => p.name,
    fields: [{ label: "Born", value: (p) => `${p.birthMonth}/${p.birthYear}` }],
  } satisfies ItemKind<PlanDocument["people"][number]>,
  {
    key: "accounts",
    title: "Accounts",
    items: (d) => d.accounts,
    name: (a) => a.name,
    fields: [
      { label: "Balance", value: (a) => money(a.balance) },
      { label: "Return", value: (a) => pct(a.returnRate) },
      { label: "Tax treatment", value: (a) => a.taxTreatment },
      { label: "Cost basis", value: (a) => (a.costBasis === null ? "Whole balance" : money(a.costBasis)) },
    ],
  } satisfies ItemKind<PlanDocument["accounts"][number]>,
  {
    key: "incomes",
    title: "Income",
    items: (d) => d.incomes,
    name: (i) => i.name,
    fields: [
      { label: "Amount", value: (i) => (i.oneTime ? money(i.amount) : perYear(i.amount)) },
      { label: "Growth", value: (i) => growth(i.growth) },
      { label: "Starts", value: (i, d) => when(i.start, d) },
      { label: "Ends", value: (i, d) => (i.oneTime ? "—" : when(i.end, d)) },
      { label: "Claim age", value: (i) => (i.socialSecurity ? String(i.socialSecurity.claimAge) : "—") },
      {
        label: "Contributions",
        value: (i, d) => i.contributions.map((c) => `${pct(c.percent)} → ${accountName(d, c.accountId)}`).join(", ") || "None",
      },
    ],
  } satisfies ItemKind<PlanDocument["incomes"][number]>,
  {
    key: "assets",
    title: "Assets",
    items: (d) => d.assets,
    name: (a) => a.name,
    fields: [
      { label: "Value", value: (a) => money(a.value) },
      { label: "Appreciation", value: (a) => pct(a.appreciation) },
      { label: "Bought", value: (a, d) => when(a.start, d) },
      { label: "Sold", value: (a, d) => when(a.end, d) },
      { label: "Paid with", value: (a) => a.financing?.mode ?? "cash" },
    ],
  } satisfies ItemKind<PlanDocument["assets"][number]>,
  {
    key: "debts",
    title: "Debts",
    items: (d) => d.debts,
    name: (x) => x.name,
    fields: [
      { label: "Balance", value: (x) => money(x.balance) },
      { label: "Rate", value: (x) => pct(x.rate, 2) },
      { label: "Payment", value: (x) => `${money(x.monthlyPayment)}/mo` },
      { label: "Extra", value: (x) => `${money(x.extraMonthly ?? 0)}/mo` },
      { label: "Starts", value: (x, d) => when(x.start, d) },
    ],
  } satisfies ItemKind<PlanDocument["debts"][number]>,
  {
    key: "milestones",
    title: "Milestones",
    items: (d) => d.milestones,
    name: (m) => m.name,
    fields: [{ label: "When", value: (m, d) => when(m.timing, d) }],
  } satisfies ItemKind<PlanDocument["milestones"][number]>,
  {
    key: "children",
    title: "Kids",
    items: (d) => d.children,
    name: (c) => c.name,
    fields: [
      { label: "Born", value: (c) => String(c.birthYear) },
      { label: "Raising", value: (c) => (c.raising.enabled ? `${perYear(c.raising.annualCost)} to ${c.raising.untilAge}` : "Off") },
      { label: "College", value: (c) => (c.college.enabled ? `${perYear(c.college.annualCost)} × ${c.college.years}` : "Off") },
      { label: "529", value: (c) => (c.plan529.enabled ? perYear(c.plan529.annualContribution) : "Off") },
      { label: "Support", value: (c) => (c.support.enabled ? `${perYear(c.support.annualAmount)} × ${c.support.years}` : "Off") },
    ],
  } satisfies ItemKind<PlanDocument["children"][number]>,
  {
    key: "adjustments",
    title: "Changes over time",
    items: (d) => d.adjustments,
    name: (a) => adjustmentName(a),
    fields: [
      { label: "When", value: (a, d) => when(a.timing, d) },
      { label: "To", value: (a) => adjustmentValue(a) },
    ],
  } satisfies ItemKind<PlanAdjustment>,
  {
    key: "deposits",
    title: "Deposits",
    items: (d) => d.deposits,
    name: (x) => x.name,
    fields: [
      { label: "Amount", value: (x) => (x.share !== undefined ? `${pct(x.share, 0)} of balance` : money(x.amount)) },
      { label: "Into", value: (x, d) => accountName(d, x.accountId) },
      { label: "When", value: (x, d) => when(x.timing, d) },
    ],
  } satisfies ItemKind<PlanDocument["deposits"][number]>,
  {
    key: "conversions",
    title: "Roth conversions",
    items: (d) => d.conversions ?? [],
    name: (c) => c.name,
    fields: [
      { label: "Amount", value: (c) => conversionModeLabel(c) },
      { label: "From", value: (c, d) => c.sourceAccountIds.map((id) => accountName(d, id)).join(", ") },
      { label: "Into", value: (c, d) => accountName(d, c.destAccountId) },
      { label: "Starts", value: (c, d) => when(c.start, d) },
      { label: "Ends", value: (c, d) => when(c.end, d) },
      { label: "IRMAA cap", value: (c) => (c.caps.irmaaTier == null ? "None" : `Tier ${c.caps.irmaaTier}`) },
      { label: "Keep 0% gains", value: (c) => yesNo(c.caps.keepLtcgZero) },
      { label: "Tax paid from", value: (c) => (c.payTaxFrom === "withhold" ? "The conversion" : "Cash flow") },
    ],
  } satisfies ItemKind<PlanConversion>,
] as unknown as ItemKind<{ id: string }>[]
