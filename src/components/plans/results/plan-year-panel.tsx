"use client"

import { useState, type ReactNode } from "react"
import { fmtMoney, fmtPct } from "@/components/fire/fire-helpers"
import { TAX_TREATMENT_LABELS } from "@/lib/plans/plan-constants"
import { TAX_BALANCE_LABELS, type TaxBalance, type YearMetrics } from "@/lib/plans/plan-year-metrics"
import { cn } from "@/lib/utils"

function Line({ label, value, tone, hint }: { label: string; value: string; tone?: "good" | "bad"; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1" title={hint}>
      <span className="text-xs text-foreground-muted">{label}</span>
      <span className={cn("text-xs font-medium tabular-nums", tone === "good" ? "text-success" : tone === "bad" ? "text-error" : "text-foreground")}>
        {value}
      </span>
    </div>
  )
}

function Section({ children }: { children: ReactNode }) {
  return <div className="border-t border-card-border pt-2 mt-2">{children}</div>
}

function Drilldown({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 py-1 text-left">
        <span className="inline-flex items-center gap-1 text-xs text-foreground-muted">
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>
            {open ? "expand_more" : "chevron_right"}
          </span>
          {title}
        </span>
        <span className="text-xs font-medium tabular-nums text-foreground">{summary}</span>
      </button>
      {open && <div className="pl-5 pb-1">{children}</div>}
    </div>
  )
}

function TaxBalanceBar({ balance, colors }: { balance: TaxBalance; colors: Record<keyof TaxBalance, string> }) {
  const keys = Object.keys(TAX_BALANCE_LABELS) as (keyof TaxBalance)[]
  const total = keys.reduce((s, k) => s + Math.max(0, balance[k]), 0)
  if (total <= 0) return <Line label="Tax balance" value="—" />
  return (
    <div className="py-1 space-y-1.5" title="How your accounts split across tax treatments">
      <span className="text-xs text-foreground-muted">Tax balance</span>
      <div className="flex h-2 overflow-hidden rounded-full bg-background-secondary">
        {keys.map((k) => (
          <span key={k} style={{ width: `${(Math.max(0, balance[k]) / total) * 100}%`, background: colors[k] }} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        {keys.map((k) => (
          <span key={k} className="flex items-center justify-between gap-2 text-[11px] text-foreground-muted">
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-sm" style={{ background: colors[k] }} />
              {TAX_BALANCE_LABELS[k]}
            </span>
            <span className="tabular-nums">{fmtPct(Math.max(0, balance[k]) / total, 0)}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

const signed = (v: number) => `${v >= 0 ? "+" : "−"}${fmtMoney(Math.abs(v))}`

interface Props {
  metrics: YearMetrics
  age: number
  year: number
  pinned: boolean
  onUnpin: () => void
  colors: Record<keyof TaxBalance, string>
}

/** One plan year read like a personal P&L: where you stand, what came in and went out, and what grew. */
export function PlanYearPanel({ metrics: m, age, year, pinned, onUnpin, colors }: Props) {
  return (
    <aside className="rounded-xl border border-card-border bg-card p-4 text-sm" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-foreground">
          Age {age} · {year}
        </p>
        {pinned ? (
          <button type="button" onClick={onUnpin} className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
            <span className="material-symbols-rounded" style={{ fontSize: 13 }}>
              push_pin
            </span>
            Pinned
          </button>
        ) : (
          <span className="text-[10px] text-foreground-muted">Click a bar to pin</span>
        )}
      </div>
      <p className="text-2xl font-semibold tabular-nums text-foreground mt-2">{fmtMoney(m.netWorth)}</p>
      <Line label="Change in net worth" value={signed(m.netWorthChange)} tone={m.netWorthChange >= 0 ? "good" : "bad"} />
      <Line label="Liquid net worth" value={fmtMoney(m.liquidNetWorth)} hint="Cash and taxable investments: reachable without penalties or selling property" />
      <Section>
        <Line label="Income" value={fmtMoney(m.income)} />
        <Line label="Taxable income" value={fmtMoney(m.taxableIncome)} hint="Taxable pay after pre-tax contributions, plus traditional withdrawals and realized gains" />
        <Line label="Taxes" value={fmtMoney(m.taxes)} />
        <Line label="Effective tax rate" value={m.effectiveTaxRate === null ? "—" : fmtPct(m.effectiveTaxRate)} hint="Taxes ÷ taxable income" />
        <Line label="Spending" value={fmtMoney(m.spending)} />
        <Line label="Expenses" value={fmtMoney(m.expenses)} hint="Spending + debt payments + taxes + asset purchases" />
        <Line label="Savings rate" value={m.savingsRate === null ? "—" : fmtPct(m.savingsRate)} hint="Share of after-tax income not spent (pre-tax 401k/HSA counts as saved)" />
        <Line label="Contributions" value={fmtMoney(m.contributions)} hint="Payroll contributions, employer match and surplus saved" />
      </Section>
      <Section>
        <TaxBalanceBar balance={m.taxBalance} colors={colors} />
        <Drilldown title="Portfolio allocation" summary={`${m.allocations.length} accounts`}>
          {m.allocations.map((a) => (
            <div key={a.id} className="flex items-baseline justify-between gap-3 py-0.5 text-[11px]">
              <span className="min-w-0 truncate text-foreground-muted">
                {a.name} <span className="opacity-70">· {TAX_TREATMENT_LABELS[a.treatment]}</span>
              </span>
              <span className="tabular-nums text-foreground whitespace-nowrap">
                {fmtMoney(a.balance)} <span className="text-foreground-muted">({fmtPct(a.share, 0)})</span>
              </span>
            </div>
          ))}
        </Drilldown>
        <Drilldown title="Income sources" summary={fmtMoney(m.incomeSources.reduce((s, i) => s + i.value, 0))}>
          {m.incomeSources.length === 0 && <p className="text-[11px] text-foreground-muted">No income this year.</p>}
          {m.incomeSources.map((s) => (
            <div key={s.label} className="flex items-baseline justify-between gap-3 py-0.5 text-[11px]">
              <span className="min-w-0 truncate text-foreground-muted">{s.label}</span>
              <span className="tabular-nums text-foreground">{fmtMoney(s.value)}</span>
            </div>
          ))}
        </Drilldown>
      </Section>
      <Section>
        <Line label="Investment growth" value={signed(m.investmentGrowth)} tone={m.investmentGrowth >= 0 ? "good" : "bad"} />
        <Line label="Asset appreciation" value={fmtMoney(m.assetAppreciation)} />
        <Line label="Asset depreciation" value={m.assetDepreciation > 0.5 ? `−${fmtMoney(m.assetDepreciation)}` : fmtMoney(0)} />
      </Section>
    </aside>
  )
}
