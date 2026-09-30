"use client"

import type { PlanDocument, Timing } from "@/lib/plans/plan-types"
import { timingLabel } from "../plans-helpers"

/** Read-only timing in a table cell; edited in detailed view. */
export function TimingCell({ timing, doc }: { timing: Timing; doc: PlanDocument }) {
  return <span className="block truncate px-2 text-xs text-foreground-muted">{timingLabel(timing, doc)}</span>
}
