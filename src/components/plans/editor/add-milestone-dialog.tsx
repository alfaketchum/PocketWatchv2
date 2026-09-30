"use client"

import { useState } from "react"
import { toast } from "sonner"
import { AccountsModalShell } from "@/components/accounts/accounts-modal-shell"
import { MILESTONE_TEMPLATES, type TemplateKey } from "@/lib/plans/milestone-templates"
import type { PlanEditorProps } from "../plans-helpers"
import { applyTemplate, draftProblem, initialDraft, TemplateFields, type TemplateDraft } from "./milestone-template-forms"

/** Where each template's result shows up, for the confirmation toast. */
const LANDS_ON: Partial<Record<TemplateKey, string>> = {
  child: "Added to Expenses → Kids",
  home: "Added to Assets & debts",
  retire: "Retirement date updated",
}

function TemplateGrid({ onPick }: { onPick: (key: TemplateKey) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {MILESTONE_TEMPLATES.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onPick(t.key)}
          className="flex flex-col items-start gap-1 rounded-xl border border-card-border p-3 text-left hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <span className="material-symbols-rounded text-primary" style={{ fontSize: 22 }}>
            {t.icon}
          </span>
          <span className="text-sm font-medium text-foreground">{t.label}</span>
          <span className="text-[11px] leading-snug text-foreground-muted">{t.creates}</span>
        </button>
      ))}
    </div>
  )
}

/** Pop-out for adding a life event: pick a template, fill in a few details, create. */
export function AddMilestoneDialog({ doc, update, onClose }: PlanEditorProps & { onClose: () => void }) {
  const [template, setTemplate] = useState<TemplateKey | null>(null)
  const [draft, setDraft] = useState<TemplateDraft | null>(null)
  const meta = MILESTONE_TEMPLATES.find((t) => t.key === template)
  const problem = template && draft ? draftProblem(template, draft, doc) : null

  const pick = (key: TemplateKey) => {
    setTemplate(key)
    setDraft(initialDraft(key, doc))
  }
  const create = () => {
    if (!template || !draft || problem) return
    update((d) => applyTemplate(template, draft, d))
    toast.success(LANDS_ON[template] ?? `Added "${draft.name || meta?.label}"`)
    onClose()
  }

  return (
    <AccountsModalShell
      title={meta ? meta.label : "Add a milestone"}
      onClose={onClose}
      footer={
        template ? (
          <>
            <button type="button" onClick={() => setTemplate(null)} className="btn-ghost text-sm mr-auto">
              ← Back
            </button>
            {problem && <span className="self-center text-xs text-foreground-muted">{problem}</span>}
            <button type="button" onClick={create} disabled={!!problem} className="btn-primary text-sm disabled:opacity-50">
              {template === "retire" ? "Update" : "Add"}
            </button>
          </>
        ) : (
          <button type="button" onClick={onClose} className="btn-ghost text-sm">
            Cancel
          </button>
        )
      }
    >
      {template && draft ? (
        <div className="space-y-3">
          <p className="text-xs text-foreground-muted">{meta?.creates}. Everything it adds moves with the date.</p>
          <TemplateFields template={template} d={draft} set={(change) => setDraft({ ...draft, ...change })} doc={doc} />
        </div>
      ) : (
        <TemplateGrid onPick={pick} />
      )}
    </AccountsModalShell>
  )
}
