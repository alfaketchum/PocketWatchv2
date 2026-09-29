"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { EmptyState } from "@/components/ui/empty-state"
import { useMailSenders, useUnsubscribeSenders, type SenderFilters } from "@/hooks/accounts"
import { AccountsSkeleton } from "../accounts-skeleton"
import { SenderRow } from "./sender-row"

const PAGE_SIZE = 100
const SEARCH_DEBOUNCE_MS = 300
const SELECT = "rounded-lg border border-card-border bg-card px-3 py-2 text-sm text-foreground"

interface SendersListProps {
  hasGmail: boolean
}

/** Unsubscribe manager: filters, bulk one-click unsubscribe, and the sender list. */
export function SendersList({ hasGmail }: SendersListProps) {
  const [filters, setFilters] = useState<SenderFilters>({ status: "active", sort: "count", page: 1, limit: PAGE_SIZE })
  const [debounced, setDebounced] = useState(filters)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const bulk = useUnsubscribeSenders()

  useEffect(() => {
    const t = setTimeout(() => setDebounced(filters), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [filters])

  const { data, isLoading, isError } = useMailSenders(debounced)
  const senders = useMemo(() => data?.senders ?? [], [data])
  const oneClickIds = senders.filter((s) => s.status === "active" && s.method === "one_click").map((s) => s.id)
  const page = filters.page ?? 1
  const pageCount = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  const set = (patch: Partial<SenderFilters>) => {
    setSelected(new Set())
    setFilters({ ...filters, ...patch, page: patch.page ?? 1 })
  }

  const toggle = (id: string, checked: boolean) => {
    const next = new Set(selected)
    if (checked) next.add(id)
    else next.delete(id)
    setSelected(next)
  }

  const handleBulk = () => {
    bulk.mutate([...selected], {
      onSuccess: ({ results }) => {
        const ok = results.filter((r) => r.ok).length
        const failed = results.length - ok
        setSelected(new Set())
        if (ok) toast.success(`Unsubscribed from ${ok} sender${ok === 1 ? "" : "s"}`)
        if (failed) toast.error(`${failed} couldn't be unsubscribed — see the row for details`)
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Unsubscribe failed"),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={filters.q ?? ""}
          onChange={(e) => set({ q: e.target.value || undefined })}
          placeholder="Search senders…"
          className="min-w-[200px] flex-1 rounded-lg border border-card-border bg-card px-3 py-2 text-sm text-foreground"
          aria-label="Search senders"
        />
        <select value={filters.mailbox ?? ""} onChange={(e) => set({ mailbox: e.target.value || undefined })} className={SELECT} aria-label="Filter by inbox">
          <option value="">All inboxes</option>
          {data?.mailboxes.map((m) => (
            <option key={m.email} value={m.email}>
              {m.email} ({m.count})
            </option>
          ))}
        </select>
        <select value={filters.status ?? "active"} onChange={(e) => set({ status: e.target.value as SenderFilters["status"] })} className={SELECT} aria-label="Filter by status">
          <option value="active">Subscribed</option>
          <option value="unsubscribed">Unsubscribed</option>
          <option value="kept">Kept</option>
          <option value="all">All</option>
        </select>
        <select value={filters.sort ?? "count"} onChange={(e) => set({ sort: e.target.value as SenderFilters["sort"] })} className={SELECT} aria-label="Sort">
          <option value="count">Most emails</option>
          <option value="recent">Most recent</option>
        </select>
      </div>

      {oneClickIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-foreground-muted">
          <button type="button" className="btn-ghost text-xs" onClick={() => setSelected(new Set(oneClickIds))}>
            Select all one-click ({oneClickIds.length})
          </button>
          {selected.size > 0 && (
            <>
              <button type="button" className="btn-ghost text-xs" onClick={() => setSelected(new Set())}>
                Clear
              </button>
              <button type="button" className="btn-primary text-xs" disabled={bulk.isPending} onClick={handleBulk}>
                {bulk.isPending ? "Unsubscribing…" : `Unsubscribe from ${selected.size}`}
              </button>
            </>
          )}
          <span>One-click senders are unsubscribed directly; others open their unsubscribe page or email.</span>
        </div>
      )}

      {isLoading && <AccountsSkeleton />}
      {isError && !isLoading && (
        <div className="card border-l-4 p-4" style={{ borderLeftColor: "var(--error)" }}>
          <p className="text-sm font-medium text-foreground">Couldn&apos;t load senders</p>
        </div>
      )}

      {!isLoading && !isError && senders.length === 0 && (
        <EmptyState
          icon="unsubscribe"
          title={hasGmail ? "No mailing lists found yet" : "Connect your email"}
          description={
            hasGmail
              ? "Click Scan senders to find newsletters and promotions in your inboxes, ranked by how much they send you."
              : "Connect Gmail to find the mailing lists filling your inboxes and unsubscribe in one click."
          }
          action={hasGmail ? undefined : { label: "Connect Gmail", href: "/api/integrations/gmail/connect" }}
        />
      )}

      {!isLoading && !isError && senders.length > 0 && (
        <>
          <p className="text-xs text-foreground-muted">
            {data?.total} sender{data?.total === 1 ? "" : "s"} · email counts are since the first scan (last 6 months)
          </p>
          <ul className="card overflow-hidden p-0">
            {senders.map((s) => (
              <SenderRow key={s.id} sender={s} selected={selected.has(s.id)} onSelect={(c) => toggle(s.id, c)} />
            ))}
          </ul>
          {pageCount > 1 && (
            <div className="flex items-center justify-end gap-2 text-xs text-foreground-muted">
              <button type="button" className="btn-ghost" disabled={page <= 1} onClick={() => set({ page: page - 1 })}>
                Previous
              </button>
              <span>
                Page {page} of {pageCount}
              </span>
              <button type="button" className="btn-ghost" disabled={page >= pageCount} onClick={() => set({ page: page + 1 })}>
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
