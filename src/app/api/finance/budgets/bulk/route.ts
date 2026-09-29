import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { getBudgetableCategories } from "@/lib/finance/categories"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod/v4"

const MAX_ENTRIES = 50

const categorySchema = z.string().min(1).max(100)

const bulkSchema = z.object({
  upsert: z.array(z.object({
    category: categorySchema,
    monthlyLimit: z.number().positive("Monthly limit must be positive"),
  })).max(MAX_ENTRIES),
  remove: z.array(categorySchema).max(MAX_ENTRIES),
})

/**
 * PUT: Save a whole budget plan in one transaction — upsert the given categories
 * (re-activating any previously removed) and deactivate the removed ones.
 */
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("BBK01", "Authentication required", 401)

  const body = await req.json().catch(() => null)
  const parsed = bulkSchema.safeParse(body)
  if (!parsed.success) {
    return apiError("BBK02", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  const { upsert, remove } = parsed.data
  const upsertSet = new Set(upsert.map((u) => u.category))
  if (upsertSet.size !== upsert.length) return apiError("BBK03", "Duplicate categories in plan", 400)
  if (remove.some((c) => upsertSet.has(c))) return apiError("BBK04", "A category cannot be both saved and removed", 400)

  try {
    // New categories must be budgetable; existing budget categories can always be kept.
    const existing = await db.financeBudget.findMany({ where: { userId: user.id }, select: { category: true } })
    const allowed = new Set([...getBudgetableCategories(), ...existing.map((b) => b.category)])
    const unknown = upsert.find((u) => !allowed.has(u.category))
    if (unknown) return apiError("BBK06", `Unknown budget category: ${unknown.category}`, 400)

    await db.$transaction([
      ...upsert.map(({ category, monthlyLimit }) =>
        db.financeBudget.upsert({
          where: { userId_category: { userId: user.id, category } },
          create: { userId: user.id, category, monthlyLimit },
          update: { monthlyLimit, isActive: true },
        }),
      ),
      db.financeBudget.updateMany({
        where: { userId: user.id, category: { in: remove } },
        data: { isActive: false },
      }),
    ])
    return NextResponse.json({ saved: upsert.length, removed: remove.length })
  } catch (err) {
    return apiError("BBK05", "Failed to save budget plan", 500, err)
  }
}
