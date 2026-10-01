"use client"

import { useState } from "react"
import { toast } from "sonner"
import { AccountsModalShell } from "@/components/accounts/accounts-modal-shell"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { typicalRunningCosts } from "@/lib/plans/plan-asset-costs"
import { PLAN_LIMITS } from "@/lib/plans/plan-constants"
import type { AssetKind, PlanAsset } from "@/lib/plans/plan-types"
import { newItemId, type PlanEditorProps } from "../plans-helpers"
import { TemplateFields } from "./milestone-template-forms"
import { applyTemplate } from "./template-apply"
import { initialDraft, type TemplateDraft } from "./template-draft"
import { TextField } from "./plan-editor-controls"

type Choice = "own-home" | "own-vehicle" | "own-other" | "buy-home" | "buy-vehicle"

const CHOICES: { key: Choice; icon: string; label: string; detail: string }[] = [
  { key: "own-home", icon: "home", label: "A home I own", detail: "Owned now, with its value and running costs" },
  { key: "own-vehicle", icon: "directions_car", label: "A vehicle I own", detail: "Owned now; loses value each year" },
  { key: "own-other", icon: "category", label: "Something else I own", detail: "Land, a boat, art…" },
  { key: "buy-home", icon: "add_home", label: "Buy a home", detail: "Later in the plan, with how you'll pay" },
  { key: "buy-vehicle", icon: "car_rental", label: "Buy a vehicle", detail: "Later in the plan, with how you'll pay" },
]

const OWNED: Record<"own-home" | "own-vehicle" | "own-other", { kind: AssetKind; name: string; value: number; appreciation: number }> = {
  "own-home": { kind: "home", name: "Home", value: 400_000, appreciation: 0.03 },
  "own-vehicle": { kind: "vehicle", name: "Car", value: 30_000, appreciation: -0.15 },
  "own-other": { kind: "other", name: "Asset", value: 10_000, appreciation: 0 },
}

function isOwned(c: Choice): c is keyof typeof OWNED {
  return c in OWNED
}

function ChoiceGrid({ onPick }: { onPick: (c: Choice) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {CHOICES.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onPick(c.key)}
          className="flex flex-col items-start gap-1 rounded-xl border border-card-border p-3 text-left hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <span className="material-symbols-rounded text-primary" style={{ fontSize: 22 }}>
            {c.icon}
          </span>
          <span className="text-sm font-medium text-foreground">{c.label}</span>
          <span className="text-[11px] leading-snug text-foreground-muted">{c.detail}</span>
        </button>
      ))}
    </div>
  )
}

/** Pop-out for adding an asset: something owned now (a few fields), or a planned purchase (the Buy a home / vehicle forms). */
export function AddAssetDialog({ doc, update, onClose }: Pick<PlanEditorProps, "doc" | "update"> & { onClose: () => void }) {
  const [choice, setChoice] = useState<Choice | null>(null)
  const [owned, setOwned] = useState(OWNED["own-home"])
  const [draft, setDraft] = useState<TemplateDraft | null>(null)
  const full = doc.assets.length >= PLAN_LIMITS.assets

  const pick = (c: Choice) => {
    setChoice(c)
    if (isOwned(c)) setOwned(OWNED[c])
    else setDraft(initialDraft(c === "buy-home" ? "home" : "vehicle", doc))
  }
  const add = () => {
    if (!choice || full) return
    if (isOwned(choice)) {
      const asset: PlanAsset = {
        id: newItemId("asset"),
        name: owned.name.trim() || OWNED[choice].name,
        kind: owned.kind,
        value: owned.value,
        appreciation: owned.appreciation,
        start: { type: "planStart" },
        end: { type: "planEnd" },
        runningCosts: typicalRunningCosts(owned.kind, doc.settings.state),
      }
      update((d) => ({ ...d, assets: [...d.assets, asset] }))
    } else if (draft) {
      update((d) => applyTemplate(choice === "buy-home" ? "home" : "vehicle", draft, d))
    }
    toast.success("Added to Assets & debts")
    onClose()
  }
  const meta = CHOICES.find((c) => c.key === choice)

  return (
    <AccountsModalShell
      title={meta ? meta.label : "Add an asset"}
      onClose={onClose}
      footer={
        choice ? (
          <>
            <button type="button" onClick={() => setChoice(null)} className="btn-ghost text-sm mr-auto">
              ← Back
            </button>
            {full && <span className="self-center text-xs text-foreground-muted">This plan has the most assets it can hold.</span>}
            <button type="button" onClick={add} disabled={full} className="btn-primary text-sm disabled:opacity-50">
              Add
            </button>
          </>
        ) : (
          <button type="button" onClick={onClose} className="btn-ghost text-sm">
            Cancel
          </button>
        )
      }
    >
      {!choice && <ChoiceGrid onPick={pick} />}
      {choice && isOwned(choice) && (
        <div className="space-y-3">
          <TextField label="Name" value={owned.name} onChange={(name) => setOwned({ ...owned, name })} />
          <div className="grid grid-cols-2 gap-2">
            <FireNumberField label="Worth today" prefix="$" min={0} value={owned.value} onChange={(value) => setOwned({ ...owned, value })} />
            <FireNumberField
              label="Value change / yr"
              suffix="%"
              scale={100}
              min={-0.5}
              max={1}
              value={owned.appreciation}
              onChange={(appreciation) => setOwned({ ...owned, appreciation })}
            />
          </div>
          <p className="text-xs text-foreground-muted">
            {typicalRunningCosts(owned.kind, null).length > 0 ? "Typical running costs are added; edit them on its card. " : ""}
            If it has a loan, add the loan under Debts and link it.
          </p>
        </div>
      )}
      {choice && !isOwned(choice) && draft && (
        <TemplateFields template={choice === "buy-home" ? "home" : "vehicle"} d={draft} set={(change) => setDraft({ ...draft, ...change })} doc={doc} />
      )}
    </AccountsModalShell>
  )
}
