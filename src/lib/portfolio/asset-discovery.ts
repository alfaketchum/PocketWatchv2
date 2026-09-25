/**
 * Discover tokens held in the past (from transaction history) for the portfolio
 * "By asset" chart.
 *
 * 1. Candidates: tokens with any transfer worth ≥ $1,000 (not flagged spam, not a
 *    spam-looking symbol, not an absurd value).
 * 2. Zerion lookup (25 per request), three outcomes:
 *    - "priced": Zerion-verified → (wallet, token) pairs get Zerion history for
 *      their band (TrackedAssetPair, fetched with a budget). Total unchanged.
 *    - "listed": Zerion prices it but it's unverified (memecoins, scams with a
 *      DEX price). Already inside Zerion's totals → nothing to add; stays Misc.
 *    - "dead": Zerion has no price (dead/delisted/never listed) → value rebuilt
 *      from transactions (dead-token-history.ts, no API calls) and ADDED to
 *      totals, since nothing else counts it. Rebuilding a priced token would
 *      double-count it.
 * Each token is looked up once (AssetCandidate). Runs at most weekly.
 */

import { db } from "@/lib/db"
import { lookupFungiblesByImplementation, ZERION_LOOKUP_MAX } from "./zerion-client"
import { isLikelySpamTokenSymbol } from "./price-symbol-utils"
import { normalizeWalletAddress } from "./utils"
import { assetKey } from "./asset-values"

const CANDIDATE_MIN_USD = 1_000
/** Spam tokens report absurd values (billions); no real single transfer here is this large */
const CANDIDATE_MAX_USD = 50_000_000
const MAX_CANDIDATE_ROWS = 50_000

/** TransactionCache chain name → Zerion chain id */
const ZERION_CHAIN: Record<string, string> = {
  ETHEREUM: "ethereum", BASE: "base", POLYGON: "polygon", ARBITRUM: "arbitrum", SOLANA: "solana",
  OPTIMISM: "optimism", BLAST: "blast", ZKSYNC: "zksync-era", FANTOM: "fantom", ZORA: "zora",
  AVALANCHE: "avalanche", CELO: "celo", LINEA: "linea", SCROLL: "scroll", BSC: "binance-smart-chain",
  MANTLE: "mantle", GNOSIS: "xdai", BERACHAIN: "berachain", POLYGON_ZKEVM: "polygon-zkevm",
}

function normalizeContract(chain: string, address: string): string {
  return chain === "SOLANA" ? address : address.toLowerCase()
}

interface Candidate { chain: string; contract: string; symbol: string; wallets: Set<string> }

/** Tokens in transaction history with a meaningful transfer, not already looked up. */
async function findCandidates(userId: string): Promise<Candidate[]> {
  const rows = await db.transactionCache.findMany({
    where: {
      userId,
      // Native coins ("native") are in Zerion's history already; NFTs and gas aren't tokens
      asset: { notIn: ["native"] },
      category: { notIn: ["erc721", "gas"] },
      usdValue: { gte: CANDIDATE_MIN_USD, lte: CANDIDATE_MAX_USD },
      OR: [{ txClassification: null }, { txClassification: { not: "spam" } }],
    },
    select: { walletAddress: true, chain: true, asset: true, symbol: true },
    take: MAX_CANDIDATE_ROWS,
  })
  const known = await db.assetCandidate.findMany({ where: { userId }, select: { chain: true, contract: true } })
  const seen = new Set(known.map((k) => `${k.chain}|${k.contract}`))

  const byToken = new Map<string, Candidate>()
  for (const r of rows) {
    if (!r.asset || !ZERION_CHAIN[r.chain] || isLikelySpamTokenSymbol(r.symbol)) continue
    const contract = normalizeContract(r.chain, r.asset)
    const key = `${r.chain}|${contract}`
    if (seen.has(key)) continue
    const c = byToken.get(key) ?? { chain: r.chain, contract, symbol: r.symbol ?? "?", wallets: new Set<string>() }
    c.wallets.add(normalizeWalletAddress(r.walletAddress))
    byToken.set(key, c)
  }
  return [...byToken.values()]
}

/** Wallets that ever transacted a token (for Zerion-priced tokens found in history). */
async function walletsForToken(userId: string, chain: string, contract: string): Promise<string[]> {
  const rows = await db.transactionCache.findMany({
    where: { userId, chain, asset: { equals: contract, mode: "insensitive" } },
    select: { walletAddress: true },
    distinct: ["walletAddress"],
    take: 100,
  })
  return rows.map((r) => normalizeWalletAddress(r.walletAddress))
}

/** Look up new candidates in Zerion and record the verdicts. Returns lookups made. */
export async function discoverHistoricalAssets(userId: string, zerionKey: string): Promise<{ priced: number; dead: number }> {
  const candidates = await findCandidates(userId)
  let priced = 0
  let dead = 0

  for (let i = 0; i < candidates.length; i += ZERION_LOOKUP_MAX) {
    const batch = candidates.slice(i, i + ZERION_LOOKUP_MAX)
    const found = await lookupFungiblesByImplementation(
      zerionKey,
      batch.map((c) => `${ZERION_CHAIN[c.chain]}:${c.contract}`),
    )
    for (const c of batch) {
      const impl = `${ZERION_CHAIN[c.chain]}:${c.contract.toLowerCase()}`
      const match = found.find((f) => f.implementations.includes(impl))
      const status = match?.verified ? "priced" : match?.hasPrice ? "listed" : "dead"
      await db.assetCandidate.upsert({
        where: { userId_chain_contract: { userId, chain: c.chain, contract: c.contract } },
        create: { userId, chain: c.chain, contract: c.contract, symbol: c.symbol, fungibleId: match?.id ?? null, status },
        update: {},
      })
      if (status !== "priced" || !match) { if (status === "dead") dead++; continue }
      priced++
      const wallets = await walletsForToken(userId, c.chain, c.contract)
      await db.trackedAssetPair.createMany({
        data: wallets.map((walletAddress) => ({
          userId, walletAddress, fungibleId: match.id, symbol: assetKey(match.symbol), source: "history",
        })),
        skipDuplicates: true,
      })
    }
  }
  return { priced, dead }
}
