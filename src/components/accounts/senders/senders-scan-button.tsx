"use client"

import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { accountKeys, useScanSenders, useSenderScanStatus, type AccountScanStatus } from "@/hooks/accounts"
import { ScanProgressButton } from "../scan-progress-button"

function summarize(status: AccountScanStatus): string {
  return `Checked ${status.scanned} emails: ${status.imported} new senders, ${status.updated} updated`
}

/** "Scan senders" — headers-only scan for mailing-list mail. */
export function SendersScanButton() {
  const qc = useQueryClient()
  const scan = useScanSenders()
  const { data } = useSenderScanStatus()
  const refresh = useCallback(
    () => qc.invalidateQueries({ queryKey: [...accountKeys.all, "senders"] }),
    [qc],
  )

  const start = () =>
    scan.mutate(undefined, {
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to start sender scan"),
    })

  return (
    <ScanProgressButton
      label="Scan senders"
      status={data?.status}
      isStarting={scan.isPending}
      onStart={start}
      summarize={summarize}
      onFinished={refresh}
    />
  )
}
