"use client"

import { useState, type ReactNode } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ChoiceChips } from "@/components/fire/fire-input-controls"
import { AccountsModalShell } from "@/components/accounts/accounts-modal-shell"
import { MILESTONE_TEMPLATES, type TemplateKey } from "@/lib/plans/milestone-templates"
import type { PlanEditorProps } from "../plans-helpers"
import { ChildDialog } from "./child-dialog"
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
  { label: "Family", keys: ["married", "child", "divorce", "widowed", "elderCare"] },
  { label: "Home & car", keys: ["home", "vehicle", "move"] },
  { label: "Work & income", keys: ["retire", "career", "break", "socialSecurity", "pension"] },
  { label: "Money coming in", keys: ["inheritance", "windfall"] },
  { label: "Other", keys: ["custom"] },
]

/** A choice that acts right away instead of opening a template form (e.g. a plain new income). */
export interface InstantChoice {
  label: string
  icon: string
  detail: string
  onPick: () => void
}

/** Tabs in tab-bar order, so "Changes: …" always reads the same way round. */
const TAB_ORDER = ["Assumptions", "Accounts", "Income", "Expenses", "Assets & debts"]
const byTabOrder = (tabs: string[]) => [...tabs].sort((a, b) => (TAB_ORDER.indexOf(a) + 1 || 99) - (TAB_ORDER.indexOf(b) + 1 || 99))

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

const ONLY_HERE = "Only on Milestones"

type EventFilter = "all" | "only"
const FILTERS: { value: EventFilter; label: string }[] = [
  { value: "all", label: "All events" },
  { value: "only", label: ONLY_HERE },
]

/** A compact event card for the Milestones picker: what it is, where else it's offered, and what it changes. */
function EventCard({ t, onPick }: { t: (typeof MILESTONE_TEMPLATES)[number]; onPick: () => void }) {
  const tab = EVENT_TABS[t.key]
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex items-start gap-2.5 rounded-xl border border-card-border p-2.5 text-left hover:border-primary hover:bg-primary/5 transition-colors"
    >
      <span className="material-symbols-rounded mt-0.5 shrink-0 text-primary" style={{ fontSize: 18 }} aria-hidden="true">
        {t.icon}
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block text-sm font-medium leading-tight text-foreground">{t.label}</span>
        <span className="block text-[11px] leading-snug text-foreground-muted">{t.creates}</span>
        <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-0.5">
          <span className="text-[10px] leading-snug text-foreground-muted">
            {t.changes.length > 0 && (
              <>
                <span className="font-medium text-foreground">Changes:</span> {byTabOrder(t.changes).join(" · ")}
              </>
            )}
          </span>
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-px text-[9px] font-medium whitespace-nowrap",
              tab ? "bg-foreground/5 text-foreground-muted" : "bg-primary/10 text-primary",
            )}
          >
            {tab ? `Also on ${tab}` : ONLY_HERE}
          </span>
        </span>
      </span>
    </button>
  )
}

function GroupedTemplates({ groups, onPick }: { groups: typeof FUTURE_EVENT_GROUPS; onPick: (key: TemplateKey) => void }) {
  const [filter, setFilter] = useState<EventFilter>("all")
  const shown = groups
    .map((g) => ({ ...g, keys: filter === "only" ? g.keys.filter((k) => !EVENT_TABS[k]) : g.keys }))
    .filter((g) => g.keys.length > 0)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-foreground-muted">Anything that will happen. Some can also be added from their own tab.</p>
        <ChoiceChips label="Show events" options={FILTERS} value={filter} onChange={setFilter} />
      </div>
      {shown.map((g) => (
        <div key={g.label} className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">{g.label}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {MILESTONE_TEMPLATES.filter((t) => g.keys.includes(t.key)).map((t) => (
              <EventCard key={t.key} t={t} onPick={() => onPick(t.key)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function TemplateGrid({ keys, instant, onPick }: { keys: TemplateKey[]; instant: InstantChoice[]; onPick: (key: TemplateKey) => void }) {
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
  // A child has more to it than a template form: the full kid pop-out (raising, college, 529, support).
  if (template === "child") return <ChildDialog doc={doc} update={update} onClose={onClose} />

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
