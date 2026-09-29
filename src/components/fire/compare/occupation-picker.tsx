"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import occupationsJson from "@/lib/fire/data/acs-occupations.json"

export interface Occupation {
  title: string
  soc: string | null
  median: number
}

export const OCCUPATIONS = (occupationsJson as { occupations: Occupation[] }).occupations

export function occupationBySoc(soc: string | null): Occupation | null {
  return soc ? OCCUPATIONS.find((o) => o.soc === soc) ?? null : null
}

const MAX_RESULTS = 8

/** Type-ahead over ~565 Census detailed occupations. */
export function OccupationPicker({ value, onChange }: { value: string | null; onChange: (soc: string | null) => void }) {
  const selected = occupationBySoc(value)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return OCCUPATIONS.filter((o) => o.soc && o.title.toLowerCase().includes(q)).slice(0, MAX_RESULTS)
  }, [query])

  return (
    <div className="relative">
      <span className="block text-[11px] font-medium text-foreground-muted mb-1">Occupation</span>
      <input
        value={open ? query : selected?.title ?? query}
        placeholder="Search, e.g. software developer"
        onFocus={() => {
          setOpen(true)
          setQuery("")
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-lg border border-card-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full rounded-lg border border-card-border bg-card shadow-lg max-h-64 overflow-auto">
          {matches.map((o) => (
            <li key={o.soc}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(o.soc)
                  setOpen(false)
                }}
                className={cn("w-full text-left px-3 py-2 text-sm hover:bg-foreground/5", o.soc === value && "text-primary")}
              >
                {o.title}
              </button>
            </li>
          ))}
        </ul>
      )}
      {value && !open && (
        <button type="button" onClick={() => onChange(null)} className="text-[10px] text-foreground-muted hover:text-foreground mt-1">
          clear
        </button>
      )}
    </div>
  )
}
