/**
 * Deterministic helpers for the account directory.
 *
 * `hashAccountEmail` produces a stable HMAC of an email address so it can be
 * used in a unique index and equality filter — the encrypted `accountEmail`
 * column cannot, because field encryption uses a random IV (non-deterministic
 * ciphertext). The HMAC is keyed with a server secret and is never reversible.
 *
 * `registrableDomain` reduces a raw `From` header to a groupable domain
 * (e.g. "Netflix <no-reply@e.netflix.com>" → "netflix.com").
 */

import { createHmac } from "crypto"

/** HMAC key: dedicated secret if set, else the shared encryption key. */
function hashKey(): string {
  const key = process.env.ACCOUNTS_EMAIL_HASH_KEY ?? process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error(
      "ACCOUNTS_EMAIL_HASH_KEY (or ENCRYPTION_KEY) not configured. Generate with: openssl rand -hex 32",
    )
  }
  return key
}

/** Stable, non-reversible hash of an email (case/whitespace-insensitive). */
export function hashAccountEmail(email: string): string {
  const normalized = email.trim().toLowerCase()
  return createHmac("sha256", hashKey()).update(normalized).digest("hex")
}

// A small set of multi-label public suffixes so we don't collapse e.g.
// "foo.co.uk" down to "co.uk". Not exhaustive — just the common ones.
const MULTI_LABEL_TLDS = new Set([
  "co.uk", "org.uk", "gov.uk", "ac.uk", "co.jp", "co.nz", "co.za",
  "com.au", "com.br", "com.mx", "com.sg", "com.hk",
])

/** Extract the bare email address from a `From` header value. */
function emailFromHeader(from: string): string {
  const angle = from.match(/<([^>]+)>/)
  const candidate = (angle ? angle[1] : from).trim().toLowerCase()
  const at = candidate.lastIndexOf("@")
  return at >= 0 ? candidate.slice(at + 1) : ""
}

/**
 * Reduce a `From` header to a registrable domain suitable for grouping.
 * Returns "" when no domain can be parsed.
 */
export function registrableDomain(from: string): string {
  const host = emailFromHeader(from).replace(/[^a-z0-9.-]/g, "")
  if (!host) return ""

  const labels = host.split(".").filter(Boolean)
  if (labels.length <= 2) return labels.join(".")

  const lastTwo = labels.slice(-2).join(".")
  const lastThree = labels.slice(-3).join(".")
  return MULTI_LABEL_TLDS.has(lastTwo) ? lastThree : lastTwo
}
