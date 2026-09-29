import type { Metadata } from "next"
import { APP_NAME } from "@/lib/brand"
import { LegalPage, type LegalSection } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: `Privacy Policy — ${APP_NAME}`,
}

const LAST_UPDATED = "September 29, 2026"
const GOOGLE_USER_DATA_POLICY_URL =
  "https://developers.google.com/terms/api-services-user-data-policy"

const SECTIONS: LegalSection[] = [
  {
    heading: "What FuegoTracker is",
    body: [
      `${APP_NAME} is a privately operated personal finance tracker. It is not a commercial service; accounts exist only for the people who run and use this instance.`,
    ],
  },
  {
    heading: "Gmail data we access",
    body: [
      "When you choose to connect a Google account, FuegoTracker requests read-only access to Gmail (the gmail.readonly scope) and your basic account identity. It cannot send, delete, or modify email.",
      "FuegoTracker searches for specific kinds of messages: sign-up and account notification emails (to build a directory of which email address you used for each service) and travel confirmations such as flight, hotel, and car bookings (to import trips).",
    ],
  },
  {
    heading: "How that data is used",
    body: [
      "Matching messages are read to extract account and trip details, which are saved to your FuegoTracker account. Full email bodies are not stored; for the account directory, the subject, sender, and a short snippet are kept (encrypted) as evidence of where each entry came from.",
      "If you have configured an AI provider in FuegoTracker (Anthropic Claude, OpenAI, or Google Gemini), the subject and text of matching messages are sent to that provider solely to extract those details. Trip import requires an AI provider; the account directory falls back to a local rule-based parser without one.",
      "Gmail data is never sold, never used for advertising, and never shared with anyone other than the AI provider you configure for the purpose above.",
    ],
  },
  {
    heading: "Storage and security",
    body: [
      "Google access and refresh tokens are encrypted at rest with a per-user key. All data is stored in a private database on the server that hosts this instance.",
    ],
  },
  {
    heading: "Disconnecting and deletion",
    body: [
      "You can disconnect a Google account at any time from the Accounts page, which deletes its stored tokens. You can also revoke access from your Google account at myaccount.google.com/permissions. To have extracted data deleted, contact the operator of this instance.",
    ],
  },
]

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated={LAST_UPDATED} sections={SECTIONS}>
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Google API Services User Data Policy</h2>
        <p className="text-sm leading-relaxed text-foreground-muted">
          {APP_NAME}&apos;s use and transfer of information received from Google APIs adheres
          to the{" "}
          <a href={GOOGLE_USER_DATA_POLICY_URL} className="text-accent hover:underline">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
      </section>
    </LegalPage>
  )
}
