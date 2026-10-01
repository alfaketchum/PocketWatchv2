import { NextResponse, type NextRequest } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { CARD_ACCOUNT_TYPES, cardUtilization, creditScoreCreateSchema, MAX_CREDIT_SCORES } from "@/lib/finance/credit-scores"

/** GET: logged credit scores (newest first) and today's card utilization from synced cards. */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("CS01", "Authentication required", 401)
  try {
    const [scores, cards] = await Promise.all([
      db.creditScore.findMany({
        where: { userId: user.id },
        orderBy: { date: "desc" },
        take: MAX_CREDIT_SCORES,
        select: { id: true, score: true, model: true, bureau: true, date: true, note: true },
      }),
      db.financeAccount.findMany({
        where: { userId: user.id, type: { in: CARD_ACCOUNT_TYPES }, isHidden: false, creditLimit: { not: null } },
        select: { name: true, currentBalance: true, creditLimit: true },
        take: 200,
      }),
    ])
    return NextResponse.json({ scores, utilization: cardUtilization(cards) })
  } catch (err) {
    return apiError("CS02", "Failed to load credit scores", 500, err)
  }
}

/** POST: log a score. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("CS03", "Authentication required", 401)
  const parsed = creditScoreCreateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError("CS04", parsed.error.issues[0]?.message ?? "Invalid score", 400)
  try {
    const count = await db.creditScore.count({ where: { userId: user.id } })
    if (count >= MAX_CREDIT_SCORES) return apiError("CS05", `You can keep up to ${MAX_CREDIT_SCORES} scores`, 400)
    const { bureau, note, ...rest } = parsed.data
    const created = await db.creditScore.create({
      data: { userId: user.id, ...rest, bureau: bureau ?? null, note: note || null },
      select: { id: true },
    })
    return NextResponse.json({ id: created.id }, { status: 201 })
  } catch (err) {
    return apiError("CS06", "Failed to save the score", 500, err)
  }
}
