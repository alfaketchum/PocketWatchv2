"use client"

import { useState } from "react"
import { ROADMAP_EFFORTS, ROADMAP_TIERS, type RoadmapTier } from "@/lib/roadmap/roadmap-seed"
import { useCreateRoadmapItem } from "@/hooks/roadmap/use-roadmap"
import { TIER_META } from "./roadmap-constants"

const FIELD = "rounded-lg border border-card-border bg-background px-2.5 py-1.5 text-sm text-foreground"

/** Inline form for a feature that wasn't in the review. */
export function AddRoadmapItem({ onDone }: { onDone: () => void }) {
  const create = useCreateRoadmapItem()
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [tier, setTier] = useState<RoadmapTier>("B")
  const [effort, setEffort] = useState("M")
  const submit = () => {
    if (!title.trim()) return
    create.mutate({ title: title.trim(), summary: summary.trim(), tier, effort }, { onSuccess: onDone })
  }
  return (
    <div className="bg-card border border-card-border rounded-2xl p-4 space-y-3" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Feature" className={FIELD} />
        <select aria-label="Tier" value={tier} onChange={(e) => setTier(e.target.value as RoadmapTier)} className={FIELD}>
          {ROADMAP_TIERS.map((t) => <option key={t} value={t}>{TIER_META[t].label}</option>)}
        </select>
        <select aria-label="Effort" value={effort} onChange={(e) => setEffort(e.target.value)} className={FIELD}>
          {ROADMAP_EFFORTS.map((e) => <option key={e} value={e}>Effort {e}</option>)}
        </select>
      </div>
      <textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What it does (optional)" rows={2} className={`${FIELD} w-full text-xs`} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn-ghost text-xs">Cancel</button>
        <button type="button" onClick={submit} disabled={!title.trim() || create.isPending} className="btn-primary text-xs disabled:opacity-50">
          Add to backlog
        </button>
      </div>
    </div>
  )
}
