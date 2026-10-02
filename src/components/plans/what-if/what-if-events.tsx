"use client"

import { WHAT_IF_LIMITS, type WhatIfEvent } from "@/lib/plans/plan-what-if"
import { FIELD_CLASS, FIELD_STYLE } from "../editor/plan-editor-controls"

/** Where a new event lands, and what it starts at. */
const YEARS_AHEAD = 5
const DEFAULT_AMOUNT: Record<WhatIfEvent["kind"], number> = { windfall: 100_000, purchase: 50_000 }
const DEFAULT_LABEL: Record<WhatIfEvent["kind"], string> = { windfall: "Windfall", purchase: "Big purchase" }
const COMPACT = { ...FIELD_STYLE, padding: "4px 8px", fontSize: 12 }

function EventRow({ event, onChange, onRemove }: { event: WhatIfEvent; onChange: (e: WhatIfEvent) => void; onRemove: () => void }) {
  const windfall = event.kind === "windfall"
  return (
    <li className="space-y-1.5 rounded-lg border border-card-border p-2">
      <div className="flex items-center gap-1.5">
        <span className={`material-symbols-rounded ${windfall ? "text-success" : "text-error"}`} style={{ fontSize: 16 }} aria-hidden="true">
          {windfall ? "savings" : "shopping_bag"}
        </span>
        <input aria-label="Name" value={event.label} maxLength={60} onChange={(e) => onChange({ ...event, label: e.target.value })} className={FIELD_CLASS} style={COMPACT} />
        <button type="button" onClick={onRemove} aria-label={`Remove ${event.label}`} className="text-foreground-muted hover:text-error">
          <span className="material-symbols-rounded block" style={{ fontSize: 16 }} aria-hidden="true">
            close
          </span>
        </button>
      </div>
      <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-1.5">
        <input
          type="number"
          aria-label="Year"
          value={event.year}
          onChange={(e) => onChange({ ...event, year: Math.round(Number(e.target.value)) || event.year })}
          className={FIELD_CLASS}
          style={COMPACT}
        />
        <input
          type="number"
          aria-label="Amount, today's dollars"
          min={0}
          step={1000}
          value={event.amount}
          onChange={(e) => onChange({ ...event, amount: Math.min(WHAT_IF_LIMITS.maxAmount, Math.max(0, Number(e.target.value) || 0)) })}
          className={FIELD_CLASS}
          style={COMPACT}
        />
      </div>
      {windfall && (
        <label className="flex items-center gap-1.5 text-[11px] text-foreground-muted">
          <input type="checkbox" checked={event.taxable} onChange={(e) => onChange({ ...event, taxable: e.target.checked })} className="accent-[var(--primary)]" />
          Taxed as income (a bonus; off for a gift or inheritance)
        </label>
      )}
    </li>
  )
}

interface Props {
  events: WhatIfEvent[]
  startYear: number
  onChange: (events: WhatIfEvent[]) => void
}

/** One-off money in or out: a windfall or a big purchase in a chosen year, in today's dollars. */
export function WhatIfEvents({ events, startYear, onChange }: Props) {
  const full = events.length >= WHAT_IF_LIMITS.maxEvents
  const add = (kind: WhatIfEvent["kind"]) => {
    const id = `ev${Date.now().toString(36)}`
    onChange([...events, { id, kind, year: startYear + YEARS_AHEAD, amount: DEFAULT_AMOUNT[kind], label: DEFAULT_LABEL[kind], taxable: false }])
  }
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-foreground">One-off events</p>
      {events.length > 0 && (
        <ul className="space-y-1.5">
          {events.map((e) => (
            <EventRow key={e.id} event={e} onChange={(next) => onChange(events.map((x) => (x.id === e.id ? next : x)))} onRemove={() => onChange(events.filter((x) => x.id !== e.id))} />
          ))}
        </ul>
      )}
      <div className="flex gap-1.5">
        {(["windfall", "purchase"] as const).map((kind) => (
          <button key={kind} type="button" onClick={() => add(kind)} disabled={full} className="btn-secondary text-[11px] disabled:opacity-40">
            + {kind === "windfall" ? "Windfall" : "Purchase"}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-foreground-muted">Amounts in today&apos;s dollars.</p>
    </div>
  )
}
