import { useMemo } from "react"
import type { SubscriptionItem } from "./use-subscriptions"

const FREQUENCY_ORDER = ["weekly", "biweekly", "monthly", "quarterly", "semi_annual", "yearly"] as const

interface Params {
  subs: SubscriptionItem[]
  /** Group-by control: flat | frequency | cost | date. */
  sortBy: string
  /** Column-header sort field (overrides sortBy when set). */
  sortField: "amount" | "nextCharge" | null
  sortDir: "asc" | "desc"
  page: number
  pageSize: number
}

/**
 * Sorting + pagination + optional frequency-grouping for the subscription list.
 * Column-header sort (sortField) takes precedence over the group-by control.
 */
export function useSubscriptionList({ subs, sortBy, sortField, sortDir, page, pageSize }: Params) {
  const sortedSubs = useMemo(() => {
    if (sortField) {
      const factor = sortDir === "asc" ? 1 : -1
      return [...subs].sort((a, b) => {
        if (sortField === "amount") return (a.amount - b.amount) * factor
        if (!a.nextChargeDate && !b.nextChargeDate) return 0
        if (!a.nextChargeDate) return 1
        if (!b.nextChargeDate) return -1
        return (new Date(a.nextChargeDate).getTime() - new Date(b.nextChargeDate).getTime()) * factor
      })
    }
    if (sortBy === "cost") return [...subs].sort((a, b) => b.amount - a.amount)
    if (sortBy === "date") {
      return [...subs].sort((a, b) => {
        if (!a.nextChargeDate && !b.nextChargeDate) return 0
        if (!a.nextChargeDate) return 1
        if (!b.nextChargeDate) return -1
        return new Date(a.nextChargeDate).getTime() - new Date(b.nextChargeDate).getTime()
      })
    }
    if (sortBy === "frequency") {
      return FREQUENCY_ORDER.flatMap((freq) => subs.filter((s) => s.frequency === freq))
    }
    return subs
  }, [subs, sortBy, sortField, sortDir])

  const { paginatedItems, totalPages, totalItems } = useMemo(() => {
    const total = sortedSubs.length
    const pages = Math.ceil(total / pageSize)
    const slice = sortedSubs.slice((page - 1) * pageSize, page * pageSize)
    return { paginatedItems: slice, totalPages: pages, totalItems: total }
  }, [sortedSubs, page, pageSize])

  const paginatedGroups = useMemo(() => {
    if (sortBy !== "frequency" || sortField) return null
    const groups: Record<string, SubscriptionItem[]> = {}
    for (const item of paginatedItems) {
      (groups[item.frequency] ??= []).push(item)
    }
    return groups
  }, [paginatedItems, sortBy, sortField])

  return { paginatedItems, paginatedGroups, totalPages, totalItems }
}
