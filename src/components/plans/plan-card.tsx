"use client"

import Link from "next/link"
import { fmtCompact } from "@/components/fire/fire-helpers"
import type { PlanListItem } from "@/hooks/plans/shared"

const SPARK_W = 120
const SPARK_H = 32

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const min = Math.min(0, ...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const points = values
    .map((v, i) => `${((i / (values.length - 1)) * SPARK_W).toFixed(1)},${(SPARK_H - ((v - min) / span) * SPARK_H).toFixed(1)}`)
    .join(" ")
  return (
    <svg width={SPARK_W} height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} aria-hidden="true" className="shrink-0">
      <polyline points={points} fill="none" stroke="var(--primary)" strokeWidth={1.5} />
    </svg>
  )
}

export type PlanCardAction = "duplicate" | "rename" | "primary" | "delete"

const ACTIONS: { action: PlanCardAction; icon: string; label: string }[] = [
  { action: "duplicate", icon: "content_copy", label: "Duplicate" },
  { action: "rename", icon: "edit", label: "Rename" },
  { action: "primary", icon: "star", label: "Make primary" },
  { action: "delete", icon: "delete", label: "Delete" },
]

/** A plan in the list: its headline numbers, a sparkline, and quick actions. */
export function PlanCard({
  plan,
  isHidden,
  onAction,
}: {
  plan: PlanListItem
  isHidden: boolean
  onAction: (action: PlanCardAction, plan: PlanListItem) => void
}) {
  const s = plan.summary
  const blur = isHidden ? { filter: "blur(8px)" } : undefined
  return (
    <div className="bg-card border border-card-border rounded-2xl p-5 flex flex-col gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-start justify-between gap-3">
        <Link href={`/plans/${plan.id}`} className="min-w-0 group">
          <p className="text-base font-semibold text-foreground truncate group-hover:text-primary">{plan.name}</p>
          {plan.isPrimary && (
            <span className="inline-block mt-1 text-[9px] font-semibold uppercase tracking-wider text-primary bg-primary/10 rounded px-1.5 py-0.5">
              Primary
            </span>
          )}
        </Link>
        <div style={blur}>{s && <Sparkline values={s.spark} />}</div>
      </div>
      {s ? (
        <dl className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <dt className="text-foreground-muted">Retire</dt>
            <dd className="font-semibold text-foreground tabular-nums">{s.retirementAge === null ? "—" : `Age ${s.retirementAge}`}</dd>
          </div>
          <div style={blur}>
            <dt className="text-foreground-muted">At retirement</dt>
            <dd className="font-semibold text-foreground tabular-nums">
              {s.netWorthAtRetirement === null ? "—" : fmtCompact(s.netWorthAtRetirement)}
            </dd>
          </div>
          <div>
            <dt className="text-foreground-muted">Money lasts</dt>
            <dd className={`font-semibold tabular-nums ${s.depletedAge === null ? "text-success" : "text-error"}`}>
              {s.depletedAge === null ? `Past ${s.endAge}` : `Until ${s.depletedAge}`}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="text-xs text-error">This plan couldn&apos;t be read.</p>
      )}
      <div className="flex items-center gap-0.5 border-t border-card-border pt-3 -mb-1">
        <Link href={`/plans/${plan.id}`} className="mr-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          Open
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>
            arrow_forward
          </span>
        </Link>
        {ACTIONS.filter((a) => !(a.action === "primary" && plan.isPrimary)).map((a) => (
          <button
            key={a.action}
            type="button"
            onClick={() => onAction(a.action, plan)}
            title={a.label}
            aria-label={`${a.label} ${plan.name}`}
            className="btn-ghost h-8 px-1.5 text-foreground-muted hover:text-foreground"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 17 }}>
              {a.icon}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
