"use client"

import { useState, type ReactNode } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { AccountsModalShell } from "@/components/accounts/accounts-modal-shell"
import { MILESTONE_TEMPLATES, type TemplateKey } from "@/lib/plans/milestone-templates"
import type { PlanEditorProps } from "../plans-helpers"
import { TemplateFields } from "./milestone-template-forms"
import { applyTemplate, draftProblem } from "./template-apply"
import { initialDraft, type TemplateDraft } from "./template-draft"

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
  elderCare: "Elder care added: see Expenses (and Income if you cut back work)",
  socialSecurity: "Social Security added to Income",
  pension: "Pension added to Income",
}

/** Events a tab also offers in its own Add (the same form); the rest are added only on Milestones. */
export const EVENT_TABS: Partial<Record<TemplateKey, string>> = {
  child: "Expenses",
  elderCare: "Expenses",
  home: "Assets & debts",
  vehicle: "Assets & debts",
  career: "Income",
  break: "Income",
  socialSecurity: "Income",
  pension: "Income",
  windfall: "Income",
  inheritance: "Accounts",
}

/** The events a tab offers, from `EVENT_TABS`. */
export function eventsFor(tab: string): TemplateKey[] {
  return (Object.keys(EVENT_TABS) as TemplateKey[]).filter((k) => EVENT_TABS[k] === tab)
}

/**
 * Everything that will happen, grouped: the Milestones tab is where future events are added. What you have today
 * is added on its own tab; either way, details are edited where the items land.
 */
export const FUTURE_EVENT_GROUPS: { label: string; keys: TemplateKey[] }[] = [
  { label: "Family", keys: ["married", "child", "divorce", "widowed"] },
  { label: "Home & car", keys: ["home", "vehicle", "move"] },
  { label: "Work & income", keys: ["retire", "career", "break", "socialSecurity", "pension"] },
  { label: "Money coming in", keys: ["inheritance", "windfall"] },
  { label: "Care & other", keys: ["elderCare", "custom"] },
]

/** A choice that acts right away instead of opening a template form (e.g. a plain new income). */
export interface InstantChoice {
  label: string
  icon: string
  detail: string
  onPick: () => void
}

function ChoiceButton({ icon, label, detail, where, onClick }: { icon: string; label: string; detail: string; where?: string; onClick: () => void }) {
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
      {where && (
        <span
          className={cn(
            "mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium",
            where === ONLY_HERE ? "bg-primary/10 text-primary" : "bg-foreground/5 text-foreground-muted",
          )}
        >
          {where}
        </span>
      )}
    </button>
  )
}

const ONLY_HERE = "Only on Milestones"

function GroupedTemplates({ groups, onPick }: { groups: typeof FUTURE_EVENT_GROUPS; onPick: (key: TemplateKey) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-foreground-muted">
        Anything that will happen. Events marked with a tab can also be added there; the rest are added only here.
      </p>
      {groups.map((g) => (
        <div key={g.label} className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">{g.label}</p>
          <TemplateGrid keys={g.keys} instant={[]} onPick={onPick} labelled />
        </div>
      ))}
    </div>
  )
}

function TemplateGrid({
  keys,
  instant,
  onPick,
  labelled,
}: {
  keys: TemplateKey[]
  instant: InstantChoice[]
  onPick: (key: TemplateKey) => void
  /** Show where else each event can be added (the Milestones picker). */
  labelled?: boolean
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {instant.map((c) => (
        <ChoiceButton key={c.label} icon={c.icon} label={c.label} detail={c.detail} onClick={c.onPick} />
      ))}
      {MILESTONE_TEMPLATES.filter((t) => keys.includes(t.key)).map((t) => (
        <ChoiceButton
          key={t.key}
          icon={t.icon}
          label={t.label}
          detail={t.creates}
          where={labelled ? (EVENT_TABS[t.key] ? `Also on ${EVENT_TABS[t.key]}` : ONLY_HERE) : undefined}
          onClick={() => onPick(t.key)}
        />
      ))}
    </div>
  )
}

/** Pop-out for adding from templates: pick one (of `keys`, plus any instant choices), fill in a few details, create. */
export function AddMilestoneDialog({
  doc,
  update,
  onClose,
  keys,
  instant = [],
  title = "Add a milestone",
  footnote,
  initial,
}: PlanEditorProps & {
  onClose: () => void
  keys?: TemplateKey[]
  instant?: InstantChoice[]
  title?: string
  footnote?: ReactNode
  /** Open straight on this event's form (from another tab's Add). */
  initial?: TemplateKey
}) {
  const [template, setTemplate] = useState<TemplateKey | null>(initial ?? null)
  const [draft, setDraft] = useState<TemplateDraft | null>(() => (initial ? initialDraft(initial, doc) : null))
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
      wide={!template && !keys}
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
        <>
          {keys ? <TemplateGrid keys={keys} instant={instant} onPick={pick} /> : <GroupedTemplates groups={FUTURE_EVENT_GROUPS} onPick={pick} />}
          {footnote}
        </>
      )}
    </AccountsModalShell>
  )
}
