"use client"

import { useGmailAccounts } from "@/hooks/accounts"
import { FinancePageHeader } from "@/components/finance/finance-page-header"
import { AccountsTabs } from "@/components/accounts/accounts-tabs"
import { SendersScanButton } from "@/components/accounts/senders/senders-scan-button"
import { SendersList } from "@/components/accounts/senders/senders-list"

export default function SendersPage() {
  const { data: gmailAccounts } = useGmailAccounts()
  const hasGmail = (gmailAccounts?.length ?? 0) > 0

  return (
    <div className="space-y-6 py-6">
      <FinancePageHeader
        title="Email Accounts"
        subtitle="Mailing lists in your inboxes, ranked by how much they send"
        actions={hasGmail ? <SendersScanButton /> : undefined}
      />
      <AccountsTabs />
      <SendersList hasGmail={hasGmail} />
    </div>
  )
}
