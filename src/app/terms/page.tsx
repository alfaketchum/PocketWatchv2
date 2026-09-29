import type { Metadata } from "next"
import { APP_NAME } from "@/lib/brand"
import { LegalPage, type LegalSection } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: `Terms of Service — ${APP_NAME}`,
}

const LAST_UPDATED = "September 29, 2026"

const SECTIONS: LegalSection[] = [
  {
    heading: "About this service",
    body: [
      `${APP_NAME} is a privately operated, self-hosted personal finance tracker. Access is limited to people the operator has given an account. By using it, you agree to these terms.`,
    ],
  },
  {
    heading: "Your account",
    body: [
      "You are responsible for keeping your login credentials secure and for activity under your account. Only connect bank, exchange, wallet, or email accounts that you own or are authorized to access.",
    ],
  },
  {
    heading: "Connected services",
    body: [
      `${APP_NAME} reads data from third-party services you choose to connect, such as Google (Gmail), Plaid, exchanges, and blockchain data providers. Your use of those services is also governed by their own terms. You can disconnect any of them at any time.`,
    ],
  },
  {
    heading: "Not financial advice",
    body: [
      `Balances, charts, categorizations, and AI-generated answers are provided for information only and may be incomplete, delayed, or inaccurate. Nothing in ${APP_NAME} is financial, tax, or investment advice. Verify important figures with the original institution.`,
    ],
  },
  {
    heading: "No warranty",
    body: [
      `${APP_NAME} is provided "as is", without warranties of any kind. The operator is not liable for any loss or damage arising from its use, including data loss, service interruptions, or decisions made based on its data.`,
    ],
  },
  {
    heading: "Privacy",
    body: [
      "How data is collected, used, and stored — including data from Google APIs — is described in the Privacy Policy.",
    ],
  },
  {
    heading: "Changes and termination",
    body: [
      "These terms may be updated from time to time; the date above reflects the latest version. The operator may suspend or remove accounts, and you may stop using the service and request deletion of your data at any time.",
    ],
  },
]

export default function TermsPage() {
  return <LegalPage title="Terms of Service" lastUpdated={LAST_UPDATED} sections={SECTIONS} />
}
