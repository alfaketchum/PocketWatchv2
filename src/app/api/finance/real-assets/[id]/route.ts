import { NextResponse, type NextRequest } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { Prisma } from "@/generated/prisma/client"
import { isOwnLoan, realAssetUpdateSchema, todayUtc } from "@/lib/finance/real-assets-input"

type Params = { params: Promise<{ id: string }> }

async function ownAsset(userId: string, id: string) {
  return db.realAsset.findFirst({ where: { id, userId }, select: { id: true, value: true } })
}

/** PATCH: edit an asset. A new value is recorded for today, so history keeps the old ones. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return apiError("RA11", "Authentication required", 401)
  const { id } = await params
  const parsed = realAssetUpdateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError("RA12", parsed.error.issues[0]?.message ?? "Invalid asset", 400)
  try {
    const existing = await ownAsset(user.id, id)
    if (!existing) return apiError("RA13", "Asset not found", 404)
    const { value, homeDetails, ...rest } = parsed.data
    if (!(await isOwnLoan(user.id, rest.loanAccountId))) return apiError("RA14", "Loan account not found", 404)
    const today = todayUtc()
    const revalued = value !== undefined && value !== existing.value
    await db.$transaction([
      db.realAsset.update({
        where: { id },
        data: {
          ...rest,
          ...(homeDetails !== undefined ? { homeDetails: (homeDetails ?? Prisma.DbNull) as Prisma.InputJsonValue } : {}),
          ...(revalued ? { value, valueAsOf: today } : {}),
        },
      }),
      ...(revalued
        ? [db.realAssetValue.upsert({ where: { assetId_date: { assetId: id, date: today } }, create: { assetId: id, date: today, value }, update: { value } })]
        : []),
    ])
    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiError("RA15", "Failed to update the asset", 500, err)
  }
}

/** DELETE: remove an asset and its value history. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return apiError("RA16", "Authentication required", 401)
  const { id } = await params
  try {
    if (!(await ownAsset(user.id, id))) return apiError("RA17", "Asset not found", 404)
    await db.realAsset.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiError("RA18", "Failed to delete the asset", 500, err)
  }
}
