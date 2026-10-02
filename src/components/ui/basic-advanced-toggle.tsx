"use client"

import { cn } from "@/lib/utils"

export type BasicAdvanced = "basic" | "advanced"

const MODES: { value: BasicAdvanced; label: string; icon: string }[] = [
  { value: "basic", label: "Basic", icon: "bolt" },
  { value: "advanced", label: "Advanced", icon: "science" },
]

/** Segmented Basic / Advanced switch, shared by FIRE and the planner. */
export function BasicAdvancedToggle({ mode, onChange, label }: { mode: BasicAdvanced; onChange: (mode: BasicAdvanced) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-card-border bg-card p-0.5">
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
              "flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-medium transition-colors",
              active ? "bg-primary text-white" : "text-foreground-muted hover:text-foreground",
            )}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>{m.icon}</span>
            {m.label}
          </button>
        )
      })}
    </div>
  )
}
