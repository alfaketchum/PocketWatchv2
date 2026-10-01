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
  vehicle: "Added to Assets & debts",
  career: "Added to Income, with a milestone for the change",
  break: "Added to Income, with milestones for the break",
  windfall: "Added to Income",
  retire: "Retirement date updated",
  inheritance: "Inheritance added: see Income, Accounts and Assets",
  divorce: "Divorce added: see Income, Expenses and the account splits on Income",
  widowed: "Added: see Income and Expenses",
  socialSecurity: "Social Security added to Income",
  pension: "Pension added to Income",
}

/** Life events that change several parts of the plan at once; single items are added on their own tab. */
export const MILESTONE_TAB_TEMPLATES: TemplateKey[] = ["retire", "married", "divorce", "widowed", "move", "inheritance", "custom"]

/** A choice that acts right away instead of opening a template form (e.g. a plain new income). */
export interface InstantChoice {
  label: string
  icon: string
  detail: string
  onPick: () => void
}

function ChoiceButton({ icon, label, detail, onClick }: { icon: string; label: string; detail: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-1 rounded-xl border border-card-border p-3 text-left hover:border-primary hover:bg-primary/5 transition-colors"
    >
      <span className="material-symbols-rounded text-primary" style={{ fontSize: 22 }}>
        {icon}
      </span>
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="text-[11px] leading-snug text-foreground-muted">{detail}</span>
    </button>
  )
}

function TemplateGrid({ keys, instant, onPick }: { keys: TemplateKey[]; instant: InstantChoice[]; onPick: (key: TemplateKey) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {instant.map((c) => (
        <ChoiceButton key={c.label} icon={c.icon} label={c.label} detail={c.detail} onClick={c.onPick} />
      ))}
      {MILESTONE_TEMPLATES.filter((t) => keys.includes(t.key)).map((t) => (
        <ChoiceButton key={t.key} icon={t.icon} label={t.label} detail={t.creates} onClick={() => onPick(t.key)} />
      ))}
    </div>
  )
}

/** Pop-out for adding from templates: pick one (of `keys`, plus any instant choices), fill in a few details, create. */
export function AddMilestoneDialog({
  doc,
  update,
  onClose,
  keys = MILESTONE_TAB_TEMPLATES,
  instant = [],
  title = "Add a milestone",
}: PlanEditorProps & { onClose: () => void; keys?: TemplateKey[]; instant?: InstantChoice[]; title?: string }) {
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
      title={meta ? meta.label : title}
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
        <TemplateGrid keys={keys} instant={instant} onPick={pick} />
      )}
    </AccountsModalShell>
  )
}
