/** Unsubscribe manager — mailing-list senders found via List-Unsubscribe headers. */

export type SenderStatus = "active" | "unsubscribed" | "kept"
export type UnsubscribeMethod = "one_click" | "link" | "mailto"

export interface MailSenderRow {
  id: string
  mailbox: string | null
  senderEmail: string
  senderDomain: string
  displayName: string
  messageCount: number
  firstSeenAt: string | null
  lastSeenAt: string | null
  /** Best available way to unsubscribe (one-click > link > mailto). */
  method: UnsubscribeMethod | null
  unsubscribeUrl: string | null
  unsubscribeMailto: string | null
  status: SenderStatus
  unsubscribedAt: string | null
  /** Unsubscribed, but mail has kept arriving since. */
  stillSending: boolean
  /** You have an account with this sender's domain (from the directory). */
  isAccount: boolean
  /**
   * Still subscribed, but you unsubscribed from another address at the same
   * domain in this inbox — likely the same sender under a new From address.
   */
  relatedUnsubscribed: boolean
  lastError: string | null
}

export interface MailSendersResponse {
  senders: MailSenderRow[]
  total: number
  page: number
  limit: number
  mailboxes: { email: string; count: number }[]
}

export interface BulkUnsubscribeResponse {
  results: { id: string; ok: boolean; error: string | null }[]
}
