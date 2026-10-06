"use client"

import { toast } from "sonner"
import { removeAsset } from "@/lib/plans/plan-edits"
import { keepPaying, strandedByRemoval } from "@/lib/plans/plan-milestone-uses"
import type { PlanDocument } from "@/lib/plans/plan-types"
import type { DocUpdater } from "../plans-helpers"

/** How long the left-behind costs notice stays up. */
const NOTICE_MS = 12_000

/**
 * Removes an asset, and when it was bought at a milestone that costs still stop at (rent that ends when the home
 * is bought), says so with a one-click fix: keep paying them to the plan's end.
 */
export function removeAssetWithNotice(doc: PlanDocument, update: (u: DocUpdater) => void, assetId: string): void {
  const stranded = strandedByRemoval(doc, assetId)
  update((d) => removeAsset(d, assetId))
  if (!stranded) return
  const what = stranded.names.length === 1 ? `${stranded.names[0]} still stops` : `${stranded.names.join(", ")} still stop`
  toast.warning(`${what} at "${stranded.milestone.name}", but nothing is bought then any more.`, {
    duration: NOTICE_MS,
    action: { label: "Keep paying", onClick: () => update((d) => keepPaying(d, stranded.expenseIds)) },
  })
}
