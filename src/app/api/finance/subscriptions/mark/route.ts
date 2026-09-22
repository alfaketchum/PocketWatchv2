/**
 * POST /api/finance/subscriptions/mark
 * Mark (or unmark) a transaction — and its past same-merchant transactions — as
 * a subscription. Marking tags them "subscription" and find-or-creates an active
 * FinanceSubscription (detectionMethod "manual"); unmarking removes the tag and
 * dismisses the subscription.
 */

import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { invalidateCache } from "@/lib/cache"
import { syncSubscriptionTag } from "@/lib/finance/subscription-tag"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod/v4"

const schema = z.object({
  transactionId: z.string().min(1),
  unmark: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("SM001", "Authentication required", 401)

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError("SM002", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  const { transactionId, unmark } = parsed.data

  const tx = await db.financeTransaction.findFirst({
    where: { id: transactionId, userId: user.id },
    select: { id: true, merchantName: true, name: true, amount: true, category: true, accountId: true, date: true },
  })
  if (!tx) return apiError("SM003", "Transaction not found", 404)

  const merchant = (tx.merchantName ?? tx.name).trim()
  if (!merchant) return apiError("SM004", "Transaction has no merchant", 400)

  try {
    const count = await syncSubscriptionTag(user.id, merchant, !unmark)

    if (unmark) {
      await db.financeSubscription.updateMany({
        where: { userId: user.id, merchantName: { equals: merchant, mode: "insensitive" } },
        data: { status: "dismissed" },
      })
    } else {
      const existing = await db.financeSubscription.findFirst({
        where: { userId: user.id, merchantName: { equals: merchant, mode: "insensitive" } },
      })
      if (existing) {
        await db.financeSubscription.update({
          where: { id: existing.id },
          data: { status: "active", isWanted: true, detectionMethod: "manual", lastTransactionId: tx.id },
        })
      } else {
        await db.financeSubscription.create({
          data: {
            userId: user.id,
            merchantName: merchant,
            amount: Math.abs(tx.amount),
            frequency: "monthly",
            category: tx.category,
            accountId: tx.accountId,
            lastChargeDate: tx.date,
            lastTransactionId: tx.id,
            status: "active",
            detectionMethod: "manual",
            billType: "subscription",
          },
        })
      }
    }

    invalidateCache("spending")
    invalidateCache("insights")
    invalidateCache("trends")
    invalidateCache("budgets")

    return NextResponse.json({ ok: true, merchant, count })
  } catch (err) {
    return apiError("SM005", "Failed to update subscription mark", 500, err)
  }
}
