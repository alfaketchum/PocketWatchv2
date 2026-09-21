"use client"

import { useState } from "react"
import Link from "next/link"
import { formatCurrency, cn } from "@/lib/utils"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import { useFinanceAccounts } from "@/hooks/use-finance"
import { TYPE_ICONS } from "@/components/finance/accounts/accounts-constants"
import {
  GROUP_META, ASSET_ORDER, LIABILITY_ORDER, agoLabel, buildAccountGroups, sumGroups,
  type GroupKey, type AccountRow,
} from "./account-groups"

type GroupChanges = Partial<Record<GroupKey, number>>

/** Colored signed change: gain green / drainage red. For liabilities the sign
 *  flips (less debt = gain). */
function ChangeAmount({ change, isLiability, isHidden, className }: { change: number | undefined; isLiability: boolean; isHidden: boolean; className?: string }) {
  if (change === undefined || Math.round(change) === 0) return null
  const isGain = isLiability ? change < 0 : change > 0
  const sign = change >= 0 ? "+" : "-"
  return (
    <span className={cn("tabular-nums font-semibold", isGain ? "text-success" : "text-error", className)}>
      <BlurredValue isHidden={isHidden}>{sign}{formatCurrency(Math.abs(change))}</BlurredValue>
    </span>
  )
}

export function NetWorthAccountsBreakdown({ isHidden, changes }: { isHidden: boolean; changes?: GroupChanges }) {
  const { data: institutions, isLoading } = useFinanceAccounts()

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[52px] animate-shimmer rounded-xl" />
        ))}
      </div>
    )
  }

  const groups = buildAccountGroups(institutions)
  const hasAny = Object.values(groups).some((rows) => rows.length > 0)
  if (!hasAny) {
    return (
      <div className="bg-card border border-card-border rounded-xl p-8 text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
        <span className="material-symbols-rounded text-foreground-muted mb-2 block" style={{ fontSize: 28 }}>account_balance</span>
        <p className="text-sm text-foreground-muted mb-3">No accounts connected yet.</p>
        <Link href="/finance/accounts" className="text-sm font-medium text-primary hover:text-primary-hover">+ Connect account</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Section
        title="Assets"
        total={sumGroups(groups, ASSET_ORDER)}
        order={ASSET_ORDER}
        groups={groups}
        isHidden={isHidden}
        isLiability={false}
        changes={changes}
      />
      <Section
        title="Liabilities"
        total={sumGroups(groups, LIABILITY_ORDER)}
        order={LIABILITY_ORDER}
        groups={groups}
        isHidden={isHidden}
        isLiability
        changes={changes}
      />
    </div>
  )
}

function Section({
  title, total, order, groups, isHidden, isLiability, changes,
}: {
  title: string
  total: number
  order: GroupKey[]
  groups: Record<GroupKey, AccountRow[]>
  isHidden: boolean
  isLiability: boolean
  changes?: GroupChanges
}) {
  const visible = order.filter((k) => groups[k].length > 0)
  if (visible.length === 0) return null

  const sectionChange = visible.reduce((s, k) => s + (changes?.[k] ?? 0), 0)
  const hasChange = changes && visible.some((k) => changes[k] !== undefined)

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground-muted">{title}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-sm font-semibold tabular-nums text-foreground">
            <BlurredValue isHidden={isHidden}>{formatCurrency(total)}</BlurredValue>
          </p>
          {hasChange && <ChangeAmount change={sectionChange} isLiability={isLiability} isHidden={isHidden} className="text-xs" />}
        </div>
      </div>
      <div className="space-y-2">
        {visible.map((k) => (
          <AccountGroup
            key={k}
            meta={GROUP_META[k]}
            rows={groups[k]}
            total={groups[k].reduce((s, r) => s + r.balance, 0)}
            isHidden={isHidden}
            isLiability={isLiability}
            change={changes?.[k]}
          />
        ))}
      </div>
    </div>
  )
}

function AccountGroup({
  meta, rows, total, isHidden, isLiability, change,
}: {
  meta: { label: string; icon: string }
  rows: AccountRow[]
  total: number
  isHidden: boolean
  isLiability: boolean
  change?: number
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-background-secondary transition-colors text-left"
        aria-expanded={open}
      >
        <span className="material-symbols-rounded text-foreground-muted flex-shrink-0" style={{ fontSize: 18 }} aria-hidden="true">{meta.icon}</span>
        <span className="text-sm font-semibold text-foreground">{meta.label}</span>
        <span className="ml-1 text-[11px] text-foreground-muted tabular-nums">{rows.length}</span>
        <span className="ml-auto flex flex-col items-end leading-tight">
          <span className="text-sm font-semibold tabular-nums text-foreground">
            <BlurredValue isHidden={isHidden}>{formatCurrency(total)}</BlurredValue>
          </span>
          <ChangeAmount change={change} isLiability={isLiability} isHidden={isHidden} className="text-[11px]" />
        </span>
        <span className={cn("material-symbols-rounded text-foreground-muted transition-transform flex-shrink-0", open && "rotate-180")} style={{ fontSize: 18 }} aria-hidden="true">expand_more</span>
      </button>

      {open && (
        <div className="border-t border-card-border">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-card-border/40 last:border-0">
              <span className="material-symbols-rounded text-foreground-muted flex-shrink-0" style={{ fontSize: 16 }} aria-hidden="true">
                {TYPE_ICONS[row.type] ?? "account_balance"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground truncate">{row.name}</p>
                <p className="text-[11px] text-foreground-muted tabular-nums">
                  {row.mask ? `••${row.mask}` : ""}
                  {row.mask && agoLabel(row.synced) ? " · " : ""}
                  {agoLabel(row.synced)}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                {row.needsReconnect ? (
                  <Link href="/finance/accounts" className="text-xs font-medium text-primary hover:text-primary-hover transition-colors">
                    Reconnect
                  </Link>
                ) : (
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    <BlurredValue isHidden={isHidden}>{formatCurrency(row.balance)}</BlurredValue>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
