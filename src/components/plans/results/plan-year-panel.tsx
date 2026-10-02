"use client"

import { useState, type ReactNode } from "react"
import { fmtMoney, fmtPct } from "@/components/fire/fire-helpers"
import { usePlanMode } from "@/hooks/plans/use-plan-mode"
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

/** A line that opens to show what it's made of; the arrow sits right after the label. */
function Drilldown({ title, summary, hint, children }: { title: string; summary: string; hint?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} title={hint} className="flex w-full items-center justify-between gap-3 py-1 text-left">
        <span className="inline-flex items-center gap-0.5 text-xs text-foreground-muted hover:text-foreground">
          {title}
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>
            {open ? "expand_more" : "chevron_right"}
          </span>
        </span>
        <span className="text-xs font-medium tabular-nums text-foreground">{summary}</span>
      </button>
      {open && <div className="pl-3 pb-1">{children}</div>}
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

/** One row inside an open drilldown. */
function SubLine({ label, value, indent }: { label: string; value: string; indent?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-0.5 text-[11px]", indent && "pl-3")}>
      <span className="min-w-0 truncate text-foreground-muted">{label}</span>
      <span className="tabular-nums text-foreground whitespace-nowrap">{value}</span>
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

/** One plan year read like a personal P&L: where you stand, what came in and went out, and what grew. Basic leaves out the tax detail. */
export function PlanYearPanel({ metrics: m, age, year, pinned, onUnpin, colors }: Props) {
  const { isBasic } = usePlanMode()
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
        {isBasic ? (
          <Line label="Taxes" value={fmtMoney(m.taxes)} />
        ) : (
          <>
            <Line label="Taxable income" value={fmtMoney(m.taxableIncome)} hint="Taxable pay after pre-tax contributions, plus traditional withdrawals and realized gains" />
            <Drilldown title="Taxes" summary={fmtMoney(m.taxes)}>
              {m.taxesBy.length === 0 && <p className="text-[11px] text-foreground-muted">No tax this year.</p>}
              {m.taxesBy.map((t) => (
                <SubLine key={t.label} label={t.label} value={fmtMoney(t.value)} />
              ))}
            </Drilldown>
            <Line label="Effective tax rate" value={m.effectiveTaxRate === null ? "—" : fmtPct(m.effectiveTaxRate)} hint="Taxes ÷ taxable income" />
          </>
        )}
        {!isBasic && m.deduction && (
          <Line
            label={m.deduction.itemized ? "Itemized deductions" : "Standard deduction"}
            value={fmtMoney(m.deduction.amount)}
            hint="Federal. Standard: $16,100 single / $32,200 joint in 2026, plus $2,050 (single) or $1,650 per spouse aged 65+, raised each year with the plan's inflation. Itemized instead when state income and property tax (under the SALT cap) plus mortgage interest add up to more."
          />
        )}
        {!isBasic && (m.deduction?.senior ?? 0) >= 0.5 && (
          <Line
            label="Senior deduction"
            value={fmtMoney(m.deduction?.senior ?? 0)}
            hint="2025–2028 only: $6,000 per person 65+, on top of the standard or itemized deduction; shrinks by 6% of income over $75,000 single / $150,000 joint"
          />
        )}
        {m.spendingRule !== null && (
          <Line
            label="Spending rule"
            value={`${fmtPct(m.spendingRule, 0)} of plan`}
            tone={m.spendingRule < 0.995 ? "bad" : m.spendingRule > 1.005 ? "good" : undefined}
            hint="How the spending rule set this year's flexible spending against the plan (kids, home & vehicle costs and one-time items stay as planned)"
          />
        )}
        <Drilldown title="Spending" summary={fmtMoney(m.spending)}>
          {m.spendingBy.length === 0 && <p className="text-[11px] text-foreground-muted">No spending this year.</p>}
          {m.spendingBy.map((e) => (
            <SubLine key={e.id} label={e.name} value={fmtMoney(e.value)} />
          ))}
        </Drilldown>
        <Drilldown title="Expenses" summary={fmtMoney(m.expenses)} hint="Spending + taxes + debt payments + asset purchases">
          <SubLine label="Spending" value={fmtMoney(m.spending)} />
          <SubLine label="Taxes" value={fmtMoney(m.taxes)} />
          {m.debtPayments >= 0.5 && <SubLine label="Debt payments" value={fmtMoney(m.debtPayments)} />}
          {m.loans.map((l) => (
            <div key={l.id}>
              <SubLine indent label={`${l.name} principal`} value={fmtMoney(l.principal)} />
              <SubLine indent label={`${l.name} interest`} value={fmtMoney(l.interest)} />
            </div>
          ))}
          {m.assetPurchases >= 0.5 && <SubLine label="Asset purchases" value={fmtMoney(m.assetPurchases)} />}
        </Drilldown>
        <Line label="Savings rate" value={m.savingsRate === null ? "—" : fmtPct(m.savingsRate)} hint="Share of after-tax income not spent (pre-tax 401k/HSA counts as saved)" />
        <Drilldown title="Contributions" summary={fmtMoney(m.contributions)}>
          <p className="text-[10px] text-foreground-muted pb-0.5">
            Into savings and investment accounts: payroll contributions plus what was left after taxes and spending.
          </p>
          {m.contributionsBy.length === 0 && <p className="text-[11px] text-foreground-muted">Nothing left to save this year.</p>}
          {m.contributionsBy.map((c) => (
            <SubLine key={c.id} label={c.name} value={fmtMoney(c.value)} />
          ))}
        </Drilldown>
        {m.employerMatch >= 0.5 && (
          <Line label="Employer match (extra)" value={fmtMoney(m.employerMatch)} hint="Added by your employer on top of your contributions" />
        )}
        {m.received >= 0.5 && (
          <Line label="Received into accounts" value={fmtMoney(m.received)} tone="good" hint="Inherited investments or accounts, gifts: not part of cash flow" />
        )}
        {m.splitOut >= 0.5 && (
          <Line label="Split out in divorce" value={fmtMoney(m.splitOut)} tone="bad" hint="Your ex-spouse's share of the accounts: moved out untaxed, not part of cash flow" />
        )}
        <Line label="Withdrawals" value={fmtMoney(m.withdrawals)} hint="Taken from your accounts to cover spending, including the tax on those withdrawals" />
        {!isBasic && m.requiredWithdrawals >= 0.5 && (
          <Line
            label="Required withdrawals"
            value={fmtMoney(m.requiredWithdrawals)}
            hint="The IRS minimum from 401(k)s and IRAs, from 73 (75 if born 1960+): last year-end's balance ÷ an IRS life-expectancy factor. Part of Withdrawals; what isn't spent is reinvested."
          />
        )}
        {!isBasic && (
          <Line
            label="Withdrawal rate"
            value={m.withdrawalRate === null ? "—" : fmtPct(m.withdrawalRate)}
            hint="Withdrawals ÷ account balances at the start of the year"
          />
        )}
      </Section>
      <Section>
        {!isBasic && <TaxBalanceBar balance={m.taxBalance} colors={colors} />}
        {!isBasic && (
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
        )}
        <Drilldown title="Income sources" summary={fmtMoney(m.incomeSources.reduce((s, i) => s + i.value, 0))}>
          {m.incomeSources.length === 0 && <p className="text-[11px] text-foreground-muted">No income this year.</p>}
          {m.incomeSources.map((s) => (
            <SubLine key={s.label} label={s.label} value={fmtMoney(s.value)} />
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
