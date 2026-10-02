"use client"

import { useMemo, useState } from "react"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import { diffPlanInputs, type InputChange } from "@/lib/plans/plan-diff"
import type { PlanDocument } from "@/lib/plans/plan-types"

/** Lines shown before "Show all". */
const COLLAPSED_LINES = 8

function Value({ text, color, isHidden }: { text: string | null; color: string; isHidden: boolean }) {
  if (text === null) return <span className="text-foreground-muted italic">not in plan</span>
  return (
    <span className="max-w-[16rem] truncate tabular-nums font-medium" title={text} style={{ color, filter: isHidden ? "blur(6px)" : undefined }}>
      {text}
    </span>
  )
}

function ChangeLine({ change, colors, isHidden }: { change: InputChange; colors: [string, string]; isHidden: boolean }) {
  const only = change.a === null ? "Only in B" : change.b === null ? "Only in A" : null
  return (
    <li className="grid grid-cols-1 gap-x-4 gap-y-0.5 border-t border-card-border py-1.5 text-xs sm:grid-cols-[minmax(0,1fr)_auto]">
      <span className="min-w-0 truncate text-foreground" title={change.label}>
        {change.label}
        {only && <span className="ml-2 rounded bg-foreground/5 px-1.5 py-0.5 text-[10px] font-medium text-foreground-muted">{only}</span>}
      </span>
      <span className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
        <Value text={change.a} color={colors[0]} isHidden={isHidden} />
        <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 14 }} aria-label="to">
          arrow_forward
        </span>
        <Value text={change.b} color={colors[1]} isHidden={isHidden} />
      </span>
    </li>
  )
}

interface Props {
  a: PlanDocument
  b: PlanDocument
  colors: [string, string]
  /** e.g. "B runs 5 more years", when the two plans cover different years. */
  note: string | null
  isHidden: boolean
}

/** What's different: every input that changed from A to B, grouped like the editor's tabs. */
export function CompareInputsDiff({ a, b, colors, note, isHidden }: Props) {
  const groups = useMemo(() => diffPlanInputs(a, b), [a, b])
  const [expanded, setExpanded] = useState(false)
  const total = groups.reduce((n, g) => n + g.changes.length, 0)
  // Collapsed: whole groups until the line budget runs out (the first group always shows).
  let budget = expanded ? Infinity : COLLAPSED_LINES
  const shown = groups.flatMap((g) => {
    if (budget <= 0) return []
    const changes = g.changes.slice(0, budget)
    budget -= changes.length
    return [{ ...g, changes }]
  })
  const hiddenCount = total - shown.reduce((n, g) => n + g.changes.length, 0)

  return (
    <FireSectionCard
      eyebrow="What's different"
      title={total === 0 ? "These plans have the same inputs" : `${total} input${total === 1 ? "" : "s"} differ from A to B`}
      right={note ? <span className="text-[11px] text-foreground-muted">{note}</span> : undefined}
    >
      {total > 0 && (
        <div className="grid gap-x-8 gap-y-3 lg:grid-cols-2">
          {shown.map((g) => (
            <section key={g.key} className="min-w-0">
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">{g.title}</p>
              <ul>
                {g.changes.map((c, i) => (
                  <ChangeLine key={`${c.label}-${i}`} change={c} colors={colors} isHidden={isHidden} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {(hiddenCount > 0 || expanded) && total > COLLAPSED_LINES && (
        <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-3 text-xs font-medium text-primary hover:underline">
          {expanded ? "Show fewer" : `Show all (${hiddenCount} more)`}
        </button>
      )}
    </FireSectionCard>
  )
}
