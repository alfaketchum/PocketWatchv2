/**
 * Heuristics for the account directory: the Gmail search that selects candidate
 * "you have an account here" emails, plus a cheap classifier that turns one
 * message into a heuristic account signal (or rejects it).
 *
 * This is the free, no-LLM half of the hybrid pipeline. `classifySignal` is the
 * candidate gate: it returns null for mail that does not look like an account
 * signal, so the (paid) LLM extractor only runs on plausible messages.
 */

import { registrableDomain } from "./account-hash"
import type { GmailMessage } from "@/lib/integrations/gmail-client"

export type SignalType =
  | "welcome"
  | "verify"
  | "password_reset"
  | "security_alert"
  | "receipt"

export interface HeuristicSignal {
  signalType: SignalType
  serviceName: string
  serviceDomain: string
  confidence: number
}

/**
 * Gmail query for account-signal emails across the last few years. Joined-array
 * style mirrors TRAVEL_QUERY in email-trip-parser.ts.
 */
export const ACCOUNT_SIGNAL_QUERY = [
  "newer_than:3y",
  "(",
  'subject:("verify your email" OR "confirm your email" OR "verify your account"',
  'OR "confirm your account" OR "welcome to" OR "account created"',
  'OR "activate your account" OR "reset your password" OR "password reset"',
  'OR "new sign-in" OR "new sign in" OR "new login" OR "security alert"',
  'OR "your account")',
  "OR from:(no-reply OR noreply OR no_reply OR donotreply OR accounts OR security OR account)",
  ")",
].join(" ")

// Subject keyword → signal type. Order matters: first match wins.
const SUBJECT_RULES: ReadonlyArray<{ type: SignalType; re: RegExp }> = [
  { type: "verify", re: /\b(verify|confirm|activate)\b.*\b(email|account|address)\b/i },
  { type: "verify", re: /\bverification code\b/i },
  { type: "password_reset", re: /\b(reset|change|forgot).*(password)\b/i },
  { type: "security_alert", re: /\b(new sign[\s-]?in|new login|security alert|unusual|suspicious|was your device)\b/i },
  { type: "welcome", re: /\b(welcome to|account created|thanks for (signing up|joining)|get started)\b/i },
  { type: "receipt", re: /\b(receipt|your order|order confirmation|payment (received|confirmation)|invoice)\b/i },
]

const SENDER_HINT = /(no-?reply|no_reply|donotreply|accounts?|security|notifications?|team|hello|support)@/i

// Noise words to strip from a sender display name when deriving a service name.
const NAME_NOISE = /\b(no-?reply|team|account|accounts|security|support|notifications?|the|inc|llc|customer care)\b/gi

/** Best-effort service display name from the sender, falling back to the domain. */
function serviceNameFrom(from: string, domain: string): string {
  const display = from.split("<")[0].replace(/["']/g, "").trim()
  const cleaned = display.replace(NAME_NOISE, "").replace(/\s{2,}/g, " ").trim()
  if (cleaned && !cleaned.includes("@") && cleaned.length >= 2) {
    return cleaned.slice(0, 60)
  }
  const label = domain.split(".")[0]
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : domain
}

/**
 * Classify a message as a heuristic account signal, or return null when it does
 * not look like one (the candidate gate for the LLM stage).
 */
export function classifySignal(msg: GmailMessage): HeuristicSignal | null {
  const domain = registrableDomain(msg.from)
  if (!domain) return null

  const subject = msg.subject ?? ""
  const matched = SUBJECT_RULES.find((rule) => rule.re.test(subject))
  const senderLooksTransactional = SENDER_HINT.test(msg.from)

  // Need either a signal subject or a transactional sender — otherwise it is
  // likely a newsletter/marketing email, not an account signal.
  if (!matched && !senderLooksTransactional) return null

  const signalType: SignalType = matched?.type ?? "welcome"
  const confidence = matched ? (senderLooksTransactional ? 0.7 : 0.55) : 0.4

  return {
    signalType,
    serviceName: serviceNameFrom(msg.from, domain),
    serviceDomain: domain,
    confidence,
  }
}
