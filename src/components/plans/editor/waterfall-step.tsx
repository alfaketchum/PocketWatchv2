"use client"

import type { ReactNode } from "react"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { cn } from "@/lib/utils"

export function move<T>(items: T[], index: number, delta: number): T[] {
  const to = index + delta
  if (to < 0 || to >= items.length) return items
  const next = [...items]
  ;[next[index], next[to]] = [next[to], next[index]]
  return next
}

export function OrderButtons({ index, count, onMove }: { index: number; count: number; onMove: (delta: number) => void }) {
  return (
    <span className="flex">
      {[
        { delta: -1, icon: "arrow_upward", label: "Move up", disabled: index === 0 },
        { delta: 1, icon: "arrow_downward", label: "Move down", disabled: index === count - 1 },
      ].map((b) => (
        <button
          key={b.icon}
          type="button"
          disabled={b.disabled}
          onClick={() => onMove(b.delta)}
          aria-label={b.label}
          className="btn-ghost h-7 min-w-10 justify-center px-1 text-foreground-muted hover:text-foreground disabled:opacity-30 lg:min-w-0"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
            {b.icon}
          </span>
        </button>
      ))}
    </span>
  )
}

interface WaterfallStepProps {
  /** Step number, or a Material Symbols icon name for pinned steps. */
  marker: number | string
  title: ReactNode
  subtitle?: ReactNode
  /** Example amount for this step (signed display handled by `direction`). */
  amount?: number
  direction: "in" | "out"
  /** Pinned steps are fixed rules (buffer, overflow, last resort), not reorderable accounts. */
  pinned?: boolean
  /** Greyed out: never reached with the current rules. */
  muted?: boolean
  last?: boolean
  actions?: ReactNode
  children?: ReactNode
}

/** One step of a waterfall: a numbered bubble on a connecting line, and a card. */
export function WaterfallStep({ marker, title, subtitle, amount, direction, pinned, muted, last, actions, children }: WaterfallStepProps) {
  const shown = amount !== undefined && amount >= 0.5
  return (
    <li className={cn("relative flex gap-3", muted && "opacity-50")}>
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
            pinned ? "bg-background-secondary text-foreground-muted" : "bg-primary text-white",
          )}
        >
          {typeof marker === "number" ? (
            marker
          ) : (
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>
              {marker}
            </span>
          )}
        </span>
        {!last && <span className="w-px flex-1 bg-card-border my-1" />}
      </div>
      <div className={cn("mb-2 flex-1 min-w-0 rounded-lg border px-3 py-2", pinned ? "border-dashed border-card-border" : "border-card-border bg-card")}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">{title}</p>
            {subtitle && <p className="text-[11px] text-foreground-muted">{subtitle}</p>}
          </div>
          {shown && (
            <span className={cn("shrink-0 pt-0.5 text-xs font-semibold tabular-nums", direction === "in" ? "text-success" : "text-error")}>
              {direction === "in" ? "+" : "−"}
              {fmtMoney(amount)}
            </span>
          )}
          {actions}
        </div>
        {children}
      </div>
    </li>
  )
}

/** A titled column holding one waterfall, with an example from the plan's own numbers. */
export function WaterfallColumn({
  icon,
  title,
  description,
  example,
  tone,
  children,
}: {
  icon: string
  title: string
  description: string
  example: ReactNode
  tone: "in" | "out"
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-2">
        <span
          className={cn("material-symbols-rounded mt-0.5", tone === "in" ? "text-success" : "text-error")}
          style={{ fontSize: 20 }}
        >
          {icon}
        </span>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-foreground-muted">{description}</p>
        </div>
      </div>
      <div className="rounded-lg bg-background-secondary/60 px-3 py-2 text-[11px] text-foreground-muted">{example}</div>
      <ol>{children}</ol>
    </section>
  )
}
