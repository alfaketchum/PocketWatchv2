"use client"

import type { ReactNode } from "react"
import { useExpenseCategoryStyle } from "./use-expense-categories"

/** A category's icon in its color (as in Add expense); a faint generic one for no category. */
export function CategoryIcon({ category }: { category: string | null }) {
  const style = useExpenseCategoryStyle()(category)
  return (
    <span
      className="material-symbols-rounded shrink-0"
      style={{ fontSize: 16, color: style?.hex ?? "var(--foreground-muted)", opacity: style ? 1 : 0.4 }}
      aria-hidden="true"
    >
      {style?.icon ?? "category"}
    </span>
  )
}

/** A category in the Expenses table, led by its icon. `children` replaces the label (the editable select). */
export function CategoryCell({ category, children }: { category: string | null; children?: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-1 pl-2">
      <CategoryIcon category={category} />
      {children ?? <span className={category ? "min-w-0 truncate px-2" : "px-2 text-foreground-muted"}>{category ?? "—"}</span>}
    </span>
  )
}
