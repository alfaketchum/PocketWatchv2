"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { Bureau, CardUtilization, ScoreModel } from "@/lib/finance/credit-scores"
import { financeFetch, financeKeys } from "./shared"

export interface CreditScoreItem {
  id: string
  score: number
  model: ScoreModel
  bureau: Bureau | null
  /** ISO date. */
  date: string
  note: string | null
}

export interface CreditScoresResponse {
  scores: CreditScoreItem[]
  utilization: { overall: number | null; cards: CardUtilization[] }
}

export interface CreditScoreDraft {
  score: number
  model: ScoreModel
  bureau: Bureau | null
  date: string
  note: string | null
}

/** Logged credit scores, newest first, and today's card utilization. */
export function useCreditScores() {
  return useQuery({
    queryKey: financeKeys.creditScores(),
    queryFn: () => financeFetch<CreditScoresResponse>("/credit-scores"),
  })
}

/** Log a score (no id) or correct one. */
export function useSaveCreditScore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: CreditScoreDraft & { id?: string }) =>
      id
        ? financeFetch(`/credit-scores/${id}`, { method: "PATCH", body: JSON.stringify(input) })
        : financeFetch("/credit-scores", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: financeKeys.creditScores() })
      toast.success(vars.id ? "Score updated" : "Score logged")
    },
    onError: (err: Error) => toast.error(`Couldn't save: ${err.message}`),
  })
}

export function useDeleteCreditScore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => financeFetch(`/credit-scores/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.creditScores() })
      toast.success("Score deleted")
    },
    onError: (err: Error) => toast.error(`Couldn't delete: ${err.message}`),
  })
}
