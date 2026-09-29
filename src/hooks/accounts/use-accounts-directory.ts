/**
 * Accounts directory v2 — services joined to finance data, the "no email found"
 * list, and manual additions.
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { DirectoryResponse, MissingEmailResponse } from "@/types/accounts-directory"
import { accountKeys, accountsFetch, accountsQuery, type DirectoryFilters } from "./shared"

/** One page of services with emails, "paid with" and recurring cost. */
export function useAccountsDirectory(filters: DirectoryFilters) {
  return useQuery({
    queryKey: accountKeys.directory(filters),
    queryFn: () => accountsFetch<DirectoryResponse>(`/directory${accountsQuery(filters)}`),
    placeholderData: keepPreviousData,
  })
}

/** Recurring charges that no directory service accounts for. */
export function useMissingEmailServices() {
  return useQuery({
    queryKey: accountKeys.missingEmail(),
    queryFn: () => accountsFetch<MissingEmailResponse>("/missing-email"),
  })
}

export interface CreateAccountInput {
  serviceName: string
  serviceDomain: string
  accountEmail: string
  category?: string | null
  paymentAccountId?: string | null
}

/** Add a service/email pair by hand. */
export function useCreateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateAccountInput) =>
      accountsFetch<{ account: { id: string } }>("", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.all }),
  })
}
