/**
 * Unsubscribe manager hooks — sender list, sender scan, and unsubscribe actions.
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  BulkUnsubscribeResponse,
  MailSendersResponse,
  SenderStatus,
} from "@/types/mail-senders"
import {
  accountKeys,
  accountsFetch,
  accountsQuery,
  type AccountScanStatus,
  type SenderFilters,
} from "./shared"

const POLL_INTERVAL_MS = 2_000
const senderKeysRoot = [...accountKeys.all, "senders"] as const

export function useMailSenders(filters: SenderFilters) {
  return useQuery({
    queryKey: accountKeys.senders(filters),
    queryFn: () => accountsFetch<MailSendersResponse>(`/senders${accountsQuery(filters)}`),
    placeholderData: keepPreviousData,
  })
}

/** Sender-scan progress; polls while a scan is running. */
export function useSenderScanStatus() {
  return useQuery({
    queryKey: accountKeys.senderScanStatus(),
    queryFn: () => accountsFetch<{ status: AccountScanStatus }>("/senders/scan"),
    refetchInterval: (query) =>
      query.state.data?.status.state === "running" ? POLL_INTERVAL_MS : false,
  })
}

export function useScanSenders() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => accountsFetch<{ status: AccountScanStatus }>("/senders/scan", { method: "POST" }),
    onSuccess: (data) => qc.setQueryData(accountKeys.senderScanStatus(), data),
  })
}

/** One-click (server-side) unsubscribe for one or more senders. */
export function useUnsubscribeSenders() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) =>
      accountsFetch<BulkUnsubscribeResponse>("/senders/unsubscribe", {
        method: "POST",
        body: JSON.stringify({ ids }),
        timeoutMs: 120_000,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: senderKeysRoot }),
  })
}

export interface UpdateSenderInput {
  id: string
  status: SenderStatus
  method?: "link" | "mailto"
}

/** Mark unsubscribed (after a link / mailto), keep, or restore a sender. */
export function useUpdateSender() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateSenderInput) =>
      accountsFetch<{ sender: { id: string; status: SenderStatus } }>(`/senders/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: senderKeysRoot }),
  })
}
