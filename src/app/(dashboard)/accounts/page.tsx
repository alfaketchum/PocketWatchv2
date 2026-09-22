"use client"

import { toast } from "sonner"
import { useGmailAccounts, useScanAccounts } from "@/hooks/accounts"
import { FinancePageHeader } from "@/components/finance/finance-page-header"
import { GmailAccountsBar } from "@/components/trips/gmail-accounts-bar"
import { AccountsDirectory } from "@/components/accounts/accounts-directory"

export default function AccountsPage() {
  const { data: gmailAccounts } = useGmailAccounts()
  const scan = useScanAccounts()

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
