import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod/v4"
import { getPeriodBoundaries } from "@/lib/finance/perk-periods"
import type { PerkPeriod } from "@/types/card-perks"

const schema = z.object({ cardProfileId: z.string().min(1) })

const PERK_PATTERNS: Array<{ keywords: string[]; merchants: string[]; categories: string[] }> = [
  { keywords: ["uber"], merchants: ["uber", "ubereats"], categories: [] },
  { keywords: ["lyft"], merchants: ["lyft"], categories: [] },
  { keywords: ["doordash", "dashpass"], merchants: ["doordash"], categories: [] },
  { keywords: ["grubhub"], merchants: ["grubhub"], categories: [] },
  { keywords: ["streaming"], merchants: ["netflix", "hulu", "disney", "spotify", "apple tv", "max", "paramount", "peacock", "youtube premium"], categories: ["Entertainment"] },
  { keywords: ["dining"], merchants: [], categories: ["Food & Dining"] },
  { keywords: ["restaurant"], merchants: [], categories: ["Food & Dining"] },
  { keywords: ["airline", "flight", "airfare"], merchants: ["united", "delta", "american airlines", "southwest", "jetblue", "alaska air"], categories: ["Travel"] },
  { keywords: ["hotel", "lodging"], merchants: ["marriott", "hilton", "hyatt", "ihg", "airbnb"], categories: ["Travel"] },
  { keywords: ["travel"], merchants: [], categories: ["Travel"] },
  { keywords: ["global entry", "tsa precheck", "clear"], merchants: ["global entry", "tsa", "clear"], categories: [] },
  { keywords: ["saks"], merchants: ["saks"], categories: [] },
  { keywords: ["walmart"], merchants: ["walmart", "wal-mart"], categories: [] },
  { keywords: ["instacart"], merchants: ["instacart"], categories: [] },
  { keywords: ["equinox", "gym", "fitness"], merchants: ["equinox", "planet fitness", "peloton"], categories: ["Fitness"] },
  { keywords: ["cell phone", "wireless"], merchants: ["t-mobile", "verizon", "at&t"], categories: ["Bills & Utilities"] },
]

function matchesPerk(perkName: string, txMerchant: string, txCategory: string | null): boolean {
  const perkLower = perkName.toLowerCase()
  const merchantLower = txMerchant.toLowerCase()
  const catLower = (txCategory ?? "").toLowerCase()
  for (const pattern of PERK_PATTERNS) {
    if (!pattern.keywords.some((kw) => perkLower.includes(kw))) continue
    if (pattern.merchants.some((m) => merchantLower.includes(m))) return true
    if (pattern.categories.some((c) => catLower.includes(c.toLowerCase()))) return true
  }
  return false
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("PU01", "Authentication required", 401)

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError("PU02", "Invalid request", 400)

  const card = await db.creditCardProfile.findFirst({
    where: { id: parsed.data.cardProfileId, userId: user.id },
  })
  if (!card) return apiError("PU03", "Card not found", 404)

  try {
    const perks = await db.creditCardPerk.findMany({ where: { cardProfileId: card.id } })
    if (perks.length === 0) return NextResponse.json({ matches: [] })

    const matches: Array<{ perkId: string; perkName: string; matched: boolean; matchCount: number; totalAmount: number }> = []

    for (const perk of perks) {
      if (perk.perkType === "unlimited") {
        matches.push({ perkId: perk.id, perkName: perk.name, matched: false, matchCount: 0, totalAmount: 0 })
        continue
      }

      // Only search transactions within the perk's current period
      const bounds = getPeriodBoundaries(perk.period as PerkPeriod, perk.periodResetDay)
      const transactions = await db.financeTransaction.findMany({
        where: {
          userId: user.id,
          accountId: card.accountId,
          date: { gte: bounds.start, lt: bounds.end },
          isDuplicate: false,
          isExcluded: false,
        },
        select: { id: true, merchantName: true, name: true, category: true, date: true, amount: true },
        orderBy: { date: "desc" },
      })

      let matchCount = 0
      let totalAmount = 0
      let latestDate: Date | null = null

      for (const tx of transactions) {
        const merchant = tx.merchantName || tx.name || ""
        if (matchesPerk(perk.name, merchant, tx.category)) {
          matchCount++
          totalAmount += Math.abs(tx.amount)
          if (!latestDate || tx.date > latestDate) latestDate = tx.date
        }
      }

      const matched = matchCount > 0
      const max = perk.maxValue > 0 ? perk.maxValue : perk.value
      const cappedUsed = Math.min(totalAmount, max)

      if (matched && cappedUsed > perk.usedValue) {
        await db.creditCardPerk.update({
          where: { id: perk.id },
          data: {
            usedValue: cappedUsed,
            isUsed: cappedUsed >= max,
            usedDate: latestDate,
            currentPeriodStart: bounds.start,
          },
        })
      }

      matches.push({ perkId: perk.id, perkName: perk.name, matched, matchCount, totalAmount: Math.round(totalAmount * 100) / 100 })
    }

    return NextResponse.json({ matches })
  } catch (err) {
    return apiError("PU04", "Failed to check perk usage", 500, err)
  }
}
