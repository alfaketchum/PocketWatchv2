import { NextResponse, type NextRequest } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { creditScoreUpdateSchema } from "@/lib/finance/credit-scores"

type Params = { params: Promise<{ id: string }> }

async function ownScore(userId: string, id: string) {
  return db.creditScore.findFirst({ where: { id, userId }, select: { id: true } })
}

/** PATCH: correct a logged score. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return apiError("CS11", "Authentication required", 401)
  const { id } = await params
  const parsed = creditScoreUpdateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError("CS12", parsed.error.issues[0]?.message ?? "Invalid score", 400)
  try {
    if (!(await ownScore(user.id, id))) return apiError("CS13", "Score not found", 404)
    const { note, ...rest } = parsed.data
    await db.creditScore.update({ where: { id }, data: { ...rest, ...(note !== undefined ? { note: note || null } : {}) } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiError("CS14", "Failed to update the score", 500, err)
  }
}

/** DELETE: remove a logged score. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return apiError("CS15", "Authentication required", 401)
  const { id } = await params
  try {
    if (!(await ownScore(user.id, id))) return apiError("CS16", "Score not found", 404)
    await db.creditScore.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiError("CS17", "Failed to delete the score", 500, err)
  }
}
