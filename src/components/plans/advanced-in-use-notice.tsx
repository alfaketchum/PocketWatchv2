"use client"

import type { AdvancedSetting } from "@/lib/plans/plan-mode"

/** Basic only: the Advanced settings shaping this plan's numbers, each a shortcut to where it's set. */
export function AdvancedInUseNotice({ settings, onOpen }: { settings: AdvancedSetting[]; onOpen: (tab: string) => void }) {
  if (settings.length === 0) return null
  const count = settings.length === 1 ? "1 Advanced setting shapes" : `${settings.length} Advanced settings shape`
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl border border-card-border bg-card px-4 py-2.5 text-xs text-foreground-muted">
      <span className="material-symbols-rounded text-primary" style={{ fontSize: 16 }} aria-hidden="true">
        science
      </span>
      <span>{count} this plan:</span>
      {settings.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => onOpen(s.tab)}
          title="Switch to Advanced and open it"
          className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-medium text-primary hover:bg-primary/15"
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}
