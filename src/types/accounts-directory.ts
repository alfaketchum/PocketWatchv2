/**
 * Accounts directory v2 — one row per online service, joined to finance data.
 * Shared by /api/accounts/directory and the Accounts page.
 */

export type PaidWithSource = "manual" | "receipt" | "subscription" | "transactions"
export type DirectoryLinkFilter = "all" | "linked" | "unlinked"
export type DirectorySignalType =
  | "welcome"
  | "verify"
  | "password_reset"
  | "security_alert"
  | "receipt"

export interface DirectoryPaidWith {
  accountId: string
  name: string
  mask: string | null
  institution: string
  source: PaidWithSource
}

export interface DirectoryRecurring {
  merchantName: string
  amount: number
  frequency: string
  nextChargeDate: string | null
}

export interface DirectoryFinance {
  paidWith: DirectoryPaidWith[]
  recurring: DirectoryRecurring | null
  lastChargeDate: string | null
  spend12m: number
  /** Set when the service is itself one of your banks, card issuers or exchanges. */
  institution: string | null
}

export interface DirectoryEmail {
  id: string
  email: string
  signalTypes: DirectorySignalType[]
  lastSeenAt: string | null
  firstSeenAt: string | null
  paymentBrand: string | null
  paymentLast4: string | null
  paymentAccountId: string | null
  evidence: { subject: string; from: string } | null
}

export interface DirectoryService {
  /** Primary domain — the service's stable key. */
  domain: string
  /** Every sender domain merged into this service (same brand name). */
  domains: string[]
  name: string
  category: string | null
  status: "active" | "dismissed"
  emails: DirectoryEmail[]
  finance: DirectoryFinance
}

export interface DirectoryFacetOption {
  value: string
  label: string
  count: number
}

export interface DirectoryFacets {
  emails: DirectoryFacetOption[]
  cards: DirectoryFacetOption[]
  categories: DirectoryFacetOption[]
}

export interface DirectoryResponse {
  services: DirectoryService[]
  total: number
  page: number
  limit: number
  facets: DirectoryFacets
  /** Every card / bank account, for the "paid with" picker. */
  paymentAccounts: DirectoryPaymentAccount[]
}

/** A recurring charge with no service in the directory — which email is it on? */
export interface MissingEmailService {
  merchantName: string
  domain: string | null
  amount: number
  frequency: string
  nextChargeDate: string | null
  paidWith: DirectoryPaidWith | null
  /** None of the connected inboxes has mail from this merchant. */
  notInInbox: boolean
}

export interface MissingEmailResponse {
  services: MissingEmailService[]
}

export interface FinanceLinkResponse {
  checked: number
  linked: number
  notFound: number
}

/** A card or bank account the user can pick as "paid with". */
export interface DirectoryPaymentAccount {
  id: string
  name: string
  mask: string | null
  institution: string
  type: string
}
