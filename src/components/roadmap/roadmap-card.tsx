"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { ROADMAP_STATUSES, type RoadmapStatus } from "@/lib/roadmap/roadmap-seed"
import type { RoadmapItem } from "@/hooks/roadmap/shared"
import { BOARD_COLUMNS, STATUS_META, TIER_META } from "./roadmap-constants"

/** The app's global form styles enlarge fields; keep the card's controls small. */
const COMPACT = { fontSize: 12, lineHeight: 1.4, padding: "4px 8px", minHeight: 0 } as const

interface Props {
  item: RoadmapItem
  onPatch: (patch: Partial<RoadmapItem>) => void
  onDelete: () => void
}

function Detail({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <p className="text-[11px] leading-snug">
      <span className="text-foreground-muted">{label}: </span>
      <span className="text-foreground">{value}</span>
    </p>
  )
}

/** One feature: what it is, the demand behind it, where we stand, and its notes; arrows move it across the board. */
export function RoadmapCard({ item, onPatch, onDelete }: Props) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState(item.notes)
  const column = BOARD_COLUMNS.indexOf(item.status)
  const move = (step: -1 | 1) => {
    const next = BOARD_COLUMNS[column + step]
    if (next) onPatch({ status: next })
  }
  return (
    <div className="rounded-xl border border-card-border bg-card p-3 space-y-2" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-[11px] font-semibold tabular-nums text-foreground-muted">#{item.rank}</span>
        <button type="button" onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left">
          <p className="text-sm font-semibold leading-snug text-foreground">{item.title}</p>
        </button>
        <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold", TIER_META[item.tier].className)} title={TIER_META[item.tier].hint}>
          {item.tier}
        </span>
        <span className="shrink-0 rounded bg-background-secondary px-1.5 py-0.5 text-[10px] font-medium text-foreground-muted" title="Effort">
          {item.effort}
        </span>
      </div>
      {item.summary && <p className="text-xs text-foreground-muted leading-snug">{item.summary}</p>}
      {item.demand && (
        <p className="text-[11px] text-foreground-muted">
          <span className="material-symbols-rounded align-[-3px] mr-0.5" style={{ fontSize: 13 }}>thumb_up</span>
          {item.demand}
        </p>
      )}
      {open && (
        <div className="space-y-2 border-t border-card-border pt-2">
          <Detail label="ProjectionLab" value={item.plStatus} />
          <Detail label="Us today" value={item.ourStatus} />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== item.notes && onPatch({ notes })}
            placeholder="Notes: decisions, links, what's left…"
            rows={3}
            className="w-full rounded-lg border border-card-border bg-background px-2 py-1.5 text-xs text-foreground"
            style={COMPACT}
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Status"
              value={item.status}
              onChange={(e) => onPatch({ status: e.target.value as RoadmapStatus })}
              className="rounded-md border border-card-border bg-background px-2 py-1 text-xs text-foreground"
              style={{ ...COMPACT, height: 28 }}
            >
              {ROADMAP_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_META[s].label}</option>
              ))}
            </select>
            {!item.key && (
              <button type="button" onClick={onDelete} className="text-[11px] text-error hover:underline">
                Remove
              </button>
            )}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setOpen(!open)} className="text-[11px] text-primary hover:underline">
          {open ? "Less" : item.notes ? "Details & notes ●" : "Details & notes"}
        </button>
        {column >= 0 && (
          <span className="flex gap-1">
            <button type="button" disabled={column === 0} onClick={() => move(-1)} aria-label="Move left" className="btn-ghost rounded-md px-1 disabled:opacity-30">
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>chevron_left</span>
            </button>
            <button type="button" disabled={column === BOARD_COLUMNS.length - 1} onClick={() => move(1)} aria-label="Move right" className="btn-ghost rounded-md px-1 disabled:opacity-30">
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>chevron_right</span>
            </button>
          </span>
        )}
      </div>
    </div>
  )
}
