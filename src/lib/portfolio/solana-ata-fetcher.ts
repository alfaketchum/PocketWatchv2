/**
 * Fetch incoming SPL token transfers via ATA signatures + Helius parsing.
 */

import { db } from "@/lib/db"
import { isProviderThrottleError, withProviderPermitRotating } from "./provider-governor"
import type { ServiceKeyEntry } from "./service-keys"
import { heliusTxToRecords, walletTokenAccounts } from "./solana-tx-mapper"
import type { HeliusTransaction, TransactionCacheRecord } from "./solana-tx-mapper"
import type { SyncErrorDetail } from "./transaction-fetcher"
import { discoverTokenAccounts, getSignaturesForAddress, resolveSPLToken } from "./solana-rpc"

/** Full history per token account in a historical sync (USDC on an old wallet: ~1,100) */
const MAX_SIGNATURES_PER_ACCOUNT = 20_000
const INCREMENTAL_SIGNATURES_PER_ACCOUNT = 50
const MAX_TOKEN_ACCOUNTS = 5_000
/** Helius parses up to 100 signatures per request */
const PARSE_BATCH = 100

/** Parse transaction signatures via Helius POST /v0/transactions. */
async function parseTransactionsViaHelius(
  signatures: string[],
  apiKey: string,
): Promise<HeliusTransaction[]> {
  if (signatures.length === 0) return []

  const res = await fetch(
    `https://api.helius.xyz/v0/transactions?api-key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions: signatures }),
      signal: AbortSignal.timeout(30_000),
    },
  )
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw Object.assign(new Error(`Helius parse ${res.status}: ${body.slice(0, 180)}`), { status: res.status })
  }
  return res.json()
}

/** Resolve SPL token symbols for records. */
export async function backfillSPLSymbols(records: TransactionCacheRecord[]): Promise<void> {
  const splMints = new Set(
    records
      .filter((r) => r.category === "erc20" && r.asset && r.asset !== "native")
      .map((r) => r.asset!),
  )
  for (const mint of splMints) {
    try {
      const meta = await resolveSPLToken(mint)
      for (const rec of records) {
        if (rec.asset === mint && rec.category === "erc20") {
          rec.symbol = meta.symbol
          rec.decimals = meta.decimals
        }
      }
    } catch { /* keep null */ }
  }
}

function throttleDetailFromError(error: unknown, fallbackMessage: string): SyncErrorDetail {
  if (isProviderThrottleError(error)) {
    const retryAfterSec = error.nextAllowedAt
      ? Math.min(300, Math.max(5, Math.ceil((error.nextAllowedAt.getTime() - Date.now()) / 1000)))
      : 90
    return { code: "helius_rate_limited", message: error.message, status: 429, retryable: true, retryAfterSec }
  }
  const status = error != null && typeof error === "object" && typeof (error as Record<string, unknown>).status === "number"
    ? (error as { status: number }).status
    : undefined
  const lower = (error instanceof Error ? error.message : fallbackMessage).toLowerCase()
  if (status === 429 || lower.includes("rate") || lower.includes("too many requests")) {
    return { code: "helius_rate_limited", message: error instanceof Error ? error.message : fallbackMessage, status, retryable: true, retryAfterSec: 90 }
  }
  return { code: "helius_error", message: error instanceof Error ? error.message : fallbackMessage, status, retryable: true, retryAfterSec: 45 }
}

/** Remember the wallet's token accounts seen in these transactions (incl. ones since closed). */
export async function recordTokenAccounts(userId: string, walletAddress: string, htxs: HeliusTransaction[]): Promise<void> {
  const accounts = [...new Set(htxs.flatMap((htx) => walletTokenAccounts(htx, walletAddress)))]
  if (accounts.length === 0) return
  await db.solanaTokenAccount.createMany({
    data: accounts.map((address) => ({ userId, walletAddress, address })),
    skipDuplicates: true,
  })
}

/** Open token accounts (RPC) + every one seen in the wallet's transactions, sorted (stable cursor order). */
async function loadTokenAccounts(userId: string, walletAddress: string): Promise<string[]> {
  const [open, seen] = await Promise.all([
    discoverTokenAccounts(walletAddress),
    db.solanaTokenAccount.findMany({ where: { userId, walletAddress }, select: { address: true }, take: MAX_TOKEN_ACCOUNTS }),
  ])
  return [...new Set([...open, ...seen.map((a) => a.address)])].sort()
}

/**
 * Fetch incoming token transfers via token-account signatures + Helius parsing.
 * Resumable: accounts are processed in sorted order and `cursor` is the last one
 * fully done; each account's whole history is paged (the latest few in
 * incremental mode) and new signatures are parsed and saved in batches of 100.
 * Stops at the step budget; `done` once every account is processed.
 */
export async function fetchATATransactions(options: {
  userId: string
  walletAddress: string
  heliusKeys: ServiceKeyEntry[]
  syncMode: string
  cursor: string | null
  maxParseRequests: number
  deadlineMs: number
}): Promise<{ newRecords: number; requestsUsed: number; errors: SyncErrorDetail[]; cursor: string | null; done: boolean }> {
  const { userId, walletAddress, heliusKeys, syncMode, maxParseRequests, deadlineMs } = options
  const maxSignatures = syncMode === "incremental" ? INCREMENTAL_SIGNATURES_PER_ACCOUNT : MAX_SIGNATURES_PER_ACCOUNT
  let cursor = options.cursor
  let newRecords = 0
  let requestsUsed = 0
  let processedAny = false
  const overBudget = () => requestsUsed >= maxParseRequests || Date.now() >= deadlineMs
  const stop = (errors: SyncErrorDetail[] = []) => ({ newRecords, requestsUsed, errors, cursor, done: false })

  let accounts: string[]
  try {
    accounts = await loadTokenAccounts(userId, walletAddress)
  } catch (err) {
    return stop([{ code: "solana_rpc_error", message: `Token account discovery failed: ${err instanceof Error ? err.message : String(err)}`, retryable: true, retryAfterSec: 30 }])
  }

  for (const account of accounts.filter((a) => cursor === null || a > cursor)) {
    if (processedAny && overBudget()) return stop()
    let signatures: string[]
    try {
      signatures = await getSignaturesForAddress(account, maxSignatures)
    } catch (err) {
      return stop([{ code: "solana_rpc_error", message: `Signatures for ${account.slice(0, 12)}… failed: ${err instanceof Error ? err.message : String(err)}`, retryable: true, retryAfterSec: 30 }])
    }
    const newSigs = await uncachedSignatures(userId, signatures)

    for (let i = 0; i < newSigs.length; i += PARSE_BATCH) {
      // Stopping mid-account is safe: saved batches are skipped as cached next step
      if (requestsUsed > 0 && overBudget()) return stop()
      try {
        const parsed = await withProviderPermitRotating(
          userId, "helius", `solana-ata-txs:${walletAddress}`, undefined, heliusKeys,
          async (keyEntry) => parseTransactionsViaHelius(newSigs.slice(i, i + PARSE_BATCH), keyEntry.key),
        ) as HeliusTransaction[]
        requestsUsed += 1
        newRecords += await saveParsed(userId, walletAddress, parsed)
      } catch (err) {
        return stop([throttleDetailFromError(err, "Helius ATA parse failed")])
      }
    }
    cursor = account
    processedAny = true
  }
  return { newRecords, requestsUsed, errors: [], cursor: null, done: true }
}

async function uncachedSignatures(userId: string, signatures: string[]): Promise<string[]> {
  if (signatures.length === 0) return []
  const unique = [...new Set(signatures)]
  const existing = await db.transactionCache.findMany({
    where: { userId, chain: "SOLANA", txHash: { in: unique } },
    select: { txHash: true },
    distinct: ["txHash"],
  })
  const cached = new Set(existing.map((e) => e.txHash))
  return unique.filter((sig) => !cached.has(sig))
}

async function saveParsed(userId: string, walletAddress: string, parsed: HeliusTransaction[]): Promise<number> {
  await recordTokenAccounts(userId, walletAddress, parsed)
  const records = parsed.flatMap((htx) => heliusTxToRecords(htx, userId, walletAddress))
  if (records.length === 0) return 0
  await backfillSPLSymbols(records)
  const result = await db.transactionCache.createMany({ data: records, skipDuplicates: true })
  return result.count
}
