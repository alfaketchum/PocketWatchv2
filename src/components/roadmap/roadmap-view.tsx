"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { ROADMAP_TIERS, type RoadmapStatus, type RoadmapTier } from "@/lib/roadmap/roadmap-seed"
import { useDeleteRoadmapItem, useRoadmap, useUpdateRoadmapItem } from "@/hooks/roadmap/use-roadmap"
import type { RoadmapItem } from "@/hooks/roadmap/shared"
import { AddRoadmapItem } from "./add-roadmap-item"
import { RoadmapCard } from "./roadmap-card"
import { BOARD_COLUMNS, STATUS_META, TIER_META } from "./roadmap-constants"

type TierFilter = "all" | RoadmapTier

/** Done out of everything not skipped, plus counts per status. */
function Progress({ items }: { items: RoadmapItem[] }) {
  const active = items.filter((i) => i.status !== "skipped")
  const done = active.filter((i) => i.status === "done").length
  const share = active.length > 0 ? done / active.length : 0
  return (
    <div className="bg-card border border-card-border rounded-2xl p-4 space-y-3" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-foreground">
          <span className="text-2xl font-semibold tabular-nums">{done}</span>
          <span className="text-foreground-muted"> of {active.length} features done</span>
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {(["next", "building", "backlog", "skipped"] as RoadmapStatus[]).map((s) => (
            <span key={s} className={cn("inline-flex items-center gap-1", STATUS_META[s].tone)}>
              <span className="material-symbols-rounded" style={{ fontSize: 14 }}>{STATUS_META[s].icon}</span>
              {items.filter((i) => i.status === s).length} {STATUS_META[s].label.toLowerCase()}
            </span>
          ))}
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-background-secondary">
        <div className="h-full rounded-full bg-success transition-all" style={{ width: `${share * 100}%` }} />
      </div>
    </div>
  )
}

function Column({ status, items, onPatch, onDelete }: {
  status: RoadmapStatus
  items: RoadmapItem[]
  onPatch: (id: string, patch: Partial<RoadmapItem>) => void
  onDelete: (id: string) => void
}) {
  const meta = STATUS_META[status]
  return (
    <section className="min-w-0 space-y-2">
      <h2 className={cn("flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wider", meta.tone)}>
        <span className="material-symbols-rounded" style={{ fontSize: 15 }}>{meta.icon}</span>
        {meta.label}
        <span className="font-normal text-foreground-muted">{items.length}</span>
      </h2>
      <div className="space-y-2 rounded-2xl bg-background-secondary/50 p-2 min-h-24">
        {items.length === 0 && <p className="px-2 py-6 text-center text-[11px] text-foreground-muted">Nothing here yet</p>}
        {items.map((item) => (
          <RoadmapCard key={item.id} item={item} onPatch={(patch) => onPatch(item.id, patch)} onDelete={() => onDelete(item.id)} />
        ))}
      </div>
    </section>
  )
}

/** Features from the ProjectionLab review as a board: backlog → next up → building → done. */
export function RoadmapView() {
  const { data: items, isLoading, isError } = useRoadmap()
  const update = useUpdateRoadmapItem()
  const remove = useDeleteRoadmapItem()
  const [tier, setTier] = useState<TierFilter>("all")
  const [adding, setAdding] = useState(false)
  const [showSkipped, setShowSkipped] = useState(false)
  const visible = useMemo(() => (items ?? []).filter((i) => tier === "all" || i.tier === tier), [items, tier])
  const byStatus = (s: RoadmapStatus) => visible.filter((i) => i.status === s).sort((a, b) => a.tier.localeCompare(b.tier) || a.rank - b.rank)
  const onPatch = (id: string, patch: Partial<RoadmapItem>) => update.mutate({ id, patch })
  const skipped = byStatus("skipped")

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Roadmap</h1>
          <p className="text-xs text-foreground-muted mt-0.5">
            Features from the ProjectionLab review, ranked by demand, PL&apos;s gaps and our head start. Move them along week by week.
          </p>
        </div>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="btn-primary text-xs">
            + Add feature
          </button>
        )}
      </div>
      {adding && <AddRoadmapItem onDone={() => setAdding(false)} />}
      {isError && <p className="text-sm text-error">Couldn&apos;t load the roadmap.</p>}
      {isLoading || !items ? (
        <div className="h-96 animate-shimmer rounded-2xl" />
      ) : (
        <>
          <Progress items={items} />
          <div role="radiogroup" aria-label="Tier" className="flex flex-wrap gap-1.5">
            {(["all", ...ROADMAP_TIERS] as TierFilter[]).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={tier === t}
                title={t === "all" ? undefined : TIER_META[t].hint}
                onClick={() => setTier(t)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  tier === t ? "border-primary bg-primary/10 text-primary" : "border-card-border text-foreground-muted hover:text-foreground",
                )}
              >
                {t === "all" ? "All tiers" : TIER_META[t].label}
              </button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {BOARD_COLUMNS.map((s) => (
              <Column key={s} status={s} items={byStatus(s)} onPatch={onPatch} onDelete={(id) => remove.mutate(id)} />
            ))}
          </div>
          {skipped.length > 0 && (
            <div className="space-y-2">
              <button type="button" onClick={() => setShowSkipped(!showSkipped)} className="inline-flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground">
                Skipped ({skipped.length})
                <span className="material-symbols-rounded" style={{ fontSize: 14 }}>{showSkipped ? "expand_more" : "chevron_right"}</span>
              </button>
              {showSkipped && (
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {skipped.map((item) => (
                    <RoadmapCard key={item.id} item={item} onPatch={(patch) => onPatch(item.id, patch)} onDelete={() => remove.mutate(item.id)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
