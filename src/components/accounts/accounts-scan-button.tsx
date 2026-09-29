"use client"

import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { accountKeys, useScanAccounts, useScanStatus, type AccountScanStatus } from "@/hooks/accounts"
import { ScanProgressButton } from "./scan-progress-button"

function summarize(status: AccountScanStatus): string {
  const more = status.backfillComplete ? "" : " — older mail continues on the next scan"
  return `Scanned ${status.scanned} emails: ${status.imported} new, ${status.updated} updated${more}`
}

/** "Scan Gmail" for the account directory. */
export function AccountsScanButton() {
  const qc = useQueryClient()
  const scan = useScanAccounts()
  const { data } = useScanStatus()
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: accountKeys.all }), [qc])

  const start = () =>
    scan.mutate(undefined, {
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to start Gmail scan"),
    })

  return (
    <ScanProgressButton
      label="Scan Gmail"
      status={data?.status}
      isStarting={scan.isPending}
      onStart={start}
      summarize={summarize}
      onFinished={refresh}
    />
  )
}
