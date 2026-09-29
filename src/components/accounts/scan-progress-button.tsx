"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import type { AccountScanStatus } from "@/hooks/accounts"

interface ScanProgressButtonProps {
  label: string
  status: AccountScanStatus | undefined
  isStarting: boolean
  onStart: () => void
  /** Toast text when a scan this button watched finishes successfully. */
  summarize: (status: AccountScanStatus) => string
  /** Called once when a watched scan finishes (e.g. to refresh lists). */
  onFinished: () => void
}

/**
 * Button for a background Gmail scan: shows live progress while it runs, then
 * toasts a summary (or the error) and calls onFinished.
 */
export function ScanProgressButton({ label, status, isStarting, onStart, summarize, onFinished }: ScanProgressButtonProps) {
  const isScanning = isStarting || status?.state === "running"

  const wasRunning = useRef(false)
  useEffect(() => {
    if (!status) return
    if (status.state === "running") {
      wasRunning.current = true
      return
    }
    if (!wasRunning.current) return
    wasRunning.current = false
    onFinished()
    if (status.state === "error") toast.error(status.error ?? "Gmail scan failed")
    else toast.success(summarize(status))
  }, [status, onFinished, summarize])

  return (
    <button onClick={onStart} disabled={isScanning} className="btn-secondary">
      <span
        className={`material-symbols-rounded ${isScanning ? "animate-spin" : ""}`}
        style={{ fontSize: 16 }}
        aria-hidden="true"
      >
        {isScanning ? "progress_activity" : "search"}
      </span>
      {isScanning ? `Scanning… ${status?.scanned ?? 0} emails` : label}
    </button>
  )
}
