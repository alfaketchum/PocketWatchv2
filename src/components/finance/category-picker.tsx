"use client"

import { useState, useRef, useEffect, useLayoutEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { CATEGORY_GROUPS, getCategoryMeta } from "@/lib/finance/categories"
import { CATEGORIES } from "@/lib/finance/category-types"

const PANEL_WIDTH = 600
const MARGIN = 8

interface CategoryPickerProps {
  value: string | null
  /** subcategory is supplied from the second step (a listed one, a typed one, or null). */
  onSelect: (category: string, subcategory?: string | null) => void
  align?: "left" | "right"
}

const SUBCATEGORIES = CATEGORIES as Record<string, readonly string[]>

interface PanelPos { left: number; top: number | null; bottom: number | null; width: number; maxH: number }

/**
 * Two-step inline picker (category → subcategory). Rendered in a portal with
 * fixed positioning so it never gets clipped by an `overflow-hidden` table/card,
 * and it flips above the trigger + caps its height to the available space.
 */
export function CategoryPicker({ value, onSelect, align = "left" }: CategoryPickerProps) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [pickedCat, setPickedCat] = useState<string | null>(null)
  const [customSub, setCustomSub] = useState("")
  const [pos, setPos] = useState<PanelPos | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const close = () => { setOpen(false); setQ(""); setPickedCat(null); setCustomSub("") }

  const computePos = () => {
    const btn = btnRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const width = Math.min(PANEL_WIDTH, vw - MARGIN * 2)
    let left = align === "right" ? r.right - width : r.left
    left = Math.max(MARGIN, Math.min(left, vw - width - MARGIN))
    const spaceBelow = vh - r.bottom - MARGIN
    const spaceAbove = r.top - MARGIN
    const openUp = spaceBelow < 320 && spaceAbove > spaceBelow
    setPos(openUp
      ? { left, top: null, bottom: vh - r.top + 4, width, maxH: spaceAbove - 4 }
      : { left, top: r.bottom + 4, bottom: null, width, maxH: spaceBelow - 4 })
  }

  useLayoutEffect(() => { if (open) computePos() }, [open, pickedCat]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return
      if (panelRef.current?.contains(e.target as Node)) return
      close()
    }
    const reflow = () => computePos()
    document.addEventListener("mousedown", onDown)
    window.addEventListener("resize", reflow)
    window.addEventListener("scroll", reflow, true)
    return () => {
      document.removeEventListener("mousedown", onDown)
      window.removeEventListener("resize", reflow)
      window.removeEventListener("scroll", reflow, true)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const query = q.trim().toLowerCase()
    return CATEGORY_GROUPS
      .map((g) => ({ ...g, categories: query ? g.categories.filter((c) => c.toLowerCase().includes(query)) : g.categories }))
      .filter((g) => g.categories.length > 0)
  }, [q])

  const subs = pickedCat ? (SUBCATEGORIES[pickedCat] ?? []) : []

  const chooseCategory = (cat: string) => {
    if ((SUBCATEGORIES[cat] ?? []).length > 0) { setPickedCat(cat); setQ(""); setCustomSub("") }
    else { onSelect(cat, null); close() }
  }
  const chooseSub = (sub: string | null) => { if (pickedCat) onSelect(pickedCat, sub); close() }

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        className={cn(
          "inline-flex items-center justify-center w-6 h-6 rounded-md transition-colors",
          open ? "text-primary bg-primary-muted" : "text-foreground-muted/70 hover:text-foreground hover:bg-background-secondary",
        )}
        title="Re-categorize"
        aria-label="Re-categorize"
      >
        <span className="material-symbols-rounded" style={{ fontSize: 14 }} aria-hidden="true">edit</span>
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            left: pos.left,
            top: pos.top ?? undefined,
            bottom: pos.bottom ?? undefined,
            width: pos.width,
            maxHeight: pos.maxH,
          }}
          className="z-[9999] flex flex-col bg-card border border-card-border rounded-xl shadow-xl p-3 animate-in fade-in duration-150"
        >
          {!pickedCat ? (
            <>
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search categories..."
                className="w-full flex-shrink-0 bg-background border border-card-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-foreground-muted mb-2.5 focus:border-primary focus:outline-none"
              />
              <div className="flex-1 min-h-0 overflow-y-auto scroll-touch">
                {groups.length === 0 ? (
                  <p className="text-sm text-foreground-muted text-center py-3">No matches</p>
                ) : groups.map((g) => (
                  <div key={g.label} className="mb-2">
                    <div className="flex items-center gap-1.5 px-1.5 py-1">
                      <span className="material-symbols-rounded text-foreground-muted/70" style={{ fontSize: 13 }} aria-hidden="true">{g.icon}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">{g.label}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {g.categories.map((cat) => {
                        const cm = getCategoryMeta(cat)
                        const sel = cat === value
                        const hasSubs = (SUBCATEGORIES[cat] ?? []).length > 0
                        return (
                          <button
                            key={cat}
                            onClick={() => chooseCategory(cat)}
                            className={cn("flex items-center gap-2 px-2 py-2 rounded-md text-left transition-colors border", sel ? "bg-primary-muted border-primary/30" : "border-card-border hover:bg-background-secondary")}
                          >
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cm.hex }} />
                            <span className={cn("text-sm truncate flex-1", sel ? "text-primary font-medium" : "text-foreground")}>{cat}</span>
                            {hasSubs && <span className="material-symbols-rounded text-foreground-muted/50 flex-shrink-0" style={{ fontSize: 14 }} aria-hidden="true">chevron_right</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => { setPickedCat(null); setCustomSub("") }}
                className="w-full flex-shrink-0 flex items-center gap-1 px-1.5 py-1 mb-1 text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                <span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: 15 }} aria-hidden="true">chevron_left</span>
                <span className="truncate">{pickedCat}</span>
              </button>
              <p className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted px-1.5 pb-1">Subcategory</p>
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scroll-touch">
                <div className="grid grid-cols-2 gap-1">
                  {subs.map((sub) => (
                    <button
                      key={sub}
                      onClick={() => chooseSub(sub)}
                      className="px-3 py-2 rounded-md text-left text-sm text-foreground border border-card-border hover:bg-background-secondary transition-colors truncate"
                    >
                      {sub}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => chooseSub(null)}
                  className="w-full mt-1 px-3 py-2 rounded-md text-left text-sm text-foreground-muted italic hover:bg-background-secondary transition-colors"
                >
                  No subcategory
                </button>
              </div>
              <form
                onSubmit={(e) => { e.preventDefault(); const v = customSub.trim(); if (v) chooseSub(v) }}
                className="flex-shrink-0 mt-2 flex items-center gap-1.5"
              >
                <input
                  value={customSub}
                  onChange={(e) => setCustomSub(e.target.value)}
                  placeholder="Custom…"
                  className="flex-1 min-w-0 bg-background border border-card-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-foreground-muted focus:border-primary focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!customSub.trim()}
                  className="px-3 py-2 text-sm font-medium rounded-lg bg-primary text-white disabled:opacity-40 hover:bg-primary/90 transition-colors"
                >
                  Set
                </button>
              </form>
            </>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
