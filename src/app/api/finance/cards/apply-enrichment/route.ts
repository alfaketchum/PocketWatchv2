import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod/v4"
import { getPeriodBoundaries } from "@/lib/finance/perk-periods"
import { classifyPerkType, detectPeriod } from "@/lib/finance/perk-classification"

const schema = z.object({ cardProfileId: z.string().min(1) })

/** Map AI category names → FINANCE_CATEGORIES keys */
const CATEGORY_MAP: Record<string, string> = {
  "Dining": "Food & Dining",
  "Restaurants": "Food & Dining",
  "Dining & Restaurants": "Food & Dining",
  "U.S. Restaurants": "Food & Dining",
  "Groceries": "Shopping",
  "Supermarkets": "Shopping",
  "U.S. Supermarkets": "Shopping",
  "Online Shopping": "Shopping",
  "Retail": "Shopping",
  "Amazon": "Shopping",
  "Travel": "Travel",
  "Hotels": "Travel",
  "Airlines": "Travel",
  "Flights": "Travel",
  "Airfare": "Travel",
  "Gas": "Transportation",
  "Gas Stations": "Transportation",
  "Fuel": "Transportation",
  "Transit": "Transportation",
  "Rideshare": "Transportation",
  "Uber/Lyft": "Transportation",
  "Streaming": "Entertainment",
  "Streaming Services": "Entertainment",
  "Drug Stores": "Healthcare",
  "Pharmacies": "Healthcare",
  "Home Improvement": "Housing",
  "Rent": "Housing",
  "Utilities": "Bills & Utilities",
  "Phone": "Bills & Utilities",
  "Insurance": "Insurance",
  "Education": "Education",
  "Tuition": "Education",
}

/** Infer reward program from transfer partner names */
const PROGRAM_SIGNALS: Array<{ keywords: string[]; program: string; pointValue: number }> = [
  { keywords: ["United", "Hyatt", "Southwest", "IHG", "Marriott Bonvoy"], program: "Chase Ultimate Rewards", pointValue: 1.5 },
  { keywords: ["Delta", "Hilton", "British Airways", "ANA", "Cathay"], program: "Amex Membership Rewards", pointValue: 1.0 },
  { keywords: ["JetBlue", "Turkish"], program: "Citi ThankYou Points", pointValue: 1.0 },
  { keywords: ["Wyndham", "Choice"], program: "Capital One Miles", pointValue: 1.0 },
]

function mapCategory(aiCategory: string): string {
  const direct = CATEGORY_MAP[aiCategory]
  if (direct) return direct
  const lower = aiCategory.toLowerCase()
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key.toLowerCase())) return val
  }
  return aiCategory
}

/**
 * POST: Read aiEnrichedData from a card and replace structured DB rows
 * (reward rates, perks, profile updates). AI is the source of truth on refresh.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("AE01", "Authentication required", 401)

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError("AE02", "Invalid request", 400)

  const card = await db.creditCardProfile.findFirst({
    where: { id: parsed.data.cardProfileId, userId: user.id },
  })
  if (!card) return apiError("AE03", "Card not found", 404)
  if (!card.aiEnrichedData) return apiError("AE04", "Card has no enrichment data", 400)

  try {
    const enriched = card.aiEnrichedData as Record<string, unknown>
    const multipliers = Array.isArray(enriched.rewardMultipliers) ? enriched.rewardMultipliers : []
    const benefits = Array.isArray(enriched.benefits) ? enriched.benefits : []
    const partners = Array.isArray(enriched.transferPartners) ? enriched.transferPartners : []

    // ── 1. Replace reward rates (delete all old, insert fresh from AI) ──
    await db.creditCardRewardRate.deleteMany({ where: { cardProfileId: card.id } })

    let ratesCreated = 0
    let baseRate = card.baseRewardRate
    const rewardUnit = multipliers[0]?.unit as string | undefined

    // Deduplicate by mapped category — keep the highest rate when AI returns duplicates
    // (e.g. "Dining" and "Restaurants" both map to "Food & Dining")
    const categoryRates = new Map<string, { rate: number; rType: string }>()

    for (const m of multipliers) {
      const cat = String(m.category ?? "")
      const rate = Number(m.rate ?? 0)
      if (!cat || rate <= 0) continue

      if (/all other|everything else|base|other purchases/i.test(cat)) {
        baseRate = rate
        continue
      }

      const mapped = mapCategory(cat)
      const aiRewardType = typeof enriched.rewardType === "string" ? enriched.rewardType : null
      const rType = aiRewardType
        ?? (rewardUnit ? (rewardUnit.toLowerCase().includes("mile") ? "miles" : rewardUnit.toLowerCase().includes("point") ? "points" : "cashback") : card.rewardType)

      const existing = categoryRates.get(mapped)
      if (!existing || rate > existing.rate) {
        categoryRates.set(mapped, { rate, rType })
      }
    }

    for (const [spendingCategory, { rate, rType }] of categoryRates) {
      await db.creditCardRewardRate.create({
        data: { cardProfileId: card.id, spendingCategory, rewardRate: rate, rewardType: rType },
      })
      ratesCreated++
    }

    // ── 2. Replace perks (delete all old, insert fresh from AI) ──
    await db.creditCardPerk.deleteMany({ where: { cardProfileId: card.id } })

    let perksCreated = 0
    const seenNames = new Set<string>()
    for (const b of benefits) {
      const name = String(b.name ?? "").trim()
      if (!name || seenNames.has(name.toLowerCase())) continue

      const val = typeof b.value === "number" ? b.value : 0
      const perkType = classifyPerkType(name, val, b.perkType as string | undefined)
      const period = detectPeriod(name, b.period as string | undefined)
      const bounds = getPeriodBoundaries(period, 1)

      await db.creditCardPerk.create({
        data: {
          cardProfileId: card.id,
          name,
          value: val,
          maxValue: val,
          perkType,
          period,
          periodResetDay: 1,
          currentPeriodStart: bounds.start,
          description: typeof b.description === "string" ? b.description : null,
          isUsed: false,
          usedValue: 0,
        },
      })
      seenNames.add(name.toLowerCase())
      perksCreated++
    }

    // ── 3. Update card profile — AI is source of truth ──
    const profileUpdate: Record<string, unknown> = {}

    // Always update base rate from AI
    if (baseRate !== card.baseRewardRate) profileUpdate.baseRewardRate = baseRate

    // Always update reward type from AI unit
    if (rewardUnit) {
      const lower = rewardUnit.toLowerCase()
      if (lower.includes("mile")) profileUpdate.rewardType = "miles"
      else if (lower.includes("point")) profileUpdate.rewardType = "points"
      else if (lower.includes("cash")) profileUpdate.rewardType = "cashback"
    }

    // Always infer reward program from transfer partners
    if (partners.length > 0) {
      const partnerNames = partners.map((p) => String(p.name ?? "").toLowerCase())
      for (const sig of PROGRAM_SIGNALS) {
        if (sig.keywords.some((kw) => partnerNames.some((pn) => pn.includes(kw.toLowerCase())))) {
          profileUpdate.rewardProgram = sig.program
          if (!card.pointValue) profileUpdate.pointValue = sig.pointValue
          break
        }
      }
    }

    // Always update annual fee from AI
    const aiFee = enriched.annualFee
    if (typeof aiFee === "number") {
      profileUpdate.annualFee = aiFee
    }

    // Save AI transfer partners to DB
    if (partners.length > 0) {
      profileUpdate.transferPartners = partners.map((p) => ({
        name: String(p.name ?? ""),
        ratio: String(p.ratio ?? "1:1"),
        shortCode: String(p.shortCode ?? ""),
      }))
    }

    // Clear manual bonusCategories — AI reward rates replace them
    profileUpdate.bonusCategories = []

    if (Object.keys(profileUpdate).length > 0) {
      await db.creditCardProfile.update({ where: { id: card.id }, data: profileUpdate })
    }

    return NextResponse.json({ ratesCreated, perksCreated, baseRewardRate: baseRate })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error("[apply-enrichment] Failed:", detail, err)
    return apiError("AE05", `Failed to apply enrichment: ${detail}`, 500, err)
  }
}

