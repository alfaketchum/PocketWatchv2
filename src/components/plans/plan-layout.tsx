"use client"

import { useEffect, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

/** The plan page's movable blocks, top to bottom. */
export type PlanBlock = "summary" | "tabs" | "chart"
export type PanelSide = "left" | "right"

export interface PlanLayout {
  order: PlanBlock[]
  /** Which side of the chart the year panel sits on (wide screens). */
  panelSide: PanelSide
}

const LAYOUT_KEY = "pw-plan-layout"
export const DEFAULT_LAYOUT: PlanLayout = { order: ["tabs", "chart", "summary"], panelSide: "left" }

export const BLOCK_LABELS: Record<PlanBlock, string> = { summary: "Summary", tabs: "Tabs", chart: "Chart" }

/** A saved layout, or the default; also reads the earlier "chartFirst" / "tabsFirst" setting. */
function parseLayout(saved: string | null): PlanLayout {
  if (saved === "chartFirst") return { ...DEFAULT_LAYOUT, order: ["summary", "chart", "tabs"] }
  if (!saved || saved === "tabsFirst") return DEFAULT_LAYOUT
  try {
    const value = JSON.parse(saved) as Partial<PlanLayout>
    const order = Array.isArray(value.order) ? value.order.filter((b): b is PlanBlock => b in BLOCK_LABELS) : []
    const complete = order.length === DEFAULT_LAYOUT.order.length && new Set(order).size === order.length
    return { order: complete ? order : DEFAULT_LAYOUT.order, panelSide: value.panelSide === "left" || value.panelSide === "right" ? value.panelSide : DEFAULT_LAYOUT.panelSide }
  } catch {
    return DEFAULT_LAYOUT
  }
}

/** The plan page layout: the default until changed in Edit layout, then remembered in this browser. */
export function usePlanLayout(): [PlanLayout, (layout: PlanLayout) => void] {
  const [layout, setLayout] = useState<PlanLayout>(DEFAULT_LAYOUT)
  useEffect(() => {
    try {
      setLayout(parseLayout(localStorage.getItem(LAYOUT_KEY)))
    } catch {
      // Storage can be unavailable (private mode); the default still works.
    }
  }, [])
  const change = (next: PlanLayout) => {
    setLayout(next)
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(next))
    } catch {
      // Not remembered; the layout still applies for this visit.
    }
  }
  return [layout, change]
}

/** Move `block` one place up (-1) or down (+1). */
export function moveBlock(layout: PlanLayout, block: PlanBlock, delta: -1 | 1): PlanLayout {
  const order = [...layout.order]
  const from = order.indexOf(block)
  const to = from + delta
  if (from < 0 || to < 0 || to >= order.length) return layout
  ;[order[from], order[to]] = [order[to], order[from]]
  return { ...layout, order }
}

/** "Edit layout" / "Done" in the plan header; Reset appears while editing. */
export function EditLayoutButton({ editing, onToggle, onReset }: { editing: boolean; onToggle: () => void; onReset: () => void }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      {editing && (
          <button type="button" onClick={onReset} className="btn-ghost h-7 px-2 text-[11px]">
            Reset
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={editing}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-lg border px-2.5 text-[11px] font-medium transition-colors",
            editing ? "border-primary bg-primary text-white" : "border-card-border text-foreground-muted hover:text-foreground",
          )}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 15 }} aria-hidden="true">
            {editing ? "check" : "dashboard_customize"}
          </span>
          {editing ? "Done" : "Edit layout"}
        </button>
      </div>
    )
  }

  function MoveButton({ icon, label, disabled, active, onClick }: { icon: string; label: string; disabled?: boolean; active?: boolean; onClick: () => void }) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-md px-1.5 text-[11px] font-medium transition-colors disabled:opacity-30",
          active ? "bg-primary text-white" : "text-primary hover:bg-primary/10",
        )}
      >
        <span className="material-symbols-rounded" style={{ fontSize: 18 }} aria-hidden="true">
          {icon}
        </span>
      </button>
    )
  }

  /** One movable block. While editing: an accent outline and a bar with up / down (and, for the chart, panel side). */
  export function LayoutBlock({
    block,
    layout,
    editing,
    onChange,
    children,
  }: {
    block: PlanBlock
    layout: PlanLayout
    editing: boolean
    onChange: (layout: PlanLayout) => void
    children: ReactNode
  }) {
    const index = layout.order.indexOf(block)
    const last = layout.order.length - 1
    return (
      // The same wrapper in and out of edit mode, so entering it doesn't remount the panel.
      <div className={editing ? "space-y-1.5 rounded-2xl p-1.5 outline-2 outline-dashed outline-primary/50" : undefined}>
        {editing && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary/5 px-2 py-1">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
            <span className="material-symbols-rounded" style={{ fontSize: 16 }} aria-hidden="true">
              drag_indicator
            </span>
            {BLOCK_LABELS[block]}
          </span>
          <div className="flex items-center gap-1">
            {block === "chart" && (
              <div className="mr-1 flex items-center gap-0.5 border-r border-primary/20 pr-1.5">
                <span className="mr-1 text-[11px] text-foreground-muted">Year panel</span>
                <MoveButton icon="west" label="Year panel on the left" active={layout.panelSide === "left"} onClick={() => onChange({ ...layout, panelSide: "left" })} />
                <MoveButton icon="east" label="Year panel on the right" active={layout.panelSide === "right"} onClick={() => onChange({ ...layout, panelSide: "right" })} />
              </div>
            )}
            <MoveButton icon="north" label={`Move ${BLOCK_LABELS[block]} up`} disabled={index <= 0} onClick={() => onChange(moveBlock(layout, block, -1))} />
            <MoveButton icon="south" label={`Move ${BLOCK_LABELS[block]} down`} disabled={index >= last} onClick={() => onChange(moveBlock(layout, block, 1))} />
          </div>
        </div>
      )}
      {children}
    </div>
  )
}
