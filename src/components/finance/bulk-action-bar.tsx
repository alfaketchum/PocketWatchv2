"use client"

import { useState } from "react"
import { toast } from "sonner"
import { FINANCE_CATEGORIES } from "@/lib/finance/categories"
import { useBulkCategorize } from "@/hooks/finance/use-transactions"
import { useMarkSubscription } from "@/hooks/finance/use-subscriptions"

const categoryKeys = Object.keys(FINANCE_CATEGORIES)

interface BulkActionBarProps {
  selectedIds: Set<string>
  onClear: () => void
}

export function BulkActionBar({ selectedIds, onClear }: BulkActionBarProps) {
  const [category, setCategory] = useState("")
  const [marking, setMarking] = useState(false)
  const bulkCategorize = useBulkCategorize()
  const markSub = useMarkSubscription()
  const count = selectedIds.size

  if (count === 0) return null

  const handleMarkSub = async () => {
    setMarking(true)
    try {
      for (const id of selectedIds) await markSub.mutateAsync({ transactionId: id })
      toast.success(`Marked ${count} as subscription${count !== 1 ? "s" : ""}`)
      onClear()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setMarking(false)
    }
  }

  const handleApply = () => {
    if (!category) {
      toast.error("Select a category first")
      return
    }
    bulkCategorize.mutate(
      { ids: [...selectedIds], category },
      {
        onSuccess: (res) => {
          toast.success(`${res.updated} transaction${res.updated !== 1 ? "s" : ""} updated`)
          setCategory("")
          onClear()
        },
        onError: (e) => toast.error(e.message),
      },
    )
  }

  return (
    <div className="sticky top-0 z-10 bg-primary text-white rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg">
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="material-symbols-rounded" style={{ fontSize: 18 }}>checklist</span>
        <span className="text-xs font-semibold">{count} selected</span>
      </div>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="appearance-none px-3 py-1.5 pr-7 rounded-lg bg-white/20 border border-white/30 text-xs text-white placeholder:text-white/60 cursor-pointer min-w-[140px]"
        >
          <option value="" className="text-foreground">Set category...</option>
          {categoryKeys.map((cat) => (
            <option key={cat} value={cat} className="text-foreground">{cat}</option>
          ))}
        </select>

        <button
          onClick={handleApply}
          disabled={!category || bulkCategorize.isPending}
          className="px-4 py-1.5 text-xs font-semibold bg-white text-primary rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50"
        >
          {bulkCategorize.isPending ? "Updating..." : "Apply"}
        </button>

        <button
          onClick={handleMarkSub}
          disabled={marking}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white/20 border border-white/30 text-white rounded-lg hover:bg-white/30 transition-colors disabled:opacity-50 flex-shrink-0"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 15 }}>autorenew</span>
          {marking ? "Marking..." : "Mark subscription"}
        </button>
      </div>

      <button
        onClick={onClear}
        className="text-white/70 hover:text-white transition-colors flex-shrink-0"
        aria-label="Clear selection"
      >
        <span className="material-symbols-rounded" style={{ fontSize: 18 }}>close</span>
      </button>
    </div>
  )
}
