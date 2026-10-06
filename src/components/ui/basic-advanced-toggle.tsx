"use client"

import { cn } from "@/lib/utils"

export type BasicAdvanced = "basic" | "advanced"

const MODES: { value: BasicAdvanced; label: string; icon: string }[] = [
  { value: "basic", label: "Basic", icon: "bolt" },
  { value: "advanced", label: "Advanced", icon: "science" },
]

/**
 * Segmented Basic / Advanced switch, shared by FIRE and the planner. `bare` leaves out its own box and the icons, for
 * sitting compactly inside a toolbar group, at the toolbar's button height.
 */
export function BasicAdvancedToggle({ mode, onChange, label, bare = false }: { mode: BasicAdvanced; onChange: (mode: BasicAdvanced) => void; label: string; bare?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex", !bare && "rounded-xl border border-card-border bg-card p-0.5")}>
      {MODES.map((m) => {
        const active = m.value === mode
        return (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(m.value)}
            className={cn(
              "flex items-center gap-1.5 px-3 text-xs font-medium transition-colors",
              bare ? "h-11 lg:h-9 rounded-lg px-2.5" : "rounded-[10px] py-1.5",
              active ? "bg-primary text-white" : "text-foreground-muted hover:text-foreground",
            )}
          >
            {!bare && <span className="material-symbols-rounded" style={{ fontSize: 14 }}>{m.icon}</span>}
            {m.label}
          </button>
        )
      })}
    </div>
  )
}
