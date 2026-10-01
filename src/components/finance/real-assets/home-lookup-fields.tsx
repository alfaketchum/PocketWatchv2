"use client"

import { useState } from "react"
import { useHomeLookup, type RealAssetInput } from "@/hooks/finance/use-real-assets"
import { homeDataToAsset } from "@/lib/finance/home-data/to-asset"
import { HomeFacts } from "./home-facts"

/** Address search for a home: fills in its value, tax bill, rent estimate and facts. */
export function HomeLookupFields({ draft, onApply }: { draft: RealAssetInput; onApply: (change: Partial<RealAssetInput>) => void }) {
  const [address, setAddress] = useState(draft.address ?? "")
  const lookup = useHomeLookup()
  const run = () => lookup.mutate(address, { onSuccess: ({ home }) => onApply(homeDataToAsset(home, draft)) })
  return (
    <div className="space-y-2">
      <span className="block text-[11px] font-medium text-foreground-muted">Address (fills in value, tax bill and rent)</span>
      <div className="flex gap-2">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              run()
            }
          }}
          placeholder="123 Main St, Jersey City, NJ 07302"
          className="min-w-0 flex-1 rounded-xl border border-card-border bg-background-secondary px-3 py-2 text-sm text-foreground"
        />
        <button type="button" onClick={run} disabled={address.trim().length < 5 || lookup.isPending} className="btn-secondary text-xs disabled:opacity-50">
          {lookup.isPending ? "Looking up…" : "Look up"}
        </button>
      </div>
      <HomeFacts propertyTaxAnnual={draft.propertyTaxAnnual} rentEstimate={draft.rentEstimate} details={draft.homeDetails} dataSource={draft.dataSource} />
    </div>
  )
}
