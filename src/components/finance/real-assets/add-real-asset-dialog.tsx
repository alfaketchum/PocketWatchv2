"use client"

import { useState } from "react"
import { AccountsModalShell } from "@/components/accounts/accounts-modal-shell"
import type { RealAssetInput, RealAssetLoan } from "@/hooks/finance/use-real-assets"
import type { RealAssetKind } from "@/lib/finance/real-assets"
import { RealAssetForm } from "./real-asset-form"

const KINDS: { kind: RealAssetKind; icon: string; label: string; detail: string }[] = [
  { kind: "home", icon: "home", label: "Home", detail: "A house, condo or land you own" },
  { kind: "vehicle", icon: "directions_car", label: "Vehicle", detail: "A car, truck, motorcycle or boat" },
  { kind: "other", icon: "category", label: "Other", detail: "Anything else of value" },
]

/** Pop-out for adding a home, vehicle or other asset: pick the type, then fill it in. */
export function AddRealAssetDialog({
  loans,
  saving,
  onSave,
  onClose,
}: {
  loans: RealAssetLoan[]
  saving: boolean
  onSave: (input: Partial<RealAssetInput>) => void
  onClose: () => void
}) {
  const [kind, setKind] = useState<RealAssetKind | null>(null)
  const meta = KINDS.find((k) => k.kind === kind)
  return (
    <AccountsModalShell
      title={meta ? `Add a ${meta.label.toLowerCase()}` : "What are you adding?"}
      onClose={onClose}
      footer={
        kind ? (
          <button type="button" onClick={() => setKind(null)} className="btn-ghost text-sm mr-auto">
            ← Back
          </button>
        ) : (
          <button type="button" onClick={onClose} className="btn-ghost text-sm">
            Cancel
          </button>
        )
      }
    >
      {kind ? (
        <RealAssetForm key={kind} asset={null} kind={kind} loans={loans} saving={saving} onSave={onSave} onCancel={onClose} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              onClick={() => setKind(k.kind)}
              className="flex flex-col items-start gap-1 rounded-xl border border-card-border p-3 text-left hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <span className="material-symbols-rounded text-primary" style={{ fontSize: 22 }}>
                {k.icon}
              </span>
              <span className="text-sm font-medium text-foreground">{k.label}</span>
              <span className="text-[11px] leading-snug text-foreground-muted">{k.detail}</span>
            </button>
          ))}
        </div>
      )}
    </AccountsModalShell>
  )
}
