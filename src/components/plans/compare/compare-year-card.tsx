"use client"

import { fmtCompact } from "@/components/fire/fire-helpers"
import type { ChartMode, ChartRow, Series } from "../results/use-chart-series"
import { tone } from "./compare-helpers"

/** Bands listed, largest difference first. */
const MAX_LINES = 8

const TOTAL_LABEL: Record<ChartMode, string> = {
  networth: "Net worth",
  accounts: "In accounts",
  income: "Income",
  expenses: "Spent",
  taxes: "Taxes",
  debt: "Paid",
  cashflow: "Money in",
}

interface Line {
  key: string
  label: string
  color: string
  a: number
  b: number
}

/** Each band's A and B values (subcategories rolled up into their band). */
function bandLines(series: Series[], a: ChartRow, b: ChartRow): Line[] {
  const bands = new Map<string, Line>()
  for (const s of series) {
    const head = s.group ?? { key: s.key, label: s.label, color: s.color }
    const cur = bands.get(head.key) ?? { ...head, a: 0, b: 0 }
    bands.set(head.key, { ...cur, a: cur.a + (a[s.key] ?? 0), b: cur.b + (b[s.key] ?? 0) })
  }
  return [...bands.values()].filter((l) => Math.abs(l.a) >= 0.5 || Math.abs(l.b) >= 0.5)
}

function total(mode: ChartMode, lines: Line[], side: "a" | "b"): number {
  // Money in and out balance each year, so the cash flow total is what came in.
  return lines.reduce((t, l) => t + (mode === "cashflow" ? Math.max(0, l[side]) : l[side]), 0)
}

function Delta({ mode, value }: { mode: ChartMode; value: number }) {
  if (Math.abs(value) < 0.5) return <span className="text-foreground-muted">—</span>
  const t = tone(mode, value)
  const color = t > 0 ? "text-success" : t < 0 ? "text-error" : "text-foreground"
  return <span className={color}>{`${value > 0 ? "+" : "−"}${fmtCompact(Math.abs(value))}`}</span>
}

interface Props {
  a: ChartRow
  b: ChartRow
  inBoth: boolean
  series: Series[]
  mode: ChartMode
  colors: [string, string]
  pinned: boolean
  onUnpin: () => void
  isHidden: boolean
}

/** The highlighted year: each band in A and B and the difference, biggest first. */
export function CompareYearCard({ a, b, inBoth, series, mode, colors, pinned, onUnpin, isHidden }: Props) {
  const all = bandLines(series, a, b)
  const lines = [...all].sort((x, y) => Math.abs(y.b - y.a) - Math.abs(x.b - x.a)).slice(0, MAX_LINES)
  const totalA = total(mode, all, "a")
  const totalB = total(mode, all, "b")
  const cell = "px-1.5 py-1 text-right tabular-nums whitespace-nowrap"
  return (
    <div className="rounded-xl border border-card-border p-3 text-xs">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="font-semibold text-foreground">
          {a.year} · age {a.age}
        </p>
        {pinned && (
          <button type="button" onClick={onUnpin} className="text-[11px] font-medium text-primary hover:underline">
            Unpin
          </button>
        )}
      </div>
      {!inBoth && <p className="mb-1 text-[11px] text-foreground-muted">Only one plan runs this year.</p>}
      <table className="w-full" style={{ filter: isHidden ? "blur(6px)" : undefined }}>
        <thead>
          <tr className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">
            <th className="py-1 text-left font-semibold" />
            <th className={cell} style={{ color: colors[0] }}>A</th>
            <th className={cell} style={{ color: colors[1] }}>B</th>
            <th className={cell}>B − A</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.key} className="border-t border-card-border">
              <td className="max-w-[9rem] py-1 pr-1">
                <span className="inline-flex min-w-0 items-center gap-1.5 text-foreground-muted">
                  <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: l.color }} />
                  <span className="truncate" title={l.label}>
                    {l.label}
                  </span>
                </span>
              </td>
              <td className={cell}>{fmtCompact(l.a)}</td>
              <td className={cell}>{fmtCompact(l.b)}</td>
              <td className={cell}>
                <Delta mode={mode} value={l.b - l.a} />
              </td>
            </tr>
          ))}
          <tr className="border-t border-card-border font-semibold text-foreground">
            <td className="py-1">{TOTAL_LABEL[mode]}</td>
            <td className={cell}>{fmtCompact(totalA)}</td>
            <td className={cell}>{fmtCompact(totalB)}</td>
            <td className={cell}>
              <Delta mode={mode === "cashflow" ? "income" : mode} value={totalB - totalA} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
