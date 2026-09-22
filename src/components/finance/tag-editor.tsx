"use client"

import { useState } from "react"

interface TagEditorProps {
  tags: string[]
  onSave: (tags: string[]) => void
}

/** Inline tag editor — removable chips + an add input. Tags are lowercased. */
export function TagEditor({ tags, onSave }: TagEditorProps) {
  const [input, setInput] = useState("")

  const add = () => {
    const t = input.trim().toLowerCase()
    if (t && !tags.includes(t)) onSave([...tags, t])
    setInput("")
  }
  const remove = (t: string) => onSave(tags.filter((x) => x !== t))

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary-muted text-primary text-[11px] font-medium pl-2 pr-1 py-0.5">
          {t}
          <button type="button" onClick={() => remove(t)} className="inline-flex hover:text-primary-hover" aria-label={`Remove tag ${t}`}>
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
  )
}
