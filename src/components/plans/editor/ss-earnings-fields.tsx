"use client"

import { useState } from "react"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { parseEarnings, roughHistory } from "@/lib/plans/ss-estimate"
import { estimatedPia, planEarnings } from "@/lib/plans/ss-plan-earnings"
import type { PlanDocument, PlanIncome } from "@/lib/plans/plan-types"

const START_AGE = 22
const CREDITS_NEEDED = 40

/** Work credits: 40 (about 10 years) are needed for a benefit on your own record. */
function CreditsNote({ credits, eligibleYear, startYear }: { credits: number; eligibleYear: number | null; startYear: number }) {
  if (eligibleYear !== null && eligibleYear < startYear) {
    return <p className="text-[11px] text-success">{Math.min(credits, CREDITS_NEEDED)} of 40 work credits: eligible on your own record.</p>
  }
  if (eligibleYear !== null) {
    return <p className="text-[11px] text-foreground-muted">{credits} work credits by the plan&apos;s end; 40 are reached in {eligibleYear}, so your own benefit counts from then.</p>
  }
  return (
    <p className="text-[11px] text-warning">
      Not eligible on your own record: {credits} of 40 work credits (about 10 years of work). Only a spousal benefit, if married, is paid.
    </p>
  )
}
const ROUGH_SALARY = 60_000

/**
 * Estimate the benefit from earnings: paste the record from ssa.gov (or fill a rough one), and the plan's own
 * salaries add the years ahead. The estimate updates whenever the plan's income changes.
 */
export function SsEarningsFields({ income, doc, onChange }: { income: PlanIncome; doc: PlanDocument; onChange: (earnings: [number, number][]) => void }) {
  const ss = income.socialSecurity
  const person = doc.people.find((p) => p.id === income.personId) ?? doc.people[0]
  const [rough, setRough] = useState({ fromAge: START_AGE, salary: ROUGH_SALARY })
  if (!ss?.earnings || !person) return null
  const past = ss.earnings.filter(([year]) => year < doc.settings.startYear)
  const ahead = planEarnings(doc, person.id)
  const estimate = estimatedPia(doc, income)
  const setRecord = (record: { year: number; amount: number }[]) => onChange(record.map((e) => [e.year, e.amount]))
  const fillRough = () => setRecord(roughHistory(person.birthYear + rough.fromAge, doc.settings.startYear - 1, rough.salary))
  return (
    <div className="col-span-full space-y-2 rounded-lg border border-card-border p-3">
      <p className="text-[11px] text-foreground-muted">
        Paste your earnings record from <span className="font-medium text-foreground">ssa.gov/myaccount</span> (one year and amount per line), or fill
        a rough one. Years from {doc.settings.startYear} on come from {person.name}&apos;s salaries in this plan.
      </p>
      <textarea
        key={past.map(([year, amount]) => `${year}:${amount}`).join(",")}
        aria-label="Earnings record"
        rows={4}
        defaultValue={past.map(([year, amount]) => `${year}\t${amount}`).join("\n")}
        onBlur={(e) => setRecord(parseEarnings(e.target.value))}
        placeholder={"2019\t52,000\n2020\t55,500\n…"}
        className="w-full rounded-lg border border-card-border bg-background-secondary px-3 py-2 font-mono text-xs text-foreground"
      />
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-32">
          <FireNumberField label="Worked from age" min={14} max={80} value={rough.fromAge} onChange={(fromAge) => setRough({ ...rough, fromAge: Math.round(fromAge) })} />
        </div>
        <div className="w-40">
          <FireNumberField label="At about (today's $)" prefix="$" min={0} value={rough.salary} onChange={(salary) => setRough({ ...rough, salary })} />
        </div>
        <button type="button" onClick={fillRough} className="btn-secondary text-xs">
          Fill a rough record
        </button>
      </div>
      {estimate && (
        <p className="text-[11px] text-foreground-muted">
          {past.length} past years + {ahead.length} years in this plan, best {estimate.counted} of 35 counted (fewer count as zeros): about{" "}
          <span className="font-medium text-foreground">{fmtMoney(estimate.pia)}/mo</span> at full retirement age, today&apos;s dollars.
        </p>
      )}
      {estimate && <CreditsNote credits={estimate.credits} eligibleYear={estimate.eligibleYear} startYear={doc.settings.startYear} />}
    </div>
  )
}
