"use client"

import { useState } from "react"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import { useDeleteRealAsset, useRealAssets, useSaveRealAsset, type RealAssetInput } from "@/hooks/finance/use-real-assets"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import { formatCurrency } from "@/lib/utils"
import { RealAssetCard } from "./real-asset-card"
import { RealAssetForm } from "./real-asset-form"
import { AddRealAssetDialog } from "./add-real-asset-dialog"

/** Editing: an asset id, "new", or nothing open. */
type Editing = string | "new" | null

/** Homes, vehicles and other things you own, valued by hand; they count in net worth. A section of the Accounts page. */
export function RealAssetsSection() {
  const { data, isLoading, isError } = useRealAssets()
  const save = useSaveRealAsset()
  const remove = useDeleteRealAsset()
  const { isHidden } = usePrivacyMode()
  const [editing, setEditing] = useState<Editing>(null)

  const assets = data?.assets ?? []
  const loans = data?.loans ?? []
  const loanFor = (id: string | null) => loans.find((l) => l.id === id) ?? null
  const total = assets.reduce((s, a) => s + a.estimatedValue, 0)
  const owed = assets.reduce((s, a) => s + (loanFor(a.loanAccountId)?.balance ?? 0), 0)
  const submit = (id: string | undefined) => (input: Partial<RealAssetInput>) =>
    save.mutate({ ...input, id }, { onSuccess: () => setEditing(null) })

  return (
    <section id="homes" className="space-y-4 scroll-mt-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Homes &amp; Vehicles</h2>
          <p className="text-xs text-foreground-muted">Valued by you and counted in your net worth</p>
        </div>
        {editing !== "new" && (
          <button type="button" onClick={() => setEditing("new")} className="btn-primary text-xs">
            + Add
          </button>
        )}
      </div>
      {isError && <p className="text-sm text-error">Couldn&apos;t load your homes and vehicles.</p>}
      {isLoading ? (
        <div className="h-32 animate-shimmer rounded-2xl" />
      ) : (
        <>
          {assets.length > 0 && (
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <span className="text-foreground-muted">
                Worth <b className="text-foreground tabular-nums"><BlurredValue isHidden={isHidden}>{formatCurrency(total)}</BlurredValue></b>
              </span>
              {owed > 0 && (
                <span className="text-foreground-muted">
                  Equity <b className="text-foreground tabular-nums"><BlurredValue isHidden={isHidden}>{formatCurrency(total - owed)}</BlurredValue></b>
                </span>
              )}
            </div>
          )}
          {editing === "new" && (
            <AddRealAssetDialog loans={loans} saving={save.isPending} onSave={submit(undefined)} onClose={() => setEditing(null)} />
          )}
          {assets.length === 0 && editing !== "new" && (
            <div className="bg-card border border-card-border rounded-2xl p-8 text-center">
              <span className="material-symbols-rounded text-foreground-muted mb-2 block" style={{ fontSize: 28 }}>home</span>
              <p className="text-sm text-foreground-muted">
                Add your home or car to count it in your net worth. Link its mortgage or auto loan to see your equity.
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {assets.map((a) =>
              editing === a.id ? (
                <div key={a.id} className="bg-card border border-card-border rounded-2xl p-4 sm:p-5 lg:col-span-2" style={{ boxShadow: "var(--shadow-sm)" }}>
                  <RealAssetForm asset={a} loans={loans} saving={save.isPending} onSave={submit(a.id)} onCancel={() => setEditing(null)} />
                </div>
              ) : (
                <RealAssetCard key={a.id} asset={a} loan={loanFor(a.loanAccountId)} isHidden={isHidden} onEdit={() => setEditing(a.id)} onDelete={() => remove.mutate(a.id)} />
              ),
            )}
          </div>
        </>
      )}
    </section>
  )
}
