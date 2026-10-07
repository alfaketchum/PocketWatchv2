/**
 * Roth conversions: each active rule moves money from the owner's traditional accounts into their Roth after the
 * year's required withdrawals (which can't be converted, and count toward any bracket being filled). The converted
 * amount is ordinary income; its tax is paid from the year's cash flow, or withheld from the conversion (the
 * withheld part is a distribution: 10% penalty before 59½). Bracket, income and cap amounts use the exact tax rules
 * on the year's income so far; the bracket true-up then settles the tax.
 */
import { isActive, resolveRange, type ResolvedRange, type TimingContext } from "../plan-timing"
import type { PlanAccount, PlanConversion, PlanDocument, PlanPerson } from "../plan-types"
import { roomInLtcgZero, roomToBracket, roomToTaxable, roomUnderIrmaa } from "../tax/conversion-room"
import { IRMAA_LOOKBACK_YEARS, MEDICARE_AGE } from "../tax/irmaa-2026"
import { accountOwner, ageInYear, EARLY_WITHDRAWAL_PENALTY, ownTraditional, penaltyFree } from "../tax/retirement-rules-2026"
import { totalTax, type TaxBase } from "../tax/tax-calc"
import { deposit, type Holdings } from "./engine-cashflow"
import { finalBase, type TaxedAmounts, type YearTax } from "./engine-tax"

/** Conversions smaller than this (dollars) aren't made. */
const MIN_CONVERSION = 1

export interface ConversionEntry {
  rule: PlanConversion
  range: ResolvedRange
  sources: PlanAccount[]
  dest: PlanAccount
  owner: PlanPerson
}

/** The plan's rules that can run: a Roth destination and the same owner's own traditional sources. */
export function conversionEntries(doc: PlanDocument, ctx: TimingContext): ConversionEntry[] {
  const byId = new Map(doc.accounts.map((a) => [a.id, a]))
  return (doc.conversions ?? []).flatMap((rule) => {
    const dest = byId.get(rule.destAccountId)
    const owner = dest ? accountOwner(dest, doc) : undefined
    const sources = rule.sourceAccountIds
      .map((id) => byId.get(id))
      .filter((a): a is PlanAccount => !!a && ownTraditional(a) && accountOwner(a, doc)?.id === owner?.id)
    if (!dest || dest.taxTreatment !== "roth" || !owner || sources.length === 0) return []
    return [{ rule, range: resolveRange(rule.start, rule.end, ctx), sources, dest, owner }]
  })
}

export interface ConversionYear {
  /** The plan with this year's rates (marginal rates under brackets). */
  doc: PlanDocument
  tax: YearTax
  index: number
  year: number
  inflationFactor: number
  /** Income already in the year besides earned income (required and inherited withdrawals, gains, last pass's shortfall draws). */
  prior: Omit<TaxedAmounts, "charged">
}

export interface ConversionResult {
  holdings: Holdings
  /** Converted (gross), all ordinary income. */
  taxable: number
  /** Tax charged along the way (at the marginal rate); the true-up settles the exact amount. */
  tax: number
  /** Effect on the year's cash flow: withheld money in, tax and penalty out. */
  net: number
  penalty: number
  withheld: number
  /** Gross converted by source account; of it, withheld by source account. */
  fromBy: Record<string, number>
  withheldBy: Record<string, number>
  /** Reaching each Roth account. */
  intoBy: Record<string, number>
  /** The extra tax the conversions add on top of the year's other income (exact under brackets). */
  attributableTax: number
}

export const NO_CONVERSION: Omit<ConversionResult, "holdings"> = {
  taxable: 0, tax: 0, net: 0, penalty: 0, withheld: 0, fromBy: {}, withheldBy: {}, intoBy: {}, attributableTax: 0,
}

const add = (r: Record<string, number>, k: string, v: number) => ({ ...r, [k]: (r[k] ?? 0) + v })
const available = (e: ConversionEntry, h: Holdings) => e.sources.reduce((s, a) => s + Math.max(0, h.balances[a.id] ?? 0), 0)

/** Filers whose IRMAA a conversion this year would set (premiums use income from 2 years earlier). */
function irmaaApplies(y: ConversionYear): boolean {
  const filers = y.tax.situation?.status === "joint" ? y.doc.people.slice(0, 2) : y.doc.people.slice(0, 1)
  return filers.some((p) => ageInYear(p, y.year) >= MEDICARE_AGE - IRMAA_LOOKBACK_YEARS)
}

/** What the rule's mode asks for this year, before caps. */
function modeAmount(e: ConversionEntry, upper: number, base: TaxBase, y: ConversionYear): number {
  const { rule } = e
  const s = y.tax.situation
  if (rule.mode === "fixed") return rule.amount * (rule.amountBasis === "today" ? y.inflationFactor : 1)
  if (rule.mode === "convertAll") return upper / Math.max(1, e.range.end - y.index)
  if (!s) return 0
  if (rule.mode === "bracket") return roomToBracket(base, s, upper, rule.bracketRate)
  return roomToTaxable(base, s, upper, rule.targetIncome * y.inflationFactor)
}

/** The amount after the rule's caps (brackets only) and what's in the sources. */
function ruleAmount(e: ConversionEntry, upper: number, base: TaxBase, y: ConversionYear): number {
  const s = y.tax.situation
  let amount = Math.min(upper, modeAmount(e, upper, base, y))
  if (s && e.rule.caps.irmaaTier != null && irmaaApplies(y)) amount = roomUnderIrmaa(base, s, amount, e.rule.caps.irmaaTier)
  if (s && e.rule.caps.keepLtcgZero) amount = roomInLtcgZero(base, s, amount)
  return amount
}

/** Move `gross` from the sources (pro rata to their balances) into the Roth, less `withheld`. */
function moveConverted(e: ConversionEntry, holdings: Holdings, gross: number, withheld: number) {
  const total = available(e, holdings)
  let balances = holdings.balances
  let fromBy: Record<string, number> = {}
  let withheldBy: Record<string, number> = {}
  for (const source of e.sources) {
    const share = Math.max(0, balances[source.id] ?? 0) / total
    balances = { ...balances, [source.id]: (balances[source.id] ?? 0) - gross * share }
    fromBy = add(fromBy, source.id, gross * share)
    if (withheld > 0) withheldBy = add(withheldBy, source.id, withheld * share)
  }
  return { holdings: deposit({ ...holdings, balances }, e.dest, gross - withheld), fromBy, withheldBy }
}

/** One year's conversions, rules in order (each sees the income the ones before it added). */
export function convertYear(entries: ConversionEntry[], holdings: Holdings, y: ConversionYear): ConversionResult {
  let result: ConversionResult = { ...NO_CONVERSION, holdings }
  const rate = y.doc.settings.incomeTaxRate
  for (const e of entries) {
    if (!isActive(e.range, y.index, false)) continue
    const base = finalBase(y.tax, { ...y.prior, ordinaryWithdrawn: y.prior.ordinaryWithdrawn + result.taxable })
    const gross = ruleAmount(e, available(e, result.holdings), base, y)
    if (gross < MIN_CONVERSION) continue
    const s = y.tax.situation
    const extraTax = s ? totalTax({ ...base, ordinary: base.ordinary + gross }, s) - totalTax(base, s) : gross * rate
    const withheld = e.rule.payTaxFrom === "withhold" ? Math.min(gross, extraTax) : 0
    const penalty = withheld > 0 && !penaltyFree(e.owner, y.year) ? withheld * EARLY_WITHDRAWAL_PENALTY : 0
    const moved = moveConverted(e, result.holdings, gross, withheld)
    const charged = gross * rate
    result = {
      holdings: moved.holdings,
      taxable: result.taxable + gross,
      tax: result.tax + charged,
      net: result.net + withheld - charged - penalty,
      penalty: result.penalty + penalty,
      withheld: result.withheld + withheld,
      fromBy: Object.entries(moved.fromBy).reduce((r, [k, v]) => add(r, k, v), result.fromBy),
      withheldBy: Object.entries(moved.withheldBy).reduce((r, [k, v]) => add(r, k, v), result.withheldBy),
      intoBy: add(result.intoBy, e.dest.id, gross - withheld),
      attributableTax: result.attributableTax + extraTax,
    }
  }
  return result
}
