import { NextResponse, type NextRequest } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import type { Prisma } from "@/generated/prisma/client"
import { valueAt } from "@/lib/finance/real-assets"
import { isOwnLoan, loadLoanAccounts, realAssetCreateSchema, todayUtc } from "@/lib/finance/real-assets-input"
import { loadRealAssets, MAX_REAL_ASSETS } from "@/lib/finance/real-assets-store"

/** GET: the user's homes, vehicles and other assets with today's estimated value, plus loans they can link. */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("RA01", "Authentication required", 401)
  try {
    const [assets, loans] = await Promise.all([loadRealAssets(user.id), loadLoanAccounts(user.id)])
    const now = new Date()
    return NextResponse.json({
      assets: assets.map((a) => ({ ...a, estimatedValue: valueAt(a, now) })),
      loans: loans.map((l) => ({ id: l.id, name: l.name, balance: Math.abs(l.currentBalance ?? 0) })),
    })
  } catch (err) {
    return apiError("RA02", "Failed to load homes and vehicles", 500, err)
  }
}

/** POST: add a home, vehicle or other asset, valued today. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("RA03", "Authentication required", 401)
  const parsed = realAssetCreateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError("RA04", parsed.error.issues[0]?.message ?? "Invalid asset", 400)
  try {
    const input = parsed.data
    if (!(await isOwnLoan(user.id, input.loanAccountId))) return apiError("RA05", "Loan account not found", 404)
    const count = await db.realAsset.count({ where: { userId: user.id } })
    if (count >= MAX_REAL_ASSETS) return apiError("RA06", `You can add up to ${MAX_REAL_ASSETS}`, 400)
    const today = todayUtc()
    const asset = await db.realAsset.create({
      data: {
        userId: user.id,
        kind: input.kind,
        name: input.name,
        value: input.value,
        valueAsOf: today,
        appreciation: input.appreciation,
        purchasePrice: input.purchasePrice ?? null,
        purchaseDate: input.purchaseDate ?? null,
        loanAccountId: input.loanAccountId ?? null,
        address: input.address ?? null,
        propertyTaxAnnual: input.propertyTaxAnnual ?? null,
        rentEstimate: input.rentEstimate ?? null,
        homeDetails: (input.homeDetails ?? undefined) as Prisma.InputJsonValue | undefined,
        dataSource: input.dataSource ?? null,
        dataAsOf: input.dataAsOf ?? null,
        values: { create: { date: today, value: input.value } },
      },
      select: { id: true },
    })
    return NextResponse.json({ id: asset.id }, { status: 201 })
  } catch (err) {
    return apiError("RA07", "Failed to add the asset", 500, err)
  }
}
