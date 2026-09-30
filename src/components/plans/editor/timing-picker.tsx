"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import type { PlanDocument, Timing } from "@/lib/plans/plan-types"
import { primaryAge } from "../plans-helpers"

type TimingType = Timing["type"]

interface TimingPickerProps {
  label: string
  value: Timing
  doc: PlanDocument
  onChange: (value: Timing) => void
  /** Which ends make sense here, e.g. an end can't be "Now". */
  allow?: TimingType[]
}

const TYPE_LABELS: Record<TimingType, string> = {
  planStart: "Now",
  planEnd: "End of plan",
  age: "At age",
  year: "In year",
  milestone: "At milestone",
}

const FIELD_CLASS =
  "w-full rounded-lg border border-card-border bg-background text-sm text-foreground outline-none focus:border-primary"
const FIELD_STYLE = { padding: "6px 10px", fontSize: 14 } as const

function defaultFor(type: TimingType, doc: PlanDocument): Timing {
  const person = doc.people[0]
  switch (type) {
    case "planStart":
      return { type }
    case "planEnd":
      return { type }
    case "year":
      return { type, year: doc.settings.startYear + 5 }
    case "age":
      return { type, personId: person?.id ?? "", age: primaryAge(doc) + 5 }
    case "milestone":
      return { type, milestoneId: doc.milestones[0]?.id ?? "" }
  }
}

function TimingDetail({ value, doc, onChange }: { value: Timing; doc: PlanDocument; onChange: (v: Timing) => void }) {
  if (value.type === "year") {
    return <FireNumberField label="Year" value={value.year} min={1900} max={2200} onChange={(year) => onChange({ ...value, year })} />
  }
  if (value.type === "age") {
    return (
      <div className="flex gap-2 items-end">
        {doc.people.length > 1 && (
          <select
            aria-label="Person"
            value={value.personId}
            onChange={(e) => onChange({ ...value, personId: e.target.value })}
            className={FIELD_CLASS}
            style={FIELD_STYLE}
          >
            {doc.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <FireNumberField label="Age" value={value.age} min={0} max={120} onChange={(age) => onChange({ ...value, age })} />
      </div>
    )
  }
  if (value.type === "milestone") {
    return (
      <label className="block">
        <span className="block text-[11px] font-medium text-foreground-muted mb-1">Milestone</span>
        <select
          value={value.milestoneId}
          onChange={(e) => onChange({ ...value, milestoneId: e.target.value })}
          className={FIELD_CLASS}
          style={FIELD_STYLE}
        >
          {doc.milestones.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
    )
  }
  return null
}

/** Pick when something starts or ends: now, end of plan, an age, a year, or a milestone. */
export function TimingPicker({ label, value, doc, onChange, allow }: TimingPickerProps) {
  const types = (allow ?? (Object.keys(TYPE_LABELS) as TimingType[])).filter(
    (t) => t !== "milestone" || doc.milestones.length > 0,
  )
  return (
    <div className="space-y-2">
      <label className="block">
        <span className="block text-[11px] font-medium text-foreground-muted mb-1">{label}</span>
        <select
          value={value.type}
          onChange={(e) => onChange(defaultFor(e.target.value as TimingType, doc))}
          className={FIELD_CLASS}
          style={FIELD_STYLE}
        >
          {types.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>
      <TimingDetail value={value} doc={doc} onChange={onChange} />
    </div>
  )
}
