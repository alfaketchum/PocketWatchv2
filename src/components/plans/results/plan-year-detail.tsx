"use client"

import { fmtMoney } from "@/components/fire/fire-helpers"
import type { PlanDocument, YearRow } from "@/lib/plans/plan-types"
import { TAX_PARTS } from "@/lib/plans/plan-row-taxes"

function DetailList({ title, entries }: { title: string; entries: { label: string; value: number }[] }) {
  const shown = entries.filter((e) => Math.abs(e.value) >= 0.5)
  if (shown.length === 0) return null
  return (
    <div className="min-w-0 sm:min-w-[12rem]">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted mb-1">{title}</p>
      {shown.map((e) => (
        <p key={e.label} className="flex justify-between gap-4 text-xs">
          <span className="text-foreground-muted truncate">{e.label}</span>
          <span className="tabular-nums text-foreground">{fmtMoney(e.value)}</span>
        </p>
      ))}
    </div>
  )
}

function named<T extends { id: string; name: string }>(items: T[], values: Record<string, number>) {
  return items.map((i) => ({ label: i.name, value: values[i.id] ?? 0 }))
}

/** Everything that happened in one plan year: balances, flows, and the rest. */
export function PlanYearDetail({ row, doc }: { row: YearRow; doc: PlanDocument }) {
  return (
    <div className="flex flex-wrap gap-6">
      <DetailList title="Year-end balances" entries={named(doc.accounts, row.balances)} />
      <DetailList title="Assets" entries={named(doc.assets, row.assetValues)} />
      <DetailList title="Debts" entries={named(doc.debts, row.debtBalances)} />
      <DetailList title="Income" entries={named(doc.incomes, row.incomeBy)} />
      <DetailList title="Spending" entries={named(doc.expenses, row.expensesBy)} />
      <DetailList title="Deposited into (incl. employer match)" entries={named(doc.accounts, row.contributionsBy)} />
      <DetailList title="Withdrawn from" entries={named(doc.accounts, row.withdrawalsBy)} />
      <DetailList title="Received into (inherited, gifts)" entries={named(doc.accounts, row.depositsBy)} />
      <DetailList
        title="Other"
        entries={[
          { label: "Investment growth", value: row.growth },
          { label: "Employer match", value: row.employerMatch },
          ...TAX_PARTS.map((t) => ({ label: t.label, value: row[t.field] })),
          { label: "Required withdrawals (in Withdrawn from)", value: row.requiredWithdrawals },
          { label: "Gains realized by trading", value: row.realizedGains },
          { label: "Debt payments", value: row.debtPayments },
          { label: "Asset purchases", value: row.assetPurchases },
          { label: "Asset sales", value: row.assetSales },
          { label: "Borrowed", value: row.borrowed },
          { label: "Unfunded spending", value: row.shortfall },
        ]}
      />
    </div>
  )
}
