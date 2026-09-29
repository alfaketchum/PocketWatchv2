"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { InfoTooltip } from "@/components/ui/info-tooltip"

interface FireSectionCardProps {
  eyebrow: string
  title?: ReactNode
  info?: string
  right?: ReactNode
  className?: string
  children: ReactNode
}

export function FireSectionCard({ eyebrow, title, info, right, className, children }: FireSectionCardProps) {
  return (
    <section
      className={cn("bg-card border border-card-border rounded-2xl p-5 sm:p-6", className)}
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">{eyebrow}</p>
            {info && (
              <InfoTooltip content={info}>
                <span className="material-symbols-rounded text-foreground-muted cursor-help" style={{ fontSize: 13 }}>
                  info
                </span>
              </InfoTooltip>
            )}
          </div>
          {title && <div className="text-sm font-semibold text-foreground mt-1">{title}</div>}
        </div>
        {right}
      </div>
      {children}
    </section>
  )
}
