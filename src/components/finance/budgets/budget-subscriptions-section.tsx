"use client"

import { useState, useEffect, useMemo } from "react"
import { useFinanceSubscriptions, useUpdateSubscription, useDetectSubscriptions, useUpcomingBills } from "@/hooks/use-finance"
import { formatCurrency } from "@/lib/utils"
import { FinanceStatCard } from "@/components/finance/stat-card"
import { FinanceEmpty } from "@/components/finance/finance-empty"
import { FinanceCardSkeleton } from "@/components/finance/finance-loading"
import { CancelGuidanceDrawer } from "@/components/finance/cancel-guidance-drawer"
import { SubscriptionPagination } from "@/components/finance/subscription-pagination"
import { BillsImmediateActions } from "@/components/finance/bills-immediate-actions"
import { SubscriptionCardGrid } from "@/components/finance/subscription-card-grid"
import { SubscriptionTableView } from "@/components/finance/subscription-table-view"
import {
  SubscriptionListControls,
  type SubTab, type SubSort, type SubView,
} from "@/components/finance/subscription-list-controls"

interface CancelTarget {
  id: string
  merchantName: string
  amount: number
  frequency: string
}

const PAGE_SIZE = 25
const VIEW_KEY = "pw-sub-view"
const FREQUENCY_ORDER = ["weekly", "biweekly", "monthly", "quarterly", "semi_annual", "yearly"] as const

export function BudgetSubscriptionsSection() {
  const { data, isLoading, isError } = useFinanceSubscriptions()
  const { data: dismissedData } = useFinanceSubscriptions("dismissed")
  const updateSub = useUpdateSubscription()
  const detectSubs = useDetectSubscriptions()
  const { data: billsData } = useUpcomingBills()
  const [showBanner, setShowBanner] = useState(false)
  const [tab, setTab] = useState<SubTab>("active")
  const [sortBy, setSortBy] = useState<SubSort>("flat")
  const [view, setView] = useState<SubView>("table")
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null)
  const [page, setPage] = useState(1)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY)
      if (saved === "table" || saved === "card") setView(saved)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (detectSubs.isSuccess) {
      setShowBanner(true)
      const timer = setTimeout(() => setShowBanner(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [detectSubs.isSuccess])

  function handleViewChange(v: SubView) {
    setView(v)
    try { localStorage.setItem(VIEW_KEY, v) } catch { /* ignore */ }
  }

  const subs = data?.subscriptions ?? []
  const suggestedSubs = subs.filter((s) => s.status === "suggested")
  // "Active" tab = live subscriptions only. Cancelled/dismissed drop out so acting
  // on an item (cancel or "not a sub") removes it from the list immediately.
  const activeSubs = subs.filter((s) => !["suggested", "dismissed", "cancelled"].includes(s.status))
  // "Inactive" tab = things set aside: cancelled (was real, may return → Reactivate)
  // and dismissed (never a sub → Restore). The default query returns cancelled;
  // dismissed comes from its own fetch.
  const cancelledSubs = subs.filter((s) => s.status === "cancelled")
  const dismissedSubs = dismissedData?.subscriptions ?? []
  const inactiveSubs = [...cancelledSubs, ...dismissedSubs]
  const flaggedSubs = subs.filter((s) => !s.isWanted && s.status === "active")
  const pausedSubs = subs.filter((s) => s.status === "paused")
  const potentialSavings = flaggedSubs.reduce((sum, s) => sum + s.amount, 0)
    + pausedSubs.reduce((sum, s) => sum + s.amount, 0)

  const filteredSubs = tab === "suggested" ? suggestedSubs
    : tab === "inactive" ? inactiveSubs
    : activeSubs

  const sortedSubs = useMemo(() => {
    if (sortBy === "cost") return [...filteredSubs].sort((a, b) => b.amount - a.amount)
    if (sortBy === "date") {
      return [...filteredSubs].sort((a, b) => {
        if (!a.nextChargeDate && !b.nextChargeDate) return 0
        if (!a.nextChargeDate) return 1
        if (!b.nextChargeDate) return -1
        return new Date(a.nextChargeDate).getTime() - new Date(b.nextChargeDate).getTime()
      })
    }
    if (sortBy === "frequency") {
      return FREQUENCY_ORDER.flatMap((freq) => filteredSubs.filter((s) => s.frequency === freq))
    }
    return filteredSubs
  }, [filteredSubs, sortBy])

  const { paginatedItems, totalPages, totalItems } = useMemo(() => {
    const total = sortedSubs.length
    const pages = Math.ceil(total / PAGE_SIZE)
    const slice = sortedSubs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    return { paginatedItems: slice, totalPages: pages, totalItems: total }
  }, [sortedSubs, page])

  const paginatedGroups = useMemo(() => {
    if (sortBy !== "frequency") return null
    const groups: Record<string, typeof paginatedItems> = {}
    for (const item of paginatedItems) {
      (groups[item.frequency] ??= []).push(item)
    }
    return groups
  }, [paginatedItems, sortBy])

  function handleTabChange(key: SubTab) {
    setTab(key)
    setPage(1)
  }

  function handleSortChange(key: SubSort) {
    setSortBy(key)
    setPage(1)
  }

  const cardHandlers = {
    onUpdateStatus: (id: string, status: string) => updateSub.mutate({ subscriptionId: id, status }),
    onToggleWanted: (id: string, isWanted: boolean) => updateSub.mutate({ subscriptionId: id, isWanted }),
    onRequestCancel: setCancelTarget,
    onUpdateNickname: (id: string, nickname: string | null) => updateSub.mutate({ subscriptionId: id, nickname }),
    onUpdateFrequency: (id: string, frequency: string) => updateSub.mutate({ subscriptionId: id, frequency }),
    onUpdateCategory: (id: string, category: string | null) => updateSub.mutate({ subscriptionId: id, category }),
    onSetReminder: (id: string, date: string | null) => updateSub.mutate({ subscriptionId: id, cancelReminderDate: date }),
    onDismiss: (id: string) => updateSub.mutate({ subscriptionId: id, status: "dismissed" }),
  }

  if (isError) {
    return (
      <div className="bg-card border border-error/30 rounded-xl p-8 text-center">
        <span className="material-symbols-rounded text-error mb-2 block" style={{ fontSize: 32 }}>error</span>
        <p className="text-sm text-error">Failed to load subscriptions.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Detect button */}
      <div className="flex items-center justify-between">
        <p className="text-foreground-muted text-sm">
          {isLoading ? "" : `${activeSubs.length} active subscriptions`}
        </p>
        <button
          onClick={() => detectSubs.mutate()}
          disabled={detectSubs.isPending}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
            {detectSubs.isPending ? "hourglass_top" : "search"}
          </span>
          {detectSubs.isPending ? "Detecting..." : "Detect New"}
        </button>
      </div>

      {/* Detection Banner */}
      {showBanner && detectSubs.data && (
        <div className="bg-success/10 border border-success/20 rounded-xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded text-success" style={{ fontSize: 20 }}>check_circle</span>
            <p className="text-sm text-success">
              Found {detectSubs.data.detected} recurring charges, added {detectSubs.data.newlyAdded} new
              {detectSubs.data.updated > 0 && `, updated ${detectSubs.data.updated} existing`}.
            </p>
          </div>
          <button onClick={() => setShowBanner(false)} className="text-success/60 hover:text-success transition-colors">
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>
      )}

      {/* Hero + Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <FinanceCardSkeleton key={i} />)}
        </div>
      ) : data && subs.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <FinanceStatCard label="Active" value={String(activeSubs.length)} icon="autorenew" accentColor="var(--success)" />
          <FinanceStatCard label="Monthly Total" value={formatCurrency(data.monthlyTotal)} icon="calendar_month" accentColor="var(--primary)" />
          <FinanceStatCard label="Annual Total" value={formatCurrency(data.yearlyTotal)} icon="event" />
          <FinanceStatCard label="Potential Savings" value={formatCurrency(potentialSavings)} icon="savings" accentColor={potentialSavings > 0 ? "var(--warning)" : undefined} />
        </div>
      ) : null}

      {/* Immediate Actions */}
      {billsData && (
        <BillsImmediateActions
          bills={billsData.bills}
          onDismiss={(id) => updateSub.mutate({ subscriptionId: id, status: "dismissed" })}
        />
      )}

      {/* Subscriptions */}
      <div className="space-y-4">
        {(subs.length > 0 || dismissedSubs.length > 0) && (
          <SubscriptionListControls
            tab={tab}
            counts={{ suggested: suggestedSubs.length, active: activeSubs.length, inactive: inactiveSubs.length }}
            onTabChange={handleTabChange}
            sortBy={sortBy}
            onSortChange={handleSortChange}
            view={view}
            onViewChange={handleViewChange}
            showSort={filteredSubs.length > 0}
          />
        )}

        {!isLoading && filteredSubs.length > 0 ? (
          <>
            {view === "table" ? (
              <SubscriptionTableView
                items={paginatedItems}
                groups={paginatedGroups}
                onUpdateStatus={cardHandlers.onUpdateStatus}
                onRequestCancel={cardHandlers.onRequestCancel}
                onSetReminder={cardHandlers.onSetReminder}
                onDismiss={cardHandlers.onDismiss}
              />
            ) : (
              <SubscriptionCardGrid items={paginatedItems} groups={paginatedGroups} {...cardHandlers} />
            )}
            <SubscriptionPagination
              page={page}
              totalPages={totalPages}
              total={totalItems}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        ) : !isLoading ? (
          <FinanceEmpty
            icon="autorenew"
            title={tab === "suggested" ? "No suggestions" : tab === "inactive" ? "Nothing inactive" : "No subscriptions yet"}
            description={tab === "suggested" ? "Run 'Detect New' to scan your transactions for recurring charges to confirm." : tab === "inactive" ? "Cancelled and dismissed subscriptions show up here — reactivate or restore them anytime." : "Confirm a suggestion or mark a transaction as a subscription."}
            action={tab !== "inactive" ? { label: "Detect Subscriptions", onClick: () => detectSubs.mutate() } : undefined}
          />
        ) : null}
      </div>

      {/* Recurring Income */}
      {data?.inflows && data.inflows.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-card-border flex items-center gap-2">
            <span className="material-symbols-rounded text-success" style={{ fontSize: 18 }}>trending_up</span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Recurring Income</span>
          </div>
          <div className="divide-y divide-card-border/50">
            {data.inflows.map((stream) => (
              <div key={stream.streamId} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{stream.merchantName}</p>
                  <p className="text-[10px] text-foreground-muted">{stream.frequency}</p>
                </div>
                <div className="text-right">
                  <span className="font-data text-sm font-semibold text-success tabular-nums">+{formatCurrency(stream.amount)}</span>
                  {stream.averageAmount != null && Math.abs(stream.averageAmount - stream.amount) > 0.01 && (
                    <p className="text-[10px] text-foreground-muted tabular-nums">avg {formatCurrency(stream.averageAmount)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <CancelGuidanceDrawer target={cancelTarget} onClose={() => setCancelTarget(null)} />
    </div>
  )
}
