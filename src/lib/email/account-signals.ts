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

/** How far back the backfill reaches. Old signup emails are the best "which email" evidence. */
export const SCAN_WINDOW = "newer_than:10y"
/** Gmail search page size for untimed (interactive) scans; Gmail allows up to 500. */
export const SCAN_PAGE_SIZE = 100
/**
 * Page size under a time budget (the scheduled worker). The deadline is checked
 * between pages, so smaller pages keep the overshoot to a few LLM calls.
 */
export const SCAN_PAGE_SIZE_TIMED = 25
/** Messages per mailbox per run (incremental + backfill share this budget). */
export const SCAN_MAX_MESSAGES_PER_RUN = 1_000
/** LLM calls per run; beyond this, messages fall back to the heuristic result. */
export const SCAN_MAX_LLM_CALLS_PER_RUN = 400
/** Messages fetched + extracted concurrently within a page. */
export const SCAN_CONCURRENCY = 4

/**
 * Subject-only search for account-signal and billing emails. There is deliberately
 * no broad `from:(no-reply …)` branch: it let newsletters crowd out real signals.
 * The time bound (SCAN_WINDOW or an `after:` watermark) is prepended by the caller.
 */
export const ACCOUNT_SIGNAL_QUERY = [
  'subject:("verify your email" OR "confirm your email" OR "verify your account"',
  'OR "confirm your account" OR "welcome to" OR "account created"',
  'OR "activate your account" OR "reset your password" OR "password reset"',
  'OR "new sign-in" OR "new sign in" OR "new login" OR "security alert"',
  'OR "your account" OR receipt OR "your order" OR "payment received"',
  'OR invoice OR subscription OR renewal OR "your plan" OR billing OR trial)',
].join(" ")

/**
 * Relay domains: mail from these is sent ON BEHALF of another brand, so the sender
 * domain must not be the group key — the LLM's brand domain is used instead.
 * Covers bulk-email providers (ESPs), payment processors that send merchants'
 * receipts, and personal mailbox providers (a person emailing from gmail.com).
 */
const RELAY_DOMAINS = new Set([
  // Email service providers
  "sendgrid.net", "amazonses.com", "mcsv.net", "mcdlv.net", "mailchimpapp.net",
  "mandrillapp.com", "mailgun.org", "mailgun.net", "sparkpostmail.com",
  "postmarkapp.com", "hubspotemail.net", "hs-email.net", "exacttarget.com",
  "salesforce.com", "klaviyomail.com", "braze.com", "customeriomail.com",
  "intercom-mail.com", "zendesk.com", "freshdesk.com",
  // Payment processors / merchant-of-record platforms
  "stripe.com", "paddle.com", "squareup.com", "lemonsqueezy.com", "gumroad.com",
  "chargebee.com", "recurly.com", "fastspring.com", "flowglad.com",
  // Personal mailbox and shared Google/Microsoft senders (forms, calendar)
  "gmail.com", "googlemail.com", "google.com", "outlook.com", "hotmail.com",
  "live.com", "yahoo.com", "icloud.com", "me.com", "aol.com", "proton.me",
  "protonmail.com",
])

export function isRelayDomain(domain: string): boolean {
  return RELAY_DOMAINS.has(domain)
}

export const RELAY_DOMAIN_LIST: readonly string[] = [...RELAY_DOMAINS]

// Subject keyword → signal type. Order matters: first match wins.
const SUBJECT_RULES: ReadonlyArray<{ type: SignalType; re: RegExp }> = [
  { type: "verify", re: /\b(verify|confirm|activate)\b.*\b(email|account|address)\b/i },
  { type: "verify", re: /\bverification code\b/i },
  { type: "password_reset", re: /\b(reset|change|forgot).*(password)\b/i },
  { type: "security_alert", re: /\b(new sign[\s-]?in|new login|security alert|unusual|suspicious|was your device)\b/i },
  { type: "welcome", re: /\b(welcome to|account created|thanks for (signing up|joining)|get started)\b/i },
  { type: "receipt", re: /\b(receipt|your order|order confirmation|payment (received|confirmation)|invoice|subscription|renew(al|ed|s)?|your plan|billing|trial)\b/i },
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

export interface PaymentHint {
  brand: string | null
  last4: string
}

const BRAND_PATTERNS: ReadonlyArray<{ brand: string; re: RegExp }> = [
  { brand: "amex", re: /\b(amex|american express)\b/i },
  { brand: "visa", re: /\bvisa\b/i },
  { brand: "mastercard", re: /\b(mastercard|master card|mc)\b/i },
  { brand: "discover", re: /\bdiscover\b/i },
]

// "ending in 1234", "ends with 1234", "**** 1234", "xxxx-1234", "•••• 1234"
const LAST4_RE = /(?:ending(?:\s+(?:in|with))?|ends\s+(?:in|with)|[*x•·]{2,}[\s-]*)\s*(\d{4})\b/i

/**
 * Heuristic card detection from a receipt body ("Visa ending in 1234"). The brand
 * is taken from the text just before the digits. Returns null when no last-4 is found.
 */
export function detectPayment(body: string): PaymentHint | null {
  const match = LAST4_RE.exec(body)
  if (!match) return null
  const context = body.slice(Math.max(0, match.index - 40), match.index + match[0].length)
  const brand = BRAND_PATTERNS.find((p) => p.re.test(context))?.brand ?? null
  return { brand, last4: match[1] }
}
