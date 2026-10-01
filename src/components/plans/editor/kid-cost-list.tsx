"use client"

import { fmtMoney } from "@/components/fire/fire-helpers"
import { childExpenses } from "@/lib/plans/plan-children"
import type { PlanDocument } from "@/lib/plans/plan-types"

/** Detailed view: each child's generated expense lines, read-only, with Edit opening the kid pop-out. */
export function KidCostList({ doc, onEdit }: { doc: PlanDocument; onEdit: (childId: string) => void }) {
  const children = doc.children ?? []
  if (children.length === 0) return null
  return (
    <div className="space-y-2 rounded-xl border border-dashed border-card-border p-3">
      <p className="text-sm font-semibold text-foreground">Kids</p>
      <p className="text-[11px] text-foreground-muted">From each child&apos;s plan. Edit a child to change these; add one with Add expense → Have a child.</p>
      {children.map((child) => (
        <div key={child.id} className="space-y-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-medium text-foreground">
              {child.name || "Child"} <span className="font-normal text-foreground-muted">· born {child.birthYear}</span>
            </p>
            <button type="button" onClick={() => onEdit(child.id)} className="text-[11px] text-primary hover:underline">
              Edit {child.name || "child"} →
            </button>
          </div>
          <ul className="divide-y divide-card-border/60 text-xs">
            {childExpenses({ ...doc, children: [child] }).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-1.5">
                <span className="text-foreground">{e.name}</span>
                <span className="tabular-nums text-foreground-muted">{fmtMoney(e.amount)} / yr</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
