"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { ChartViewToggle } from "@/components/ui/chart-view-toggle"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { usePlanMode } from "@/hooks/plans/use-plan-mode"
import { childExpenses } from "@/lib/plans/plan-children"
import { assetCostLines, type AssetCostLine } from "@/lib/plans/plan-asset-costs"
import { overlapWarning, retirementAge } from "@/lib/plans/plan-spending-patterns"
import type { PlanExpense } from "@/lib/plans/plan-types"
import { patchItem, planItemAnchor, primaryAge, type PlanEditorProps } from "../plans-helpers"
import { PatternChips } from "./expense-pattern-field"
import { Cell, CellCheck, CellNumber, CellSelect, CellText, GroupRow, PlanTable, Row, RowButton } from "./plan-table"
import { TimingCell } from "./timing-cell"
import { AssetCostRows } from "./asset-cost-rows"
import { CategoryCell, CategoryIcon } from "./category-cell"
import { NO_CATEGORY, useExpenseCategoryOptions } from "./use-expense-categories"

const MONTHS = 12

type SortKey = "name" | "category" | "amount"
type Sort = { key: SortKey; dir: "asc" | "desc" } | null

/** Clicking a sortable header: amounts start highest first, names A–Z; a third click goes back to your order. */
function nextSort(current: Sort, key: SortKey): Sort {
  const first = key === "amount" ? "desc" : "asc"
  if (current?.key !== key) return { key, dir: first }
  return current.dir === first ? { key, dir: first === "asc" ? "desc" : "asc" } : null
}

/**
 * Sorted for display only (the saved order is untouched). By amount, one-time costs follow the recurring lines; by
 * category, lines without one come last and each category's lines stay in your order.
 */
function sorted(expenses: PlanExpense[], sort: Sort): PlanExpense[] {
  if (!sort) return expenses
  const sign = sort.dir === "asc" ? 1 : -1
  return [...expenses].sort((a, b) => {
    if (sort.key === "name") return sign * a.name.localeCompare(b.name)
    if (sort.key === "category") {
      if ((a.category === null) !== (b.category === null)) return a.category === null ? 1 : -1
      return sign * (a.category ?? "").localeCompare(b.category ?? "")
    }
    if (a.oneTime !== b.oneTime) return a.oneTime ? 1 : -1
    return sign * (a.amount - b.amount)
  })
}

/** Basic leaves out "As you age" (spending patterns) and "Grows / yr". */
function columns(sort: Sort, setSort: (s: Sort) => void, basic: boolean) {
  const by = (key: SortKey) => ({ sort: sort?.key === key ? sort.dir : null, onSort: () => setSort(nextSort(sort, key)) })
  const all = [
    { label: "Expense", ...by("name") },
    { label: "Category", width: "w-40", ...by("category") },
    { label: "As you age", width: "w-[27rem]", advanced: true },
    { label: "Per month", align: "right" as const, width: "w-28", ...by("amount") },
    { label: "Per year", align: "right" as const, width: "w-32", ...by("amount") },
    { label: "Grows / yr", align: "right" as const, width: "w-28", advanced: true },
    { label: "Starts", width: "w-32" },
    { label: "Stops", width: "w-32" },
    { label: "Once", align: "center" as const, width: "w-14" },
    { label: "", width: "w-16" },
  ]
  return basic ? all.filter((c) => !c.advanced) : all
}

const Dash = () => <span className="px-2 text-foreground-muted">—</span>

const sum = (amounts: number[]) => amounts.reduce((s, a) => s + a, 0)

type GroupBy = "type" | "category" | "none"

const GROUP_BY_VIEWS = [
  { key: "type", label: "Type" },
  { key: "category", label: "Category" },
  { key: "none", label: "None" },
] as const

const GROUP_BY_KEY = "plan-expenses-group-by"

/** How the table groups its lines: by Type until you switch, then remembered in this browser. */
function useGroupBy(): [GroupBy, (groupBy: GroupBy) => void] {
  const [groupBy, setGroupBy] = useState<GroupBy>("type")
  useEffect(() => {
    try {
      const saved = localStorage.getItem(GROUP_BY_KEY)
      if (GROUP_BY_VIEWS.some((v) => v.key === saved)) setGroupBy(saved as GroupBy)
    } catch {
      // Storage can be unavailable (private mode); the default still works.
    }
  }, [])
  const change = (next: GroupBy) => {
    setGroupBy(next)
    try {
      localStorage.setItem(GROUP_BY_KEY, next)
    } catch {
      // Not remembered; the choice still applies for this visit.
    }
  }
  return [groupBy, change]
}

type KidLine = { expense: PlanExpense; childId: string }

/** A run of lines under one heading (none for the ungrouped view): your own lines, then kids', then home & vehicle. */
interface Section {
  key: string
  label: string | null
  category?: string | null
  own: PlanExpense[]
  kids: KidLine[]
  assets: AssetCostLine[]
}

/** Type: lifestyle, one-time, kids, home & vehicle. Category: one section per category (A–Z, none last). */
function sections(groupBy: GroupBy, own: PlanExpense[], kids: KidLine[], assets: AssetCostLine[]): Section[] {
  if (groupBy === "none") return [{ key: "all", label: null, own, kids, assets }]
  if (groupBy === "type") {
    return [
      { key: "lifestyle", label: "Lifestyle", own: own.filter((e) => !e.oneTime), kids: [], assets: [] },
      { key: "one-time", label: "One-time", own: own.filter((e) => e.oneTime), kids: [], assets: [] },
      { key: "kids", label: "Kids", own: [], kids, assets: [] },
      { key: "assets", label: "Home & vehicle", own: [], kids: [], assets },
    ]
  }
  const names = [...new Set([...own, ...kids.map((k) => k.expense), ...assets.map((a) => a.expense)].map((e) => e.category))]
  names.sort((a, b) => (a === null ? 1 : b === null ? -1 : a.localeCompare(b)))
  return names.map((category) => ({
    key: category ?? "none",
    label: category ?? "No category",
    category,
    own: own.filter((e) => e.category === category),
    kids: kids.filter((k) => k.expense.category === category),
    assets: assets.filter((a) => a.expense.category === category),
  }))
}

/**
 * A section's heading row, lined up with the columns: its recurring total under Per month / Per year. A section of
 * only one-time costs shows their total under Per year instead.
 */
function SectionHeading({ section, basic }: { section: Section; basic: boolean }) {
  const { label, own, kids, assets } = section
  const count = own.length + kids.length + assets.length
  if (!label || count === 0) return null
  const lines = [...own, ...kids.map((k) => k.expense)]
  const recurring = sum(lines.filter((e) => !e.oneTime).map((e) => e.amount)) + sum(assets.map((a) => a.yearly))
  const oneTime = sum(lines.filter((e) => e.oneTime).map((e) => e.amount))
  const onlyOneTime = recurring === 0 && oneTime > 0
  return (
    <GroupRow label={label} count={count} leading={section.category !== undefined ? <CategoryIcon category={section.category} /> : undefined}>
      <td colSpan={basic ? 1 : 2} />
      <td className="px-2 pb-1.5 pt-3 text-right tabular-nums">{onlyOneTime ? "" : fmtMoney(recurring / MONTHS)}</td>
      <td className="px-2 pb-1.5 pt-3 text-right tabular-nums" title={!onlyOneTime && oneTime > 0 ? `Plus ${fmtMoney(oneTime)} one-time` : undefined}>
        {fmtMoney(onlyOneTime ? oneTime : recurring)}
      </td>
      <td colSpan={basic ? 4 : 5} />
    </GroupRow>
  )
}

/**
 * Expenses as an editable table, with kids' and home & vehicle generated lines shown read-only. Grouped by type
 * (lifestyle, one-time, kids, home & vehicle), by category, or not at all; sorting applies within each group.
 */
export function ExpensesTable({ doc, update, onEditItem, onEditChild }: PlanEditorProps & { onEditChild: (childId: string) => void }) {
  const patch = (id: string, change: Partial<PlanExpense>) => update((d) => ({ ...d, expenses: patchItem(d.expenses, id, change) }))
  const kidLines = (doc.children ?? []).flatMap((child) =>
    childExpenses({ ...doc, children: [child] }).map((expense) => ({ expense, childId: child.id })),
  )
  const ages = useMemo(() => ({ now: primaryAge(doc), retire: retirementAge(doc) }), [doc])
  const assetLines = useMemo(() => assetCostLines(doc), [doc])
  const [sort, setSort] = useState<Sort>(null)
  const [groupBy, setGroupBy] = useGroupBy()
  const { isBasic } = usePlanMode()
  const categoryOptions = useExpenseCategoryOptions()
  const today = doc.expenses.filter((e) => !e.oneTime && e.start.type === "planStart").reduce((s, e) => s + e.amount, 0)
  const expenseRow = (e: PlanExpense) => (
    <Row key={e.id}>
      <Cell>
        <CellText label="Expense name" value={e.name} onChange={(name) => patch(e.id, { name })} />
      </Cell>
      <Cell>
        <CategoryCell category={e.category}>
          <CellSelect
            label={`Category of ${e.name}`}
            value={e.category ?? NO_CATEGORY}
            options={categoryOptions(e.category)}
            onChange={(v) => patch(e.id, { category: v === NO_CATEGORY ? null : v })}
          />
        </CategoryCell>
      </Cell>
      <Cell omit={isBasic}>
        {e.oneTime ? (
          <Dash />
        ) : (
          <span className="block px-2">
            <PatternChips pattern={e.pattern} onChange={(pattern) => patch(e.id, { pattern })} fromAge={ages.now} retireAge={ages.retire} nowrap warning={overlapWarning(e, doc.settings.inflation)} />
          </span>
        )}
      </Cell>
      <Cell align="right">
        {e.oneTime ? (
          <Dash />
        ) : (
          <CellNumber label="Per month" prefix="$" min={0} value={e.amount / MONTHS} onChange={(monthly) => patch(e.id, { amount: monthly * MONTHS })} />
        )}
      </Cell>
      <Cell align="right">
        <CellNumber label={e.oneTime ? "Amount" : "Per year"} prefix="$" min={0} value={e.amount} onChange={(amount) => patch(e.id, { amount })} />
      </Cell>
      <Cell align="right" omit={isBasic}>
        <CellNumber
          label="Growth"
          suffix={e.growth === null ? "% infl." : "%"}
          scale={100}
          min={-0.5}
          max={1}
          value={e.growth ?? doc.settings.inflation}
          onChange={(growth) => patch(e.id, { growth })}
        />
      </Cell>
      <Cell>
        <TimingCell timing={e.start} doc={doc} />
      </Cell>
      <Cell>{e.oneTime ? <Dash /> : <TimingCell timing={e.end} doc={doc} />}</Cell>
      <Cell align="center">
        <CellCheck label="One-time" checked={e.oneTime} onChange={(oneTime) => patch(e.id, { oneTime })} />
      </Cell>
      <Cell align="center">
        <span className="flex">
          <RowButton icon="edit" label={`Edit ${e.name} in detailed view`} onClick={() => onEditItem?.(planItemAnchor(e.id))} />
          <RowButton
            icon="delete"
            label={`Remove ${e.name}`}
            danger
            onClick={() => update((d) => ({ ...d, expenses: d.expenses.filter((x) => x.id !== e.id) }))}
          />
        </span>
      </Cell>
    </Row>
  )
  const kidRow = ({ expense: e, childId }: KidLine) => (
    <Row key={e.id} muted>
      <Cell>
        <span className="px-2">{e.name}</span>
      </Cell>
      <Cell>
        <CategoryCell category={e.category} />
      </Cell>
      <Cell omit={isBasic} />
      <Cell align="right">
        <span className="px-2 tabular-nums">{fmtMoney(e.amount / MONTHS)}</span>
      </Cell>
      <Cell align="right">
        <span className="px-2 tabular-nums">{fmtMoney(e.amount)}</span>
      </Cell>
      <Cell align="right" omit={isBasic}>
        <span className="px-2 tabular-nums">{e.growth === null ? "infl." : `${(e.growth * 100).toFixed(1)}%`}</span>
      </Cell>
      <Cell>
        <TimingCell timing={e.start} doc={doc} />
      </Cell>
      <Cell>
        <TimingCell timing={e.end} doc={doc} />
      </Cell>
      <Cell />
      <Cell align="center">
        <RowButton icon="edit" label="Edit this child" onClick={() => onEditChild(childId)} />
      </Cell>
    </Row>
  )
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-foreground-muted">Group by</span>
        <ChartViewToggle views={GROUP_BY_VIEWS} view={groupBy} onChange={setGroupBy} />
      </div>
      <PlanTable
        columns={columns(sort, setSort, isBasic)}
        minWidth={isBasic ? "min-w-[640px]" : "min-w-[1080px]"}
        footer={
          <tr>
            <td className="px-2 py-2" colSpan={2}>
              Spending today (excl. kids, home &amp; vehicle)
            </td>
            {!isBasic && <td />}
            <td className="px-2 py-2 text-right tabular-nums">{fmtMoney(today / MONTHS)}</td>
            <td className="px-2 py-2 text-right tabular-nums">{fmtMoney(today)}</td>
            <td colSpan={isBasic ? 4 : 5} />
          </tr>
        }
      >
        {sections(groupBy, doc.expenses, kidLines, assetLines).map((section) => (
          <Fragment key={section.key}>
            <SectionHeading section={section} basic={isBasic} />
            {sorted(section.own, sort).map(expenseRow)}
            {section.kids.map(kidRow)}
            <AssetCostRows lines={section.assets} doc={doc} />
          </Fragment>
        ))}
      </PlanTable>
    </div>
  )
}
