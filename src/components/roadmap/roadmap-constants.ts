import type { RoadmapStatus, RoadmapTier } from "@/lib/roadmap/roadmap-seed"

/** Board columns, left to right; Skipped sits in a collapsed list below. */
export const BOARD_COLUMNS: RoadmapStatus[] = ["backlog", "next", "building", "done"]

export const STATUS_META: Record<RoadmapStatus, { label: string; icon: string; tone: string }> = {
  backlog: { label: "Backlog", icon: "inventory_2", tone: "text-foreground-muted" },
  next: { label: "Next up", icon: "flag", tone: "text-primary" },
  building: { label: "Building", icon: "construction", tone: "text-warning" },
  done: { label: "Done", icon: "check_circle", tone: "text-success" },
  skipped: { label: "Skipped", icon: "block", tone: "text-foreground-muted" },
}

export const TIER_META: Record<RoadmapTier, { label: string; hint: string; className: string }> = {
  A: { label: "Tier A", hint: "Build first: high demand, PL hasn't shipped it, we're ahead", className: "bg-primary/10 text-primary" },
  B: { label: "Tier B", hint: "Parity: PL has it, buyers will expect it", className: "bg-warning/10 text-warning" },
  C: { label: "Tier C", hint: "Later or skip: niche, costly, or PL's moat", className: "bg-foreground/5 text-foreground-muted" },
}
