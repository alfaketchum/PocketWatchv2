import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { buildBalancesForUser } from "@/lib/portfolio/balances-read"
import { sumNetWorthStablecoins } from "@/lib/portfolio/stablecoins"
import { loadSupplementalSeries } from "@/lib/portfolio/supplemental-history"
import { loadLiveSnapshotByDay } from "@/lib/portfolio/live-snapshot-days"
import { loadStablecoinSplit } from "@/lib/portfolio/net-worth-stable-split"
import { syncStablecoinCharts } from "@/lib/portfolio/wallet-chart-cache"

/**
 * GET /api/net-worth
 *
 * Returns combined net worth from both finance (fiat) and portfolio (crypto).
 * Aggregates the latest finance account balances + portfolio snapshot value.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return apiError("NW001", "Authentication required", 401)

  try {
    // ─── Finance: live account balances ───
    // Must match snapshot logic: exclude hidden accounts, disconnected institutions,
    // and SimpleFIN linked duplicates. Handle all account types.
    const financeAccounts = await db.financeAccount.findMany({
      where: {
        userId: user.id,
        isHidden: false,
        institution: { status: { not: "disconnected" } },
      },
      select: {
        type: true,
        subtype: true,
        currentBalance: true,
        linkedExternalId: true,
        institution: { select: { provider: true } },
      },
    })

    let fiatCash = 0
    let fiatSavings = 0
    let fiatInvestments = 0
    let fiatDebt = 0

    const DEBT_TYPES = new Set(["credit", "business_credit", "loan", "mortgage"])

    for (const acct of financeAccounts) {
      // Skip SimpleFIN linked duplicates (same as snapshot logic)
      if (acct.institution.provider === "simplefin" && acct.linkedExternalId) continue

      const bal = acct.currentBalance ?? 0
      const sub = (acct.subtype ?? "").toLowerCase()

      if (acct.type === "savings" || (acct.type === "depository" && sub === "savings")) {
        fiatSavings += bal
      } else if (acct.type === "depository" || acct.type === "checking" || acct.type === "cash") {
        fiatCash += bal
      } else if (acct.type === "investment" || acct.type === "brokerage") {
        fiatInvestments += bal
      } else if (DEBT_TYPES.has(acct.type)) {
        fiatDebt += Math.abs(bal)
      }
    }

    const fiatNetWorth = fiatCash + fiatSavings + fiatInvestments - fiatDebt

    // ─── Portfolio: LIVE cached value (same source as the /portfolio page) ───
    // Previously this read the latest `live_refresh` snapshot, but that snapshot
    // is only written when EVERY wallet returns in one fetch — which never happens
    // with 100+ wallets under provider rate-limiting, so it was frozen at a
    // months-old, near-empty value (~$29k). Read the live multi-provider cache
    // instead (already includes exchange balances), and keep the best snapshot
    // only as a floor so a cold/partial cache can't understate net worth.
    let liveCrypto = 0
    let liveStable = 0
    try {
      const live = await buildBalancesForUser(user.id)
      if (!live.error) {
        liveCrypto = live.totalValue
        // Split Stablecoins (USDC/USDT/USDe/USDG only) vs Digital Assets.
        liveStable = sumNetWorthStablecoins(live.positions)
      }
    } catch (err) {
      console.warn("[net-worth] live portfolio read failed, falling back to snapshot:", err)
    }

    // Best available snapshot (+ exchange snapshot) as a fallback/floor.
    const fallbackSnapshot = await db.portfolioSnapshot.findFirst({
      where: { userId: user.id, source: "live_refresh" },
      orderBy: { createdAt: "desc" },
      select: { totalValue: true, metadata: true },
    }) ?? await db.portfolioSnapshot.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { totalValue: true, metadata: true },
    })

    let snapshotCrypto = fallbackSnapshot?.totalValue ?? 0
    const snapshotMeta = fallbackSnapshot?.metadata
      ? (typeof fallbackSnapshot.metadata === "string" ? JSON.parse(fallbackSnapshot.metadata) : fallbackSnapshot.metadata)
      : null
    if ((snapshotMeta?.exchangeTotalValue ?? 0) <= 0) {
      const latestExchangeSnap = await db.exchangeBalanceSnapshot.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: { totalValue: true },
      })
      if (latestExchangeSnap) snapshotCrypto += latestExchangeSnap.totalValue
    }

    // Prefer the live value; never show less than the last good snapshot.
    const cryptoValue = Math.max(liveCrypto, snapshotCrypto)

    // Split crypto into stablecoins vs digital assets. Use the live stablecoin
    // ratio; when the snapshot floor is higher (live cold/partial) apply that same
    // ratio so the two always sum to cryptoValue.
    const stableRatio = liveCrypto > 0 ? liveStable / liveCrypto : 0
    const cryptoStablecoins = cryptoValue * stableRatio
    const cryptoDigitalAssets = cryptoValue - cryptoStablecoins

    // ─── Combined ───
    const totalNetWorth = fiatNetWorth + cryptoValue

    // ─── Historical snapshots (last 365 days by default; ?range=all for everything) ───
    const fullHistory = new URL(request.url).searchParams.get("range") === "all"
    const historyStart = fullHistory ? new Date(0) : new Date()
    if (!fullHistory) historyStart.setDate(historyStart.getDate() - 365)

    // Crypto history backbone comes from the Zerion-backed chart cache (full
    // wallet value history), NOT portfolioSnapshot (which only holds values from
    // when the app started recording). Exchange history blends in from its own
    // snapshot table, so connecting an exchange (e.g. Bybit) extends it for free.
    const historyStartSec = Math.floor(historyStart.getTime() / 1000)
    void syncStablecoinCharts(user.id) // fetches stablecoin history once per wallet; no-op when current
    const [financeSnapshots, chartRows, exchangeSnaps, accountSnaps, supplementalAt, liveByDay, stableFor] = await Promise.all([
      db.financeSnapshot.findMany({
        where: { userId: user.id, date: { gte: historyStart } },
        orderBy: { date: "asc" },
        select: { date: true, netWorth: true, breakdown: true },
      }),
      db.chartCache.findMany({
        where: { userId: user.id, timestamp: { gte: historyStartSec } },
        orderBy: { timestamp: "asc" },
        select: { timestamp: true, value: true },
      }),
      db.exchangeBalanceSnapshot.findMany({
        where: { userId: user.id, createdAt: { gte: historyStart } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true, totalValue: true },
      }),
      db.financeAccountSnapshot.findMany({
        where: { userId: user.id, date: { gte: historyStart } },
        orderBy: { date: "asc" },
        select: { accountId: true, date: true, balance: true },
      }),
      // Hyperliquid + Lighter history, which the Zerion chart lacks
      loadSupplementalSeries(user.id),
      loadLiveSnapshotByDay(user.id, historyStart),
      loadStablecoinSplit(user.id, historyStart),
    ])

    // Independent daily series (last value wins per day; forward-filled below).
    const financeByDay = new Map<string, number>()
    for (const snap of financeSnapshots) {
      financeByDay.set(snap.date.toISOString().slice(0, 10), snap.netWorth)
    }
    // Wallet value per day from the Zerion chart backbone.
    const walletByDay = new Map<string, number>()
    for (const row of chartRows) {
      walletByDay.set(new Date(row.timestamp * 1000).toISOString().slice(0, 10), row.value)
    }
    // Exchange value per day (extends automatically as exchanges are connected).
    const exchangeByDay = new Map<string, number>()
    for (const snap of exchangeSnaps) {
      exchangeByDay.set(snap.createdAt.toISOString().slice(0, 10), snap.totalValue)
    }

    // Per-day finance category breakdown (Cash = checking, Savings, Investments,
    // Credit, Loans). Savings splits out from Cash to match the new taxonomy.
    type FinanceBreakdown = { cash: number; savings: number; investment: number; credit: number; loan: number }
    const bdByDay = new Map<string, FinanceBreakdown>()
    for (const snap of financeSnapshots) {
      const key = snap.date.toISOString().slice(0, 10)
      try {
        const b = JSON.parse(snap.breakdown) as Record<string, number>
        bdByDay.set(key, {
          cash: (b.checking ?? 0) + (b.depository ?? 0) + (b.cash ?? 0),
          savings: b.savings ?? 0,
          investment: b.investment ?? 0,
          credit: b.credit ?? 0,
          loan: (b.loan ?? 0) + (b.mortgage ?? 0),
        })
      } catch { /* skip malformed breakdown */ }
    }

    // Full taxonomy per day. Crypto splits into stablecoins (USDC/USDT/USDe/USDG)
    // vs digital assets from real per-day history; the live ratio is only a
    // fallback until the stablecoin history has been fetched.
    type GroupBreakdown = FinanceBreakdown & { stablecoin: number; digital: number }

    // Forward-fill each series across the union of days; crypto = wallet + exchange.
    const todayKey = new Date().toISOString().slice(0, 10)
    const allDays = new Set<string>([...financeByDay.keys(), ...walletByDay.keys(), ...exchangeByDay.keys(), ...liveByDay.keys()])
    const lastChartDay = [...walletByDay.keys()].at(-1) ?? ""
    allDays.add(todayKey)
    const sortedDays = [...allDays].sort()

    let lastFiat = 0
    let lastWallet = 0
    let lastExchange = 0
    let lastCrypto = 0
    // Seed finance groups with the current live values so they appear across the
    // whole history (finance snapshots have little back-history vs the year of
    // crypto chart data); real per-day snapshot values override where present.
    let lastBd: FinanceBreakdown = {
      cash: fiatCash, savings: fiatSavings, investment: fiatInvestments, credit: 0, loan: fiatDebt,
    }
    const history: Array<{ date: string; fiat: number; crypto: number; total: number }> = []
    const breakdownHistory: Array<{ date: string } & GroupBreakdown> = []

    for (const day of sortedDays) {
      if (financeByDay.has(day)) lastFiat = financeByDay.get(day)!
      if (walletByDay.has(day)) lastWallet = walletByDay.get(day)!
      if (exchangeByDay.has(day)) lastExchange = exchangeByDay.get(day)!
      const bd = bdByDay.get(day)
      if (bd) lastBd = bd
      // Today uses the live, complete crypto value (wallets + exchanges + staking)
      // so the chart's last point matches the headline number.
      // Recorded live snapshots win their day; past the Zerion history (fetched once
      // per wallet) with no snapshot, carry the last value forward.
      const venues = supplementalAt(Date.parse(day) / 1000)
      const live = liveByDay.get(day)
      const crypto = day === todayKey
        ? cryptoValue
        : live !== undefined ? live + venues
          : day > lastChartDay ? lastCrypto : lastWallet + lastExchange + venues
      lastCrypto = crypto
      history.push({ date: day, fiat: lastFiat, crypto, total: lastFiat + crypto })
      const stablecoin = day === todayKey ? cryptoStablecoins
        : stableFor ? stableFor(day, crypto, venues) : crypto * stableRatio
      breakdownHistory.push({ date: day, ...lastBd, stablecoin, digital: crypto - stablecoin })
    }

    // Per-account change over each timeframe window (from per-account snapshots).
    const byAccount = new Map<string, Array<{ t: number; balance: number }>>()
    for (const s of accountSnaps) {
      const arr = byAccount.get(s.accountId) ?? []
      arr.push({ t: s.date.getTime(), balance: s.balance })
      byAccount.set(s.accountId, arr)
    }
    const nowMs = Date.now()
    const changeFor = (arr: Array<{ t: number; balance: number }>, days: number) => {
      const cutoff = nowMs - days * 86_400_000
      const base = arr.find((p) => p.t >= cutoff) ?? arr[0]
      return arr[arr.length - 1].balance - base.balance
    }
    const accountChanges: Record<string, Record<string, number>> = {}
    for (const [accountId, arr] of byAccount) {
      if (arr.length === 0) continue
      accountChanges[accountId] = {
        D: changeFor(arr, 1),
        W: changeFor(arr, 7),
        M: changeFor(arr, 30),
        "3M": changeFor(arr, 90),
        "6M": changeFor(arr, 180),
        "1Y": changeFor(arr, 365),
        ALL: arr[arr.length - 1].balance - arr[0].balance,
      }
    }

    return NextResponse.json({
      totalNetWorth,
      fiat: {
        cash: fiatCash,
        savings: fiatSavings,
        investments: fiatInvestments,
        debt: fiatDebt,
        netWorth: fiatNetWorth,
      },
      crypto: {
        value: cryptoValue,
        stablecoins: cryptoStablecoins,
        digitalAssets: cryptoDigitalAssets,
        // Live portfolio total (current); null = not a stale snapshot timestamp.
        snapshotAt: null,
      },
      history,
      breakdownHistory,
      accountChanges,
    })
  } catch (error) {
    return apiError("NW002", "Failed to compute net worth", 500, error)
  }
}
