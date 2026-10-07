import { DEFAULT_HEIRS_TAX_RATE, RETIREMENT_MILESTONE_ID } from "./plan-constants"
import { resolveRange, timingContext } from "./plan-timing"
import type { ConversionMode, PlanAccount, PlanConversion, PlanDocument, PlanPerson, PlanSettings } from "./plan-types"
import { accountOwner, ownTraditional } from "./tax/retirement-rules-2026"

/** Federal ordinary brackets a rule can fill to (the top one, 37%, has no ceiling). */
export const CONVERSION_BRACKETS = [0.1, 0.12, 0.22, 0.24, 0.32, 0.35] as const
/** Age a new rule converts until: the start of required withdrawals for most people. */
const DEFAULT_END_AGE = 73
const DEFAULT_BRACKET = 0.22

export function heirsTaxRate(settings: PlanSettings): number {
  return settings.heirsTaxRate ?? DEFAULT_HEIRS_TAX_RATE
}

const owned = (doc: PlanDocument, person: PlanPerson | undefined) => (a: PlanAccount) => accountOwner(a, doc)?.id === person?.id

/** Traditional accounts a rule can convert from: the person's own (inherited ones follow the 10-year rule). */
export function conversionSources(doc: PlanDocument, person?: PlanPerson): PlanAccount[] {
  return doc.accounts.filter((a) => ownTraditional(a) && (!person || owned(doc, person)(a)))
}

/** Roth accounts a rule can convert into. */
export function conversionDestinations(doc: PlanDocument, person?: PlanPerson): PlanAccount[] {
  return doc.accounts.filter((a) => a.taxTreatment === "roth" && (!person || owned(doc, person)(a)))
}

/** The same rule with another mode; the amount fields of the old mode are dropped. */
export function withMode(rule: PlanConversion, mode: ConversionMode): PlanConversion {
  const { id, name, start, end, sourceAccountIds, destAccountId, caps, payTaxFrom, origin } = rule
  return { id, name, start, end, sourceAccountIds, destAccountId, caps, payTaxFrom, ...(origin ? { origin } : {}), ...mode }
}

/**
 * A new rule for the first person with traditional money (and a Roth): their traditional accounts into their Roth,
 * filling the 22% bracket from retirement until 73. Null when nobody has both.
 */
export function blankConversion(doc: PlanDocument, id: string): PlanConversion | null {
  const person = doc.people.find((p) => conversionSources(doc, p).length > 0 && conversionDestinations(doc, p).length > 0)
  if (!person) return null
  const retires = doc.milestones.some((m) => m.id === RETIREMENT_MILESTONE_ID)
  return {
    id,
    name: `Roth conversion (${person.name})`,
    start: retires ? { type: "milestone", milestoneId: RETIREMENT_MILESTONE_ID } : { type: "planStart" },
    end: { type: "age", personId: person.id, age: DEFAULT_END_AGE },
    sourceAccountIds: conversionSources(doc, person).map((a) => a.id),
    destAccountId: conversionDestinations(doc, person)[0].id,
    caps: {},
    payTaxFrom: "cashFlow",
    mode: "bracket",
    bracketRate: DEFAULT_BRACKET,
  }
}

const pct = (r: number) => `${Math.round(r * 100)}%`

/** "Fill the 22% bracket", "$25,000/yr (today's $)", "Convert everything". */
export function conversionModeLabel(rule: ConversionMode): string {
  if (rule.mode === "bracket") return `Fill the ${pct(rule.bracketRate)} bracket`
  if (rule.mode === "targetIncome") return `Fill to $${Math.round(rule.targetIncome).toLocaleString("en-US")} taxable income`
  if (rule.mode === "convertAll") return "Convert everything by the end"
  return `$${Math.round(rule.amount).toLocaleString("en-US")}/yr${rule.amountBasis === "today" ? " (today's $)" : ""}`
}

/** What would make a rule do nothing or something unexpected; empty when it's fine. */
export function conversionWarnings(doc: PlanDocument, rule: PlanConversion): string[] {
  const warnings: string[] = []
  const flat = doc.settings.taxMode !== "brackets"
  if (flat && (rule.mode === "bracket" || rule.mode === "targetIncome")) warnings.push("Filling a bracket or income needs tax brackets (Assumptions → Taxes); with flat rates this rule converts nothing.")
  if (flat && (rule.caps.irmaaTier != null || rule.caps.keepLtcgZero)) warnings.push("Caps need tax brackets; with flat rates they're ignored.")
  const dest = doc.accounts.find((a) => a.id === rule.destAccountId)
  const sources = rule.sourceAccountIds.map((id) => doc.accounts.find((a) => a.id === id))
  if (!dest || dest.taxTreatment !== "roth") warnings.push("Pick a Roth account to convert into.")
  if (sources.some((a) => !a || !ownTraditional(a))) warnings.push("Only your own traditional accounts can be converted (inherited ones follow the 10-year rule).")
  const owner = dest ? accountOwner(dest, doc)?.id : undefined
  if (dest && sources.some((a) => a && accountOwner(a, doc)?.id !== owner)) warnings.push("A conversion stays with one person: the Roth must belong to the same person as the traditional accounts.")
  const range = resolveRange(rule.start, rule.end, timingContext(doc))
  if (range.end <= Math.max(0, range.start)) warnings.push("The end comes before the start, so no year converts.")
  return warnings
}
