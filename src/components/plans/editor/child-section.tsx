"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** A switchable part of a child's plan (raising costs, college, 529, support). */
export function ChildSection({
  title,
  description,
  enabled,
  onToggle,
  children,
}: {
  title: string
  description: string
  enabled: boolean
  onToggle: (on: boolean) => void
  children?: ReactNode
}) {
  return (
    <div className={cn("rounded-lg border px-3 py-2.5 space-y-2.5", enabled ? "border-primary/30 bg-primary/5" : "border-card-border")}>
      <button type="button" role="switch" aria-checked={enabled} onClick={() => onToggle(!enabled)} className="flex w-full items-start gap-2.5 text-left">
        <span className={cn("relative mt-0.5 h-4 w-7 shrink-0 rounded-full transition-colors", enabled ? "bg-primary" : "bg-card-border")}>
          <span className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all", enabled ? "left-[14px]" : "left-0.5")} />
        </span>
        <span>
          <span className="block text-sm font-medium text-foreground">{title}</span>
          <span className="block text-[11px] text-foreground-muted">{description}</span>
        </span>
      </button>
      {enabled && children}
    </div>
  )
}
