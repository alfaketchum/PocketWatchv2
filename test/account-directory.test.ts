import test from "node:test"
import assert from "node:assert/strict"

// Deterministic HMAC key for hashAccountEmail (read at call time, so setting it
// here is enough). 64 hex chars.
process.env.ACCOUNTS_EMAIL_HASH_KEY =
  "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"

import { hashAccountEmail, registrableDomain } from "@/lib/email/account-hash"
import { classifySignal } from "@/lib/email/account-signals"
import type { GmailMessage } from "@/lib/integrations/gmail-client"

function msg(p: Partial<GmailMessage>): GmailMessage {
  return { id: "m1", subject: "", from: "", date: "", bodyText: "body", ...p }
}

// ─── hashAccountEmail ───

test("hashAccountEmail: deterministic and case/whitespace-insensitive", () => {
  const a = hashAccountEmail("User@Example.com")
  const b = hashAccountEmail("  user@example.com  ")
  assert.equal(a, b)
  assert.match(a, /^[0-9a-f]{64}$/)
})

test("hashAccountEmail: different emails hash differently", () => {
  assert.notEqual(hashAccountEmail("a@x.com"), hashAccountEmail("b@x.com"))
})

// ─── registrableDomain ───

test("registrableDomain: strips subdomains and display name", () => {
  assert.equal(registrableDomain("Netflix <no-reply@e.netflix.com>"), "netflix.com")
  assert.equal(registrableDomain("support@github.com"), "github.com")
  assert.equal(registrableDomain("user@example.com"), "example.com")
})

test("registrableDomain: keeps multi-label public suffixes", () => {
  assert.equal(registrableDomain("Foo <bar@mail.foo.co.uk>"), "foo.co.uk")
})

test("registrableDomain: returns empty when no domain", () => {
  assert.equal(registrableDomain("not an address"), "")
})

// ─── classifySignal ───

test("classifySignal: welcome email → welcome signal", () => {
  const s = classifySignal(msg({ from: "Netflix <no-reply@netflix.com>", subject: "Welcome to Netflix" }))
  assert.ok(s)
  assert.equal(s?.signalType, "welcome")
  assert.equal(s?.serviceDomain, "netflix.com")
  assert.equal(s?.serviceName, "Netflix")
})

test("classifySignal: verify + reset + security subjects", () => {
  assert.equal(
    classifySignal(msg({ from: "a@spotify.com", subject: "Verify your email address" }))?.signalType,
    "verify",
  )
  assert.equal(
    classifySignal(msg({ from: "a@dropbox.com", subject: "Reset your password" }))?.signalType,
    "password_reset",
  )
  assert.equal(
    classifySignal(msg({ from: "a@google.com", subject: "New sign-in from Chrome" }))?.signalType,
    "security_alert",
  )
})

test("classifySignal: transactional sender with no signal subject still counts", () => {
  const s = classifySignal(msg({ from: "GitHub <no-reply@github.com>", subject: "Your weekly digest" }))
  assert.ok(s)
  assert.equal(s?.signalType, "welcome") // default when sender is transactional
})

test("classifySignal: marketing newsletter → null", () => {
  const s = classifySignal(msg({ from: "Deals <newsletter@shop.example>", subject: "50% off this weekend" }))
  assert.equal(s, null)
})

test("classifySignal: unparseable sender → null", () => {
  assert.equal(classifySignal(msg({ from: "garbage", subject: "Welcome to X" })), null)
})
