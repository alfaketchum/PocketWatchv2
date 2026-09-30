import type { Brackets } from "./federal-2026"
import { bracketTax } from "./tax-calc"

/**
 * State inheritance tax (2026). It depends on the state where the person who died lived (or where
 * real estate sits) and on your relationship to them. Only five states have one; spouses are exempt
 * everywhere. Simplified: small-estate thresholds and special cases (e.g. a parent inheriting from a
 * young child in PA) aren't modeled.
 */
export type Relationship = "spouse" | "child" | "parent" | "sibling" | "nieceNephew" | "otherRelative" | "unrelated"

export const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  spouse: "Spouse",
  child: "Child or grandchild",
  parent: "Parent or grandparent",
  sibling: "Brother or sister",
  nieceNephew: "Niece, nephew, aunt or uncle",
  otherRelative: "Other relative (cousin…)",
  unrelated: "Not related",
}

export const INHERITANCE_TAX_STATES = ["KY", "MD", "NE", "NJ", "PA"] as const

/** Brackets on the amount above an exemption. */
function above(amount: number, exemption: number, brackets: Brackets): number {
  return bracketTax(Math.max(0, amount - exemption), brackets)
}

const flat = (rate: number): Brackets => [[0, rate]]

function pennsylvania(r: Relationship, amount: number): number {
  if (r === "spouse") return 0
  if (r === "child" || r === "parent") return amount * 0.045
  if (r === "sibling") return amount * 0.12
  return amount * 0.15
}

function newJersey(r: Relationship, amount: number): number {
  if (r === "spouse" || r === "child" || r === "parent") return 0 // Class A
  if (r === "sibling") {
    // Class C: first $25k exempt, then 11% / 13% / 14% / 16%.
    return above(amount, 25_000, [[0, 0.11], [1_075_000, 0.13], [1_375_000, 0.14], [1_675_000, 0.16]])
  }
  return bracketTax(amount, [[0, 0.15], [700_000, 0.16]]) // Class D
}

function kentucky(r: Relationship, amount: number): number {
  if (r === "spouse" || r === "child" || r === "parent" || r === "sibling") return 0 // Class A
  if (r === "nieceNephew") {
    // Class B: $1,000 exempt, 4% rising to 16%.
    return above(amount, 1_000, [[0, 0.04], [10_000, 0.05], [20_000, 0.06], [30_000, 0.08], [45_000, 0.1], [65_000, 0.12], [100_000, 0.14], [200_000, 0.16]])
  }
  // Class C: $500 exempt, 6% rising to 16%.
  return above(amount, 500, [[0, 0.06], [10_000, 0.08], [20_000, 0.1], [35_000, 0.14], [55_000, 0.16]])
}

function maryland(r: Relationship, amount: number): number {
  if (r === "spouse" || r === "child" || r === "parent" || r === "sibling") return 0
  return above(amount, 1_000, flat(0.1))
}

function nebraska(r: Relationship, amount: number): number {
  if (r === "spouse") return 0
  if (r === "child" || r === "parent" || r === "sibling") return above(amount, 100_000, flat(0.01))
  if (r === "nieceNephew") return above(amount, 40_000, flat(0.11))
  return above(amount, 25_000, flat(0.15))
}

const RULES: Record<string, (r: Relationship, amount: number) => number> = {
  PA: pennsylvania,
  NJ: newJersey,
  KY: kentucky,
  MD: maryland,
  NE: nebraska,
}

/** Inheritance tax on `amount` inherited from someone who lived in `state`; 0 in the other states. */
export function stateInheritanceTax(state: string | null, relationship: Relationship, amount: number): number {
  const rule = state ? RULES[state] : undefined
  return rule && amount > 0 ? rule(relationship, amount) : 0
}
