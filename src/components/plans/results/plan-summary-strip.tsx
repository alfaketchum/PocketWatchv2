"use client"

import { fmtCompact } from "@/components/fire/fire-helpers"
import type { PlanSummary } from "@/lib/plans/plan-types"
import { CASH_TONE_CLASS, cashStatus } from "./cash-status"

function Stat({ label, value, sub, className = "text-foreground", hero = false }: { label: string; value: string; sub?: string; className?: string; hero?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">{label}</p>
      <p className={`${hero ? "text-xl" : "text-base"} font-semibold tabular-nums leading-tight ${className}`}>{value}</p>
      {sub && (
        <p className="truncate text-[10px] text-foreground-muted" title={sub}>
          {sub}
        </p>
      )}
    </div>
  )
}

const splitNote = (split: { accounts: number; property: number } | null) =>
  split ? `${fmtCompact(split.accounts)} in accounts · ${fmtCompact(split.property)} property` : "today's dollars"

/**
 * Headline numbers, always in today's dollars: net worth at retirement and at the end lead, with what's liquid vs
 * property; whether the accounts fund every year comes after, amber unless assets are exhausted.
 */
export function PlanSummaryStrip({ summary, isHidden }: { summary: PlanSummary; isHidden: boolean }) {
  const blur = isHidden ? { filter: "blur(8px)" } : undefined
  const cash = cashStatus(summary)
  return (
    <div
      className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 bg-card border border-card-border rounded-2xl px-4 py-2.5"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <div style={blur}>
        <Stat
          hero
          label="Net worth at retirement"
          value={summary.netWorthAtRetirement === null ? "—" : fmtCompact(summary.netWorthAtRetirement)}
          sub={splitNote(summary.retirementSplit)}
        />
      </div>
      <div style={blur}>
        <Stat hero label={`Net worth at ${summary.endAge}`} value={fmtCompact(summary.endingNetWorth)} sub={splitNote(summary.endingSplit)} />
      </div>
      <Stat
        label="Retire"
        value={summary.retirementAge === null ? "—" : `Age ${summary.retirementAge}`}
        sub={summary.retirementYear === null ? "No retirement milestone" : `${summary.retirementYear} · ${fmtCompact(summary.lifetimeTaxes)} lifetime taxes`}
      />
      <Stat label="Funding" value={cash.value} sub={cash.note} className={CASH_TONE_CLASS[cash.tone]} />
    </div>
  )
}
