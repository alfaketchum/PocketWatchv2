/**
 * Finance dashboard chart breakdowns: assets stacked by account group
 * (Cash / Savings / Investments / Other) or per account (biggest accounts as
 * their own bands, the rest in Misc). Built from per-account daily snapshots,
 * forward-filled; today uses live balances so the last point matches the
 * headline. Debt isn't stacked — it's shown per day in the tooltip footer.
 */

import { db } from "@/lib/db"
import { ASSET_ORDER, GROUP_META, groupOf, type GroupKey } from "@/components/net-worth/account-groups"
import type { CompositionResponse, FinanceCompositionMode } from "@/types/composition"

/** Lookback per range key; null = everything */
export const FINANCE_COMPOSITION_RANGES: Record<string, number | null> = {
  "1w": 7, "1m": 30, "3m": 90, "6m": 180, "1y": 365, all: null,
}

const DAY_MS = 86_400_000
/** Accounts shown as their own band in "account" mode; the rest go to Misc */
const MAX_ACCOUNT_BANDS = 8
/** Largest Misc contents listed in the tooltip */
const MISC_DETAIL_ROWS = 5
const MISC_KEY = "misc"
/** Crypto groups are injected from the portfolio elsewhere, never finance accounts */
const FINANCE_ASSET_GROUPS: GroupKey[] = ASSET_ORDER.filter((g) => g !== "stablecoin" && g !== "digital")

interface Account {
  id: string
  label: string
  group: GroupKey
  isDebt: boolean
  current: number
}

type Response = CompositionResponse<FinanceCompositionMode>

function utcDay(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS
}

async function loadAccounts(userId: string, includeInvestments: boolean): Promise<Account[]> {
  const rows = await db.financeAccount.findMany({
    where: { userId, isHidden: false },
    select: { id: true, name: true, officialName: true, mask: true, type: true, subtype: true, currentBalance: true },
  })
  return rows
    .map((a) => {
      const group = groupOf(a.type, a.subtype)
      const name = a.officialName || a.name
      return {
        id: a.id,
        label: a.mask && !name.includes(a.mask) ? `${name} ••${a.mask}` : name,
        group,
        isDebt: GROUP_META[group].kind === "liability",
        current: a.currentBalance ?? 0,
      }
    })
    .filter((a) => includeInvestments || a.group !== "investment")
}

/** Per account: date (UTC day ms) → balance, plus each account's last balance before the window. */
async function loadBalances(userId: string, accounts: Account[], startMs: number | null) {
  const ids = accounts.map((a) => a.id)
  const start = startMs === null ? undefined : new Date(startMs)
  const [inWindow, before] = await Promise.all([
    db.financeAccountSnapshot.findMany({
      where: { userId, accountId: { in: ids }, ...(start ? { date: { gte: start } } : {}) },
      select: { accountId: true, date: true, balance: true },
      orderBy: { date: "asc" },
    }),
    start
      ? Promise.all(ids.map((accountId) => db.financeAccountSnapshot.findFirst({
        where: { accountId, date: { lt: start } },
        orderBy: { date: "desc" },
        select: { accountId: true, balance: true },
      })))
      : Promise.resolve([]),
  ])
  const byAccount = new Map<string, Map<number, number>>()
  for (const s of inWindow) {
    const days = byAccount.get(s.accountId) ?? new Map<number, number>()
    days.set(utcDay(s.date.getTime()), s.balance)
    byAccount.set(s.accountId, days)
  }
  const opening = new Map(before.filter((b) => b !== null).map((b) => [b.accountId, b.balance]))
  const firstDay = inWindow.length > 0 ? utcDay(inWindow[0].date.getTime()) : null
  return { byAccount, opening, firstDay }
}

/** Daily per-account balances (debt as a positive amount owed), forward-filled. */
function dailyBalances(accounts: Account[], balances: Awaited<ReturnType<typeof loadBalances>>, days: number[]) {
  const today = days[days.length - 1]
  const last = new Map(accounts.map((a) => [a.id, balances.opening.get(a.id) ?? 0]))
  return days.map((day) => {
    const row = new Map<string, number>()
    for (const a of accounts) {
      const snap = balances.byAccount.get(a.id)?.get(day)
      if (snap !== undefined) last.set(a.id, snap)
      const raw = day === today ? a.current : last.get(a.id)!
      row.set(a.id, a.isDebt ? Math.abs(raw) : raw)
    }
    return row
  })
}

function categoryLayers(accounts: Account[]) {
  const present = new Set(accounts.filter((a) => !a.isDebt).map((a) => a.group))
  return FINANCE_ASSET_GROUPS.filter((g) => present.has(g)).map((g) => ({ key: g, label: GROUP_META[g].label }))
}

/** Biggest asset accounts (by peak balance in the window) get bands; bottom → top by group, then size. */
function accountBands(assets: Account[], rows: Array<Map<string, number>>): Account[] {
  const peak = new Map(assets.map((a) => [a.id, Math.max(0, ...rows.map((r) => r.get(a.id) ?? 0))]))
  const top = [...assets].filter((a) => peak.get(a.id)! > 0)
    .sort((x, y) => peak.get(y.id)! - peak.get(x.id)!)
    .slice(0, MAX_ACCOUNT_BANDS)
  const groupRank = (g: GroupKey) => FINANCE_ASSET_GROUPS.indexOf(g)
  return top.sort((x, y) => groupRank(x.group) - groupRank(y.group) || peak.get(y.id)! - peak.get(x.id)!)
}

export async function buildFinanceComposition(
  userId: string,
  mode: FinanceCompositionMode,
  range: string,
  includeInvestments: boolean,
): Promise<Response> {
  const accounts = await loadAccounts(userId, includeInvestments)
  if (accounts.length === 0) return { mode, layers: [], points: [] }

  const today = utcDay(Date.now())
  const lookback = range in FINANCE_COMPOSITION_RANGES ? FINANCE_COMPOSITION_RANGES[range] : FINANCE_COMPOSITION_RANGES["1y"]
  const startMs = lookback === null ? null : today - lookback * DAY_MS
  const balances = await loadBalances(userId, accounts, startMs)
  const firstDay = startMs ?? balances.firstDay ?? today
  const days = Array.from({ length: Math.round((today - firstDay) / DAY_MS) + 1 }, (_, i) => firstDay + i * DAY_MS)
  const rows = dailyBalances(accounts, balances, days)

  const assets = accounts.filter((a) => !a.isDebt)
  const debts = accounts.filter((a) => a.isDebt)
  const banded = mode === "account" ? accountBands(assets, rows) : []
  const bandIds = new Set(banded.map((a) => a.id))
  const misc = assets.filter((a) => !bandIds.has(a.id))

  const layers = mode === "category"
    ? categoryLayers(accounts)
    : [
      ...banded.map((a) => ({ key: a.id, label: a.label })),
      ...(misc.length > 0 ? [{ key: MISC_KEY, label: "Misc" }] : []),
    ]

  const points = days.map((t, i) => {
    const row = rows[i]
    const values: Record<string, number> = {}
    for (const a of assets) {
      const key = mode === "category" ? a.group : bandIds.has(a.id) ? a.id : MISC_KEY
      values[key] = (values[key] ?? 0) + (row.get(a.id) ?? 0)
    }
    const assetTotal = assets.reduce((s, a) => s + (row.get(a.id) ?? 0), 0)
    const debt = debts.reduce((s, a) => s + (row.get(a.id) ?? 0), 0)
    const miscDetails = mode === "account" && misc.length > 0
      ? misc.map((a) => ({ label: a.label, value: row.get(a.id) ?? 0 }))
        .filter((d) => d.value > 0.5)
        .sort((x, y) => y.value - x.value)
        .slice(0, MISC_DETAIL_ROWS)
      : []
    return {
      t,
      values,
      ...(miscDetails.length > 0 ? { details: { [MISC_KEY]: miscDetails } } : {}),
      footer: [
        { label: "Debt", value: -debt },
        { label: "Net worth", value: assetTotal - debt },
      ],
    }
  })

  return { mode, layers, points }
}
