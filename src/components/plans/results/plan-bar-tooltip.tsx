"use client"

import { fmtMoney, fmtPct } from "@/components/fire/fire-helpers"

export interface TooltipSeries {
  key: string
  label: string
  color: string
  /** With subcategories on: the band this line rolls up into. */
  group?: { key: string; label: string; color: string }
}

type Row = { age: number; year: number } & Record<string, number>

function Item({ s, value, share, bold }: { s: Pick<TooltipSeries, "key" | "label" | "color">; value: number; share?: number; bold?: boolean }) {
  return (
    <p className={`flex items-center justify-between gap-4 ${bold ? "font-medium" : ""}`}>
      <span className={`inline-flex min-w-0 items-center gap-1.5 ${bold ? "text-foreground" : "text-foreground-muted"}`}>
        <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: s.color }} />
        <span className="truncate">{s.label}</span>
      </span>
      <span className="tabular-nums text-foreground">
        {fmtMoney(value)}
        {share !== undefined && <span className="ml-1.5 text-foreground-muted">{fmtPct(share, 0)}</span>}
      </span>
    </p>
  )
}

/**
 * Lines as plain items, or (with subcategories) rolled up under their band with its subtotal and share,
 * each line indented beneath it.
 */
function Lines({ list, row, sign = 1, shares }: { list: TooltipSeries[]; row: Row; sign?: 1 | -1; shares?: number }) {
  if (!list.some((s) => s.group)) {
    return <>{list.map((s) => <Item key={s.key} s={s} value={sign * row[s.key]} share={shares ? row[s.key] / shares : undefined} />)}</>
  }
  const groups = new Map<string, { head: NonNullable<TooltipSeries["group"]>; items: TooltipSeries[] }>()
  for (const s of list) {
    const head = s.group ?? { key: s.key, label: s.label, color: s.color }
    groups.set(head.key, { head, items: [...(groups.get(head.key)?.items ?? []), s] })
  }
  return (
    <>
      {[...groups.values()].map(({ head, items }) => {
        const total = items.reduce((t, s) => t + row[s.key], 0)
        return (
          <div key={head.key}>
            <Item s={{ key: head.key, label: head.label, color: head.color }} value={sign * total} share={shares ? total / shares : undefined} bold />
            {(items.length > 1 || items[0].label !== head.label) &&
              items.map((s) => (
                <p key={s.key} className="flex justify-between gap-4 pl-3.5 text-[11px] text-foreground-muted">
                  <span className="truncate">{s.label}</span>
                  <span className="tabular-nums">{fmtMoney(sign * row[s.key])}</span>
                </p>
              ))}
          </div>
        )
      })}
    </>
  )
}

function Total({ label, value, tone }: { label: string; value: number; tone?: "in" | "out" }) {
  return (
    <p className="flex justify-between gap-4 border-t border-card-border pt-1 font-semibold">
      <span className="text-foreground">{label}</span>
      <span className={`tabular-nums ${tone === "in" ? "text-success" : tone === "out" ? "text-error" : "text-foreground"}`}>
        {fmtMoney(value)}
      </span>
    </p>
  )
}

/** This year's loan payments split into principal and interest (skipped when the bars already show it per loan). */
function LoanSplit({ row, label }: { row: Row; label: string }) {
  const principal = row.loanPrincipal ?? 0
  const interest = row.loanInterest ?? 0
  if (principal + interest < 0.5) return null
  return (
    <div className="border-t border-card-border pt-1 text-[11px]">
      <p className="text-foreground-muted">{label}</p>
      <p className="flex justify-between gap-4 pl-3.5 text-foreground-muted">
        <span>Principal</span>
        <span className="tabular-nums text-foreground">{fmtMoney(principal)}</span>
      </p>
      <p className="flex justify-between gap-4 pl-3.5 text-foreground-muted">
        <span>Interest</span>
        <span className="tabular-nums text-foreground">{fmtMoney(interest)}</span>
      </p>
    </div>
  )
}

/** What a bar is made of, top layer first: net-worth layers with shares, or money in / out. */
export function PlanBarTooltip({
  active,
  payload,
  series,
  mode,
}: {
  active?: boolean
  payload?: Array<{ payload: Row }>
  series: TooltipSeries[]
  mode: "networth" | "accounts" | "cashflow" | "income" | "expenses" | "debt" | "taxes"
}) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  const present = series.filter((s) => Math.abs(row[s.key] ?? 0) >= 0.5)
  const positives = present.filter((s) => row[s.key] > 0).reverse()
  const negatives = present.filter((s) => row[s.key] < 0)
  const sum = (list: TooltipSeries[]) => list.reduce((t, s) => t + Math.abs(row[s.key]), 0)
  const loansSplitInBars = series.some((s) => s.key.startsWith("prin:"))
  return (
    <div className="w-64 space-y-1 rounded-lg border border-card-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground">
        Age {row.age} · {row.year}
      </p>
      {mode === "accounts" ? (
        <>
          <Lines list={positives} row={row} shares={sum(positives)} />
          <Total label="In accounts" value={sum(positives)} />
        </>
      ) : mode === "taxes" ? (
        <>
          <Lines list={positives} row={row} shares={sum(positives)} />
          <Total label="Taxes" value={sum(positives)} tone="out" />
        </>
      ) : mode === "income" ? (
        <>
          <Lines list={positives} row={row} shares={sum(positives)} />
          <Total label="Income" value={sum(positives)} tone="in" />
        </>
      ) : mode === "expenses" ? (
        <>
          <Lines list={positives} row={row} shares={sum(positives)} />
          <Total label="Spent" value={sum(positives)} tone="out" />
          {row.steady !== undefined && (
            <p className="flex justify-between gap-4 text-[11px] text-foreground-muted">
              <span>All steady (no patterns)</span>
              <span className="tabular-nums">{fmtMoney(row.steady)}</span>
            </p>
          )}
          {!loansSplitInBars && <LoanSplit row={row} label="Debt payments" />}
        </>
      ) : mode === "debt" ? (
        <>
          <Lines list={positives} row={row} shares={sum(positives)} />
          <Total label="Paid this year" value={sum(positives)} />
          <p className="flex justify-between gap-4 text-foreground-muted">
            <span>Still owed at year end</span>
            <span className="tabular-nums text-error">{fmtMoney(row.owed ?? 0)}</span>
          </p>
        </>
      ) : mode === "networth" ? (
        <>
          <Lines list={positives} row={row} shares={sum(positives)} />
          <Lines list={negatives} row={row} />
          <Total label="Net worth" value={row.netWorth} />
        </>
      ) : (
        <>
          <p className="pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">Money in</p>
          <Lines list={positives} row={row} />
          <Total label="Total in" value={sum(positives)} tone="in" />
          <p className="pt-1 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">Money out</p>
          <Lines list={negatives} row={row} sign={-1} />
          <Total label="Total out" value={sum(negatives)} tone="out" />
          {!loansSplitInBars && <LoanSplit row={row} label="Debt payments" />}
        </>
      )}
    </div>
  )
}
