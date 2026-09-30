"use client"

import { fmtMoney, fmtPct } from "@/components/fire/fire-helpers"

export interface TooltipSeries {
  key: string
  label: string
  color: string
}

type Row = { age: number; year: number } & Record<string, number>

function Item({ s, value, share }: { s: TooltipSeries; value: number; share?: number }) {
  return (
    <p className="flex items-center justify-between gap-4">
      <span className="inline-flex min-w-0 items-center gap-1.5 text-foreground-muted">
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
  mode: "networth" | "cashflow"
}) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  const present = series.filter((s) => Math.abs(row[s.key] ?? 0) >= 0.5)
  const positives = present.filter((s) => row[s.key] > 0).reverse()
  const negatives = present.filter((s) => row[s.key] < 0)
  const sum = (list: TooltipSeries[]) => list.reduce((t, s) => t + Math.abs(row[s.key]), 0)
  return (
    <div className="w-64 space-y-1 rounded-lg border border-card-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground">
        Age {row.age} · {row.year}
      </p>
      {mode === "networth" ? (
        <>
          {positives.map((s) => (
            <Item key={s.key} s={s} value={row[s.key]} share={row[s.key] / sum(positives)} />
          ))}
          {negatives.map((s) => (
            <Item key={s.key} s={s} value={row[s.key]} />
          ))}
          <Total label="Net worth" value={row.netWorth} />
        </>
      ) : (
        <>
          <p className="pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">Money in</p>
          {positives.map((s) => (
            <Item key={s.key} s={s} value={row[s.key]} />
          ))}
          <Total label="Total in" value={sum(positives)} tone="in" />
          <p className="pt-1 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">Money out</p>
          {negatives.map((s) => (
            <Item key={s.key} s={s} value={-row[s.key]} />
          ))}
          <Total label="Total out" value={sum(negatives)} tone="out" />
        </>
      )}
    </div>
  )
}
