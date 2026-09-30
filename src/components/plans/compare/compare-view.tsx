"use client"

import dynamic from "next/dynamic"
import { useMemo, useState } from "react"
import { EmptyState } from "@/components/ui/empty-state"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { usePlansList } from "@/hooks/plans/use-plans-list"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import { cn } from "@/lib/utils"
import { CompareTable } from "./compare-table"

const CompareChart = dynamic(() => import("./compare-chart").then((m) => m.CompareChart), {
  ssr: false,
  loading: () => <div className="h-[380px] animate-shimmer rounded-2xl" />,
})

const MAX_COMPARED = 4
const DEFAULT_COMPARED = 2

/** Pick up to four plans and see their paths and key numbers side by side. */
export function CompareView() {
  const list = usePlansList()
  const { isHidden } = usePrivacyMode()
  const { palette, primary } = useChartTheme()
  const plans = useMemo(() => (list.data?.plans ?? []).filter((p) => p.summary), [list.data])
  const [picked, setPicked] = useState<string[] | null>(null)
  const selectedIds = picked ?? plans.slice(0, DEFAULT_COMPARED).map((p) => p.id)
  const selected = plans.filter((p) => selectedIds.includes(p.id))
  const colors = selected.map((_, i) => (i === 0 ? primary : palette[i] ?? primary))

  if (list.isLoading) return <div className="h-[420px] animate-shimmer rounded-2xl" />
  if (plans.length < 2) {
    return (
      <EmptyState
        icon="compare_arrows"
        title="Make a second plan to compare"
        description="Duplicate a plan, change one thing (retire earlier, buy a house), and compare the two here."
        action={{ label: "Go to plans", href: "/plans" }}
      />
    )
  }

  const toggle = (id: string) => {
    const next = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id].slice(-MAX_COMPARED)
    setPicked(next)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Plans to compare">
        {plans.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={selectedIds.includes(p.id)}
            onClick={() => toggle(p.id)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              selectedIds.includes(p.id) ? "border-primary bg-primary/10 text-primary" : "border-card-border text-foreground-muted hover:text-foreground",
            )}
          >
            {p.name}
          </button>
        ))}
        <span className="self-center text-[11px] text-foreground-muted ml-1">Up to {MAX_COMPARED}</span>
      </div>
      {selected.length > 0 && (
        <>
          <CompareChart plans={selected} colors={colors} isHidden={isHidden} />
          <CompareTable plans={selected} colors={colors} isHidden={isHidden} />
        </>
      )}
    </div>
  )
}
