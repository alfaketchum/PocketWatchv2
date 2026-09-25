"use client"

import { cn } from "@/lib/utils"
import { NET_WORTH_TIMEFRAMES, type NetWorthTf } from "@/hooks/use-net-worth-timeframe"

interface Props {
  value: NetWorthTf
  onSelect: (tf: NetWorthTf) => void
  className?: string
  size?: "sm" | "md"
  options?: ReadonlyArray<{ key: NetWorthTf; label: string }>
}

/** Segmented lookback control, shared by the sidebar and page. */
export function NetWorthTimeframeToggle({ value, onSelect, className, size = "md", options = NET_WORTH_TIMEFRAMES }: Props) {
  const pad = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
  return (
    <div className={cn("inline-flex items-center bg-background-secondary border border-card-border rounded-lg p-0.5", className)}>
      {options.map((t) => (
        <button
          key={t.key}
          onClick={() => onSelect(t.key)}
          className={cn(
            "font-semibold rounded-md transition-colors",
            pad,
            value === t.key ? "bg-primary text-white shadow-sm" : "text-foreground-muted hover:text-foreground",
          )}
          title={`Change over ${t.label}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
