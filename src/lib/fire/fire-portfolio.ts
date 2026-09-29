import type { AccountMix, CryptoTreatment } from "./fire-types"
import { scaleTiers } from "./crypto-stress"
import type { CryptoTier } from "./crypto-tiers"

/** `crypto` holds unclassified crypto when tier data isn't available yet. */
export type AssetClass = "stocks" | "bonds" | "cash" | "stablecoins" | "btc" | "eth" | "top100" | "longTail" | "crypto"
export type AccountGroup = "cash" | "savings" | "investments"

export const ASSET_CLASSES: AssetClass[] = ["stocks", "bonds", "cash", "stablecoins", "btc", "eth", "top100", "longTail", "crypto"]

const CRYPTO_CLASSES: AssetClass[] = ["btc", "eth", "top100", "longTail", "crypto"]

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  stocks: "Stocks",
  bonds: "Bonds",
  cash: "Cash",
  stablecoins: "Stablecoins",
  btc: "Bitcoin",
  eth: "Ether",
  top100: "Top-100 coins",
  longTail: "Long-tail coins",
  crypto: "Crypto",
}

export interface PortfolioAccount {
  id: string
  name: string
  institution: string
  group: AccountGroup
  balance: number
}

interface AccountLike {
  id: string
  name: string
  type: string
  subtype: string | null
  currentBalance: number | null
  isHidden: boolean
  linkedExternalId: string | null
}

interface InstitutionLike {
  institutionName: string
  provider: string
  accounts: AccountLike[]
}

/** Same classification (and duplicate/hidden filtering) as /api/net-worth. */
function groupOf(type: string, subtype: string | null): AccountGroup | null {
  const sub = (subtype ?? "").toLowerCase()
  if (type === "savings" || (type === "depository" && sub === "savings")) return "savings"
  if (type === "depository" || type === "checking" || type === "cash") return "cash"
  if (type === "investment" || type === "brokerage") return "investments"
  return null
}

export function portfolioAccounts(institutions: InstitutionLike[]): PortfolioAccount[] {
  return institutions.flatMap((inst) =>
    inst.accounts
      .filter((a) => !a.isHidden && !(inst.provider === "simplefin" && a.linkedExternalId))
      .map((a) => ({ a, group: groupOf(a.type, a.subtype) }))
      .filter((x): x is { a: AccountLike; group: AccountGroup } => x.group !== null && (x.a.currentBalance ?? 0) > 0)
      .map(({ a, group }) => ({
        id: a.id,
        name: a.name,
        institution: inst.institutionName,
        group,
        balance: a.currentBalance ?? 0,
      })),
  )
}

export function defaultMix(group: AccountGroup): AccountMix {
  return group === "investments" ? { stocks: 1, bonds: 0, cash: 0 } : { stocks: 0, bonds: 0, cash: 1 }
}

export interface Allocation {
  /** Dollars per asset class within the investable portfolio. */
  byClass: Record<AssetClass, number>
  total: number
  /** Simulation shares after crypto treatment (stocks + bonds + cash = 1). */
  sim: { stocks: number; bonds: number; cash: number }
  /** Cash + stablecoins, in years of spending. */
  cashRunwayYears: number | null
}

export interface AllocationInput {
  accounts: PortfolioAccount[]
  stablecoins: number
  digital: number
  mixes: Record<string, AccountMix>
  includeCash: boolean
  includeCrypto: boolean
  cryptoTreatment: CryptoTreatment
  annualSpend: number
  /** Crypto split by tier; rescaled to stablecoins + digital when present. */
  cryptoTiers?: Record<CryptoTier, number> | null
}

function addCrypto(byClass: Record<AssetClass, number>, input: AllocationInput): void {
  const total = Math.max(0, input.stablecoins) + Math.max(0, input.digital)
  const tiers = input.cryptoTiers ? scaleTiers(input.cryptoTiers, total) : null
  if (!tiers) {
    byClass.stablecoins = Math.max(0, input.stablecoins)
    byClass.crypto = Math.max(0, input.digital)
    return
  }
  byClass.stablecoins = tiers.stable
  byClass.btc = tiers.btc
  byClass.eth = tiers.eth
  byClass.top100 = tiers.top100
  byClass.longTail = tiers.longTail
}

export function buildAllocation(input: AllocationInput): Allocation {
  const byClass: Record<AssetClass, number> = {
    stocks: 0, bonds: 0, cash: 0, stablecoins: 0, btc: 0, eth: 0, top100: 0, longTail: 0, crypto: 0,
  }
  for (const acct of input.accounts) {
    if (acct.group === "cash" && !input.includeCash) continue
    const mix = input.mixes[acct.id] ?? defaultMix(acct.group)
    byClass.stocks += acct.balance * mix.stocks
    byClass.bonds += acct.balance * mix.bonds
    byClass.cash += acct.balance * mix.cash
  }
  if (input.includeCrypto) addCrypto(byClass, input)
  const total = ASSET_CLASSES.reduce((s, c) => s + byClass[c], 0)
  const volatileCrypto = CRYPTO_CLASSES.reduce((s, c) => s + byClass[c], 0)
  const cryptoAsStocks = input.cryptoTreatment === "stocks" ? volatileCrypto : 0
  const cashLike = byClass.cash + byClass.stablecoins + (input.cryptoTreatment === "cash" ? volatileCrypto : 0)
  const sim = total > 0
    ? { stocks: (byClass.stocks + cryptoAsStocks) / total, bonds: byClass.bonds / total, cash: cashLike / total }
    : { stocks: 0, bonds: 0, cash: 0 }
  const liquid = byClass.cash + byClass.stablecoins
  return {
    byClass,
    total,
    sim,
    cashRunwayYears: input.annualSpend > 0 ? liquid / input.annualSpend : null,
  }
}
