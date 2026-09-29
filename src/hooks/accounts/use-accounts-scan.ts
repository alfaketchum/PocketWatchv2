/**
 * Account directory Gmail scan — start a background scan and poll its progress.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  accountKeys,
  accountsFetch,
  type AccountScanInfo,
  type AccountScanStatus,
} from "./shared"

const POLL_INTERVAL_MS = 2_000

/** Scan progress; polls while a scan is running. */
export function useScanStatus() {
  return useQuery({
    queryKey: accountKeys.scanStatus(),
    queryFn: () => accountsFetch<AccountScanInfo>("/scan"),
    refetchInterval: (query) =>
      query.state.data?.status.state === "running" ? POLL_INTERVAL_MS : false,
  })
}

/** Start a background Gmail scan; progress then flows through useScanStatus. */
export function useScanAccounts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      accountsFetch<{ status: AccountScanStatus }>("/scan", { method: "POST" }),
    onSuccess: ({ status }) => {
      qc.setQueryData<AccountScanInfo>(accountKeys.scanStatus(), (prev) => ({
        connected: prev?.connected ?? true,
        status,
      }))
    },
  })
}
