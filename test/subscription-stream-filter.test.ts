import test from "node:test"
import assert from "node:assert/strict"
import {
  streamName,
  isSuppressedStream,
  filterProviderStreams,
  type ProviderStream,
  type SuppressedSub,
} from "@/lib/finance/subscription-stream-filter"

// A minimal provider stream with sensible defaults.
function stream(p: Partial<ProviderStream>): ProviderStream {
  return { merchantName: null, description: "", accountId: null, lastAmount: null, averageAmount: null, ...p }
}

// ─── streamName ───

test("streamName: uses merchantName when present", () => {
  assert.equal(streamName(stream({ merchantName: "Netflix", description: "NFLX" })), "Netflix")
})

test("streamName: falls back to description when merchantName is blank", () => {
  // Regression: many streams store the real name only in the description with an
  // empty merchantName — `merchantName ?? description` (keeps "") was the bug.
  assert.equal(streamName(stream({ merchantName: "", description: "APPLE.COM/BILL" })), "APPLE.COM/BILL")
  assert.equal(streamName(stream({ merchantName: "   ", description: "APPLE.COM/BILL" })), "APPLE.COM/BILL")
})

// ─── isSuppressedStream ───

test("suppresses a stream matching a dismissed/cancelled sub by exact name (case-insensitive)", () => {
  const suppressed: SuppressedSub[] = [{ merchantName: "NETFLIX", amount: 15.99 }]
  assert.equal(isSuppressedStream(stream({ merchantName: "Netflix" }), suppressed), true)
})

test("suppresses a blank-merchant stream via its description (the dismiss bug)", () => {
  const suppressed: SuppressedSub[] = [{ merchantName: "APPLE.COM/BILL", amount: 95.95 }]
  assert.equal(isSuppressedStream(stream({ merchantName: "", description: "APPLE.COM/BILL" }), suppressed), true)
})

test("suppresses a cancelled sub's stream (was the 'cannot cancel' bug)", () => {
  // The route now feeds cancelled subs into the suppressed list, so a cancelled
  // Plaid-backed sub's stream no longer resurfaces as active.
  const cancelled: SuppressedSub[] = [{ merchantName: "Google Workspace", amount: 52.8 }]
  assert.equal(isSuppressedStream(stream({ merchantName: "Google Workspace", lastAmount: 52.8 }), cancelled), true)
})

test("keeps an unrelated active stream", () => {
  const suppressed: SuppressedSub[] = [{ merchantName: "Netflix", amount: 15.99 }]
  assert.equal(isSuppressedStream(stream({ merchantName: "Spotify" }), suppressed), false)
})

test("matches on name + account key", () => {
  const suppressed: SuppressedSub[] = [{ merchantName: "Gym", amount: 50, accountId: "acct_1" }]
  assert.equal(isSuppressedStream(stream({ merchantName: "Gym", accountId: "acct_1" }), suppressed), true)
})

test("fuzzy: near-identical names (>=0.8 similarity) are suppressed regardless of amount", () => {
  // "Cloudflare" vs "Cloudflaree" → 1 edit / 11 = ~0.91 similarity.
  const suppressed: SuppressedSub[] = [{ merchantName: "Cloudflare", amount: 5 }]
  assert.equal(isSuppressedStream(stream({ merchantName: "Cloudflaree", lastAmount: 999 }), suppressed), true)
})

test("fuzzy: mid similarity (0.6–0.8) suppressed only when amount is within 30%", () => {
  // "ABCDEFGHIJ" vs "ABCDEFGXYZ" → 3 edits / 10 = 0.7 similarity.
  const suppressed: SuppressedSub[] = [{ merchantName: "ABCDEFGHIJ", amount: 100 }]
  assert.equal(isSuppressedStream(stream({ merchantName: "ABCDEFGXYZ", lastAmount: 100 }), suppressed), true)
  assert.equal(isSuppressedStream(stream({ merchantName: "ABCDEFGXYZ", lastAmount: 500 }), suppressed), false)
})

// ─── filterProviderStreams ───

test("filterProviderStreams: drops suppressed streams, keeps the rest", () => {
  const suppressed: SuppressedSub[] = [
    { merchantName: "Netflix", amount: 15.99 },
    { merchantName: "APPLE.COM/BILL", amount: 95.95 },
  ]
  const streams = [
    stream({ merchantName: "Netflix" }),                          // dropped
    stream({ merchantName: "", description: "APPLE.COM/BILL" }),  // dropped (blank merchant)
    stream({ merchantName: "Spotify" }),                          // kept
    stream({ merchantName: "Slack" }),                            // kept
  ]
  const kept = filterProviderStreams(streams, suppressed)
  assert.deepEqual(kept.map(streamName), ["Spotify", "Slack"])
})

test("filterProviderStreams: no suppressed subs keeps everything", () => {
  const streams = [stream({ merchantName: "Netflix" }), stream({ merchantName: "Spotify" })]
  assert.equal(filterProviderStreams(streams, []).length, 2)
})
