"use client"

import { useState, type ComponentType, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"

export interface EditorSection {
  key: string
  label: string
  icon: string
  title: string
  description: string
  Body: ComponentType<{ state: FirePlanState }>
}

interface FireSectionTabsProps {
  sections: EditorSection[]
  state: FirePlanState
  initial?: string
  footer?: ReactNode
}

/** Plan editor shell: icon tabs, then one section with a heading and a one-line purpose. */
export function FireSectionTabs({ sections, state, initial, footer }: FireSectionTabsProps) {
  const [active, setActive] = useState(initial ?? sections[0].key)
  const section = sections.find((s) => s.key === active) ?? sections[0]
  const { Body } = section

  return (
    <div>
      <div role="tablist" aria-label="Plan settings" className="flex gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
        {sections.map((s) => {
          const selected = s.key === section.key
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(s.key)}
              className={cn(
                "flex items-center gap-1.5 shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                selected ? "bg-primary/10 text-primary" : "text-foreground-muted hover:text-foreground hover:bg-foreground/5",
              )}
            >
              <span className={cn("material-symbols-rounded", selected && "filled")} style={{ fontSize: 18 }}>{s.icon}</span>
              {s.label}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" className="mt-4 rounded-xl border border-card-border p-4 sm:p-5">
        <h3 className="text-base font-semibold text-foreground">{section.title}</h3>
        <p className="text-xs text-foreground-muted mt-0.5 mb-5">{section.description}</p>
        <Body state={state} />
      </div>

      {footer}
    </div>
  )
}
