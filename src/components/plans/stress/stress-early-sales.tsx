"use client"

import type { CohortResult } from "@/lib/plans/stress/stress-test"

interface EarlySale {
  name: string
  count: number
  plannedAge: number
  earliestAge: number
}

/** Per home, the trials that sold it sooner than the plan does because the portfolio was depleted first. */
function earlySales(cohorts: CohortResult[]): EarlySale[] {
  const byHome = new Map<string, EarlySale>()
  for (const c of cohorts) {
    for (const s of c.homeSales ?? []) {
      if (s.plannedAge === undefined) continue
      const prev = byHome.get(s.name)
      byHome.set(s.name, {
        name: s.name,
        count: (prev?.count ?? 0) + 1,
        plannedAge: s.plannedAge,
        earliestAge: Math.min(prev?.earliestAge ?? Infinity, s.age),
      })
    }
  }
  return [...byHome.values()]
}

/** A heads-up under the result: the stress test moved up a home sale your plan makes later. */
export function StressEarlySales({ cohorts, unit }: { cohorts: CohortResult[]; unit: string }) {
  const sales = earlySales(cohorts)
  if (sales.length === 0) return null
  return (
    <div className="mt-3 space-y-1 rounded-lg border border-card-border bg-background-secondary/40 px-3 py-2">
      {sales.map((s) => (
        <p key={s.name} className="flex items-start gap-1.5 text-xs text-foreground">
          <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 15 }} aria-hidden="true">
            event_upcoming
          </span>
          <span>
            <span className="font-medium">{s.name}</span> sold sooner than your plan (age {s.plannedAge}) in {s.count.toLocaleString()} of{" "}
            {cohorts.length.toLocaleString()} {unit}, as early as {s.earliestAge}, when the portfolio was depleted first.
          </span>
        </p>
      ))}
    </div>
  )
}
