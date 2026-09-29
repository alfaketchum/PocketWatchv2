"use client"

import { useState } from "react"
import { getCategoryMeta } from "@/lib/finance/categories"
import { getLifestyleCategories } from "@/lib/finance/budget-builder-config"
import { formatCurrency } from "@/lib/utils"
import { WorkshopCategoryPicker } from "@/components/finance/budget-workshop/workshop-category-picker"
import { BudgetBuilderSummaryBar } from "./budget-builder-summary-bar"
import { addLine, draftTotal, removeLine, updateLine } from "./budget-builder-helpers"
import type { CategoryStats, DraftLine } from "./budget-builder-types"

interface BudgetBuilderManualEditorProps {
  /** Complete months the averages cover. */
  months: number
  lines: DraftLine[]
  onChange: (lines: DraftLine[]) => void
  stats: Map<string, CategoryStats>
  typicalSpend: number
  steadyIncome: number | null
  /** Fill in suggested amounts for categories with spending that aren't budgeted yet. */
  onFillSuggestions: () => void
}

/** Category-by-category amounts, with averages as a guide. */
export function BudgetBuilderManualEditor({ months, lines, onChange, stats, typicalSpend, steadyIncome, onFillSuggestions }: BudgetBuilderManualEditorProps) {
  const [picking, setPicking] = useState(lines.length === 0)
  const available = getLifestyleCategories().filter((c) => !lines.some((l) => l.category === c))

  return (
    <div className="space-y-4">
      <BudgetBuilderSummaryBar total={draftTotal(lines)} typicalSpend={typicalSpend} steadyIncome={steadyIncome} />

      <div className="rounded-2xl border border-card-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-card-border/50">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">{lines.length} categories</p>
          <div className="flex items-center gap-3">
            <button onClick={onFillSuggestions} className="text-xs font-medium text-foreground-muted hover:text-foreground">
              Fill from my spending
            </button>
            <button onClick={() => setPicking((p) => !p)} className="text-xs font-medium text-primary hover:underline">
              {picking ? "Done adding" : "Add category"}
            </button>
          </div>
        </div>

        {picking && available.length > 0 && (
          <WorkshopCategoryPicker categories={available} onAdd={(c) => onChange(addLine(lines, c, stats))} />
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-foreground-muted">
                <th className="text-left font-semibold px-4 py-2">Category</th>
                <th className="text-right font-semibold px-3 py-2">{months}-mo avg</th>
                <th className="text-right font-semibold px-3 py-2">Last month</th>
                <th className="text-right font-semibold px-3 py-2">Budget</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const meta = getCategoryMeta(l.category)
                return (
                  <tr key={l.category} className="border-t border-card-border/50">
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: 16, color: meta.hex }} aria-hidden="true">{meta.icon}</span>
                        <span className="truncate text-foreground">{l.category}</span>
                      </span>
                      {l.reason && <p className="text-[10px] text-foreground-muted mt-0.5 ml-6 leading-snug max-w-[320px]">{l.reason}</p>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <button
                        onClick={() => onChange(updateLine(lines, l.category, { amount: Math.round(l.avgMonthly) }))}
                        className="text-foreground-muted hover:text-primary"
                        title="Use your average"
                      >
                        {formatCurrency(l.avgMonthly, "USD", 0)}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground-muted">{formatCurrency(l.lastMonth, "USD", 0)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className="relative inline-flex items-center">
                        <span className="absolute left-2 text-xs text-foreground-muted">$</span>
                        <input
                          type="number"
                          min={0}
                          step={10}
                          value={Math.round(l.amount) || ""}
                          placeholder="0"
                          onChange={(e) => onChange(updateLine(lines, l.category, { amount: Math.max(0, Number(e.target.value) || 0) }))}
                          aria-label={`${l.category} monthly budget`}
                          className="w-24 pl-5 pr-2 py-1 text-right tabular-nums bg-background-secondary border border-card-border rounded-lg text-foreground outline-none focus:border-primary"
                        />
                      </span>
                    </td>
                    <td className="pr-2">
                      <button onClick={() => onChange(removeLine(lines, l.category))} className="touch-target rounded-md text-foreground-muted hover:text-error transition-colors" aria-label={`Remove ${l.category}`}>
                        <span className="material-symbols-rounded" style={{ fontSize: 16 }} aria-hidden="true">close</span>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {lines.length === 0 && (
            <p className="text-sm text-foreground-muted py-8 text-center">Add a category to start, or fill from your spending.</p>
          )}
        </div>
      </div>
    </div>
  )
}
