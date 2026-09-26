/**
 * Solana RPC helpers for token account discovery and signature fetching.
 */

const SOLANA_RPC = "https://api.mainnet-beta.solana.com"
const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"

/** Discover all SPL token accounts (ATAs) owned by this wallet via Solana RPC.
 *  Queries both the original Token Program and Token-2022. */
export async function discoverTokenAccounts(walletAddress: string): Promise<string[]> {
  const programIds = [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]
  const results: string[] = []

  for (const programId of programIds) {
    try {
      const res = await fetch(SOLANA_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTokenAccountsByOwner",
          params: [
            walletAddress,
            { programId },
            { encoding: "jsonParsed" },
          ],
        }),
        signal: AbortSignal.timeout(15_000),
      })
      const data = await res.json() as {
        result?: { value?: { pubkey: string }[] }
      }
      for (const v of data.result?.value ?? []) {
        results.push(v.pubkey)
      }
    } catch {
      // Non-critical: one program query failing shouldn't block the other
      console.warn(`[solana-fetcher] getTokenAccountsByOwner failed for program ${programId.slice(0, 12)}`)
    }
  }

  return results
}

const SIGNATURE_PAGE_LIMIT = 1_000
/** Pause between signature pages — the public RPC rate-limits getSignaturesForAddress */
const SIGNATURE_PAGE_DELAY_MS = 250

interface SignatureEntry { signature: string; err: unknown }

async function fetchSignaturePage(address: string, limit: number, before?: string): Promise<SignatureEntry[]> {
  const res = await fetch(SOLANA_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getSignaturesForAddress",
      params: [address, { limit, ...(before ? { before } : {}) }],
    }),
    signal: AbortSignal.timeout(15_000),
  })
  const data = await res.json().catch(() => null) as { result?: SignatureEntry[]; error?: { message?: string } } | null
  // An error must not read as "no more history" — that silently truncated syncs
  if (!res.ok || !data || data.error || !data.result) {
    throw Object.assign(new Error(`getSignaturesForAddress ${res.status}: ${data?.error?.message ?? "no result"}`), { status: res.status })
  }
  return data.result
}

/**
 * Successful transaction signatures for an address, newest first — paging back
 * until `max` are collected or its history ends. Pages on the raw cursor, so a
 * page of only failed transactions doesn't end it early. Throws on RPC errors.
 */
export async function getSignaturesForAddress(address: string, max: number): Promise<string[]> {
  const signatures: string[] = []
  let before: string | undefined
  while (signatures.length < max) {
    if (before) await new Promise((r) => setTimeout(r, SIGNATURE_PAGE_DELAY_MS))
    const limit = Math.min(SIGNATURE_PAGE_LIMIT, max - signatures.length)
    const page = await fetchSignaturePage(address, limit, before)
    signatures.push(...page.filter((s) => s.err === null).map((s) => s.signature))
    if (page.length < limit) break
    before = page[page.length - 1].signature
  }
  return signatures
}

/** Resolve SPL token metadata (symbol + decimals) from a mint address via Solana RPC. */
export async function resolveSPLToken(mint: string): Promise<{ symbol: string; decimals: number }> {
  const res = await fetch(SOLANA_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getAccountInfo",
      params: [mint, { encoding: "jsonParsed" }],
    }),
    signal: AbortSignal.timeout(10_000),
  })
  const data = await res.json() as {
    result?: { value?: { data?: { parsed?: { info?: { symbol?: string; decimals?: number } } } } }
  }
  const info = data.result?.value?.data?.parsed?.info
  return {
    symbol: info?.symbol ?? mint.slice(0, 6),
    decimals: info?.decimals ?? 9,
  }
}
