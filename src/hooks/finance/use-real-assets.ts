"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { combinedNetWorthKeys } from "@/hooks/use-combined-net-worth"
import type { RealAssetKind } from "@/lib/finance/real-assets"
import { financeFetch, financeKeys } from "./shared"

export interface RealAssetItem {
  id: string
  kind: RealAssetKind
  name: string
  value: number
  valueAsOf: string
  appreciation: number
  purchasePrice: number | null
  purchaseDate: string | null
  loanAccountId: string | null
  estimatedValue: number
  values: { date: string; value: number }[]
}

export interface RealAssetLoan {
  id: string
  name: string
  balance: number
}

export interface RealAssetInput {
  kind: RealAssetKind
  name: string
  value: number
  appreciation: number
  purchasePrice?: number | null
  purchaseDate?: string | null
  loanAccountId?: string | null
}

/** The user's homes, vehicles and other hand-valued assets, and the loans they can be linked to. */
export function useRealAssets() {
  return useQuery({
    queryKey: financeKeys.realAssets(),
    queryFn: () => financeFetch<{ assets: RealAssetItem[]; loans: RealAssetLoan[] }>("/real-assets"),
  })
}

function useRefreshAfter() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: financeKeys.realAssets() })
    qc.invalidateQueries({ queryKey: combinedNetWorthKeys.all })
  }
}

/** Add (no id) or edit an asset; a changed value is recorded for today. */
export function useSaveRealAsset() {
  const refresh = useRefreshAfter()
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<RealAssetInput> & { id?: string }) =>
      id
        ? financeFetch(`/real-assets/${id}`, { method: "PATCH", body: JSON.stringify(input) })
        : financeFetch("/real-assets", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: refresh,
    onError: (err: Error) => toast.error(`Couldn't save: ${err.message}`),
  })
}

export function useDeleteRealAsset() {
  const refresh = useRefreshAfter()
  return useMutation({
    mutationFn: (id: string) => financeFetch(`/real-assets/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
    onError: (err: Error) => toast.error(`Couldn't delete: ${err.message}`),
  })
}
