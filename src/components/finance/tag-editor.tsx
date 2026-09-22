"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { SUGGESTED_TAGS, MANAGED_TAGS, isSuggestedTag, isManagedTag } from "@/lib/finance/tags"

interface TagEditorProps {
  tags: string[]
  onSave: (tags: string[]) => void
}

/** Tag pop-out — predefined toggle chips (card payments, business exp) plus
 *  removable custom chips + a free-text add input. Managed tags (subscription)
 *  render read-only, since a dedicated control owns them. Tags are lowercased.
 *  Shared by the budget and transactions views. */
export function TagEditor({ tags, onSave }: TagEditorProps) {
  const [input, setInput] = useState("")

  const toggle = (t: string) =>
    onSave(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])
  const add = () => {
    const t = input.trim().toLowerCase()
    if (t && !tags.includes(t)) onSave([...tags, t])
    setInput("")
  }
  const remove = (t: string) => onSave(tags.filter((x) => x !== t))

  const managed = tags.filter(isManagedTag)
  const custom = tags.filter((t) => !isSuggestedTag(t) && !isManagedTag(t))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTED_TAGS.map((s) => {
          const active = tags.includes(s.value)
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => toggle(s.value)}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-1 rounded-full text-[11px] font-medium px-2 py-0.5 border transition-colors",
                active
                  ? "bg-primary-muted text-primary border-primary/30"
                  : "border-card-border text-foreground-muted hover:text-foreground hover:bg-background-secondary",
              )}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 12 }} aria-hidden="true">{active ? "check" : s.icon}</span>
              {s.label}
            </button>
          )
        })}
      </div>

      {managed.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {managed.map((t) => {
            const m = MANAGED_TAGS[t]
            return (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary-muted text-primary text-[11px] font-medium px-2 py-0.5" title="Managed by the Mark-as-subscription action">
                <span className="material-symbols-rounded" style={{ fontSize: 12 }} aria-hidden="true">{m.icon}</span>
                {m.label}
              </span>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {custom.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-background-secondary text-foreground text-[11px] font-medium pl-2 pr-1 py-0.5">
            {t}
            <button type="button" onClick={() => remove(t)} className="inline-flex text-foreground-muted hover:text-foreground" aria-label={`Remove tag ${t}`}>
              <span className="material-symbols-rounded" style={{ fontSize: 12 }} aria-hidden="true">close</span>
            </button>
          </span>
        ))}
        <form onSubmit={(e) => { e.preventDefault(); add() }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onBlur={add}
            placeholder="Add tag…"
            className="w-24 bg-background border border-card-border rounded-full px-2.5 py-0.5 text-[11px] text-foreground placeholder-foreground-muted focus:border-primary focus:outline-none"
          />
        </form>
      </div>
    </div>
  )
}
