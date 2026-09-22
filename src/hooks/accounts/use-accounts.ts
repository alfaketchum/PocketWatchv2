/**
 * Account directory hooks — list, scan, and per-account update.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  accountKeys,
  accountsFetch,
  accountsQuery,
  type AccountFilters,
  type AccountListResponse,
  type AccountScanResult,
  type AccountStatus,
  type DiscoveredAccount,
} from "./shared"

export interface UpdateAccountInput {
  id: string
  status?: AccountStatus
  serviceName?: string
  category?: string | null
  accountEmail?: string
}

/** Paginated, filterable list of discovered accounts. */
export function useAccounts(filters: AccountFilters = {}) {
  return useQuery({
    queryKey: accountKeys.list(filters),
    queryFn: () => accountsFetch<AccountListResponse>(accountsQuery(filters)),
    refetchOnMount: true,
  })
}

/** Scan connected Gmail for account signals and refresh the directory. */
export function useScanAccounts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      accountsFetch<AccountScanResult>("/scan", { method: "POST", timeoutMs: 120_000 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.all }),
  })
}

/** Dismiss/restore or edit a discovered account. */
export function useUpdateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: UpdateAccountInput) =>
      accountsFetch<{ account: DiscoveredAccount }>(`/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.all }),
  })
}

/** Permanently delete a discovered account. */
export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      accountsFetch<{ deleted: boolean }>(`/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.all }),
  })
}
