"use client"

import { claimFactor, SS_EARLIEST_AGE, SS_LATEST_AGE } from "@/lib/plans/social-security"
import type { PlanDocument, PlanIncome } from "@/lib/plans/plan-types"

/** The claiming age a plain Social Security line implies: its start age when set by age, else full retirement age. */
function impliedClaimAge(income: PlanIncome, birthYear: number): number {
  const age = income.start.type === "age" ? income.start.age : income.start.type === "year" ? income.start.year - birthYear : 67
  return Math.min(SS_LATEST_AGE, Math.max(SS_EARLIEST_AGE, age))
}

/**
 * For a Social Security line entered as a plain amount: switch it to SSA's rules, keeping today's amount (its
 * benefit at full retirement age is worked back from the claiming age).
 */
export function SocialSecurityUpgrade({ income, doc, onChange }: { income: PlanIncome; doc: PlanDocument; onChange: (change: Partial<PlanIncome>) => void }) {
  const person = doc.people.find((p) => p.id === income.personId) ?? doc.people[0]
  if (income.kind !== "social_security" || income.socialSecurity || income.oneTime || !person) return null
  const upgrade = () => {
    const claimAge = impliedClaimAge(income, person.birthYear)
    const pia = Math.round(income.amount / 12 / claimFactor(person.birthYear, claimAge))
    onChange({ socialSecurity: { pia, claimAge }, personId: person.id, growth: null, start: { type: "age", personId: person.id, age: claimAge } })
  }
  return (
    <p className="text-[11px] text-foreground-muted">
      Entered as a fixed amount.{" "}
      <button type="button" onClick={upgrade} className="text-primary hover:underline">
        Use Social Security&apos;s rules
      </button>{" "}
      (claiming age, spousal top-up, earnings test).
    </p>
  )
}
