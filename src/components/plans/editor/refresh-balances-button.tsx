"use client"

import { useState } from "react"
import { toast } from "sonner"
import { fetchSourceBalances } from "@/hooks/plans/use-plan-import"
import { applySourceBalances } from "@/lib/plans/plan-refresh"
import type { PlanEditorProps } from "../plans-helpers"

/** Only on request: copy today's balances from the linked accounts this plan was imported from. */
export function RefreshBalancesButton({ doc, update }: PlanEditorProps) {
  const [busy, setBusy] = useState(false)
  const linked = doc.accounts.some((a) => a.source) || doc.debts.some((d) => d.source)
  if (!linked) return null

  const refresh = async () => {
    setBusy(true)
    try {
      const balances = await fetchSourceBalances()
      update((d) => applySourceBalances(d, balances, new Date()))
      toast.success("Balances updated; the plan now starts this month")
    } catch (err) {
      toast.error(`Couldn't refresh balances: ${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-card-border px-3 py-2.5">
      <p className="text-xs text-foreground-muted">
        Some accounts came from your linked data. Balances stay as imported until you refresh them.
      </p>
      <button type="button" onClick={refresh} disabled={busy} className="btn-secondary text-xs disabled:opacity-50">
        <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
          sync
        </span>
        {busy ? "Refreshing…" : "Refresh balances"}
      </button>
    </div>
  )
}
