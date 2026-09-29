"use client"

import { useEffect } from "react"
import { toast } from "sonner"
import { useGmailAccounts, useScanAccounts } from "@/hooks/accounts"
import { FinancePageHeader } from "@/components/finance/finance-page-header"
import { GmailAccountsBar } from "@/components/trips/gmail-accounts-bar"
import { AccountsDirectory } from "@/components/accounts/accounts-directory"

const GMAIL_CONNECT_MESSAGES: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "Gmail account connected" },
  denied: { ok: false, text: "Gmail access was not granted" },
  expired: { ok: false, text: "Gmail sign-in link expired — please try again" },
  error: { ok: false, text: "Couldn't connect Gmail — please try again" },
}

export default function AccountsPage() {
  const { data: gmailAccounts } = useGmailAccounts()
  const scan = useScanAccounts()

  // Surface the OAuth callback result (?gmail=...), then drop it from the URL.
  useEffect(() => {
    const url = new URL(window.location.href)
    const message = GMAIL_CONNECT_MESSAGES[url.searchParams.get("gmail") ?? ""]
    if (!message) return
    if (message.ok) toast.success(message.text)
    else toast.error(message.text)
    url.searchParams.delete("gmail")
    window.history.replaceState(null, "", url.pathname + url.search)
  }, [])

  const hasGmail = (gmailAccounts?.length ?? 0) > 0

  const handleScan = () => {
    scan.mutate(undefined, {
      onSuccess: (result) => {
        const found = result.imported + result.updated
        toast.success(
          found > 0
            ? `Found ${result.imported} new and updated ${result.updated} account${result.updated === 1 ? "" : "s"}`
            : "No new logins found in your email",
        )
      },
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "Failed to scan Gmail"),
    })
  }

  return (
    <div className="py-6 space-y-6">
      <FinancePageHeader
        title="Accounts"
        subtitle="Which email you used to sign up for each service"
        actions={
          hasGmail ? (
            <button onClick={handleScan} disabled={scan.isPending} className="btn-secondary">
              <span
                className={`material-symbols-rounded ${scan.isPending ? "animate-spin" : ""}`}
                style={{ fontSize: 16 }}
                aria-hidden="true"
              >
                {scan.isPending ? "progress_activity" : "search"}
              </span>
              {scan.isPending ? "Scanning…" : "Scan Gmail"}
            </button>
          ) : (
            <a href="/api/integrations/gmail/connect" className="btn-secondary">
              <span className="material-symbols-rounded" style={{ fontSize: 16 }} aria-hidden="true">
                mail
              </span>
              Connect Gmail
            </a>
          )
        }
      />

      {hasGmail && <GmailAccountsBar accounts={gmailAccounts ?? []} />}

      <AccountsDirectory hasGmail={hasGmail} onScan={handleScan} isScanning={scan.isPending} />
    </div>
  )
}
