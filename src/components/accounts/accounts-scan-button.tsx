"use client"

import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { accountKeys, useScanAccounts, useScanStatus } from "@/hooks/accounts"

/**
 * "Scan Gmail" button: starts a background scan, shows live progress while it
 * runs, then toasts a summary and refreshes the directory when it finishes.
 */
export function AccountsScanButton() {
  const qc = useQueryClient()
  const scan = useScanAccounts()
  const { data } = useScanStatus()
  const status = data?.status
  const isScanning = scan.isPending || status?.state === "running"

  const wasRunning = useRef(false)
  useEffect(() => {
    if (!status) return
    if (status.state === "running") {
      wasRunning.current = true
      return
    }
    if (!wasRunning.current) return
    wasRunning.current = false
    qc.invalidateQueries({ queryKey: accountKeys.all })
    if (status.state === "error") {
      toast.error(status.error ?? "Gmail scan failed")
      return
    }
    const more = status.backfillComplete ? "" : " — older mail continues on the next scan"
    toast.success(
      `Scanned ${status.scanned} emails: ${status.imported} new, ${status.updated} updated${more}`,
    )
  }, [status, qc])

  const handleScan = () => {
    scan.mutate(undefined, {
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "Failed to start Gmail scan"),
    })
  }

  return (
    <button onClick={handleScan} disabled={isScanning} className="btn-secondary">
      <span
        className={`material-symbols-rounded ${isScanning ? "animate-spin" : ""}`}
        style={{ fontSize: 16 }}
        aria-hidden="true"
      >
        {isScanning ? "progress_activity" : "search"}
      </span>
      {isScanning ? `Scanning… ${status?.scanned ?? 0} emails` : "Scan Gmail"}
    </button>
  )
}
