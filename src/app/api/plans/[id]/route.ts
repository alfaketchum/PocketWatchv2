import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { PLAN_META_SELECT, readPlanDocument } from "@/lib/plans/plan-records"
import { planDocumentSchema, planNameSchema } from "@/lib/plans/plan-schema"

type RouteContext = { params: Promise<{ id: string }> }

const putSchema = z.object({
  document: planDocumentSchema,
  /** The version the client edited; a newer save from elsewhere returns 409. */
  expectedUpdatedAt: z.iso.datetime().optional(),
})

const patchSchema = z
  .object({ name: planNameSchema.optional(), isPrimary: z.literal(true).optional() })
  .refine((b) => b.name !== undefined || b.isPrimary !== undefined, "Nothing to update")

/** GET: one plan with its document. */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const user = await getCurrentUser()
  if (!user) return apiError("PLN11", "Authentication required", 401)
  const { id } = await ctx.params

  try {
    const plan = await db.plan.findFirst({
      where: { id, userId: user.id },
      select: { ...PLAN_META_SELECT, document: true },
    })
    if (!plan) return apiError("PLN12", "Plan not found", 404)
    const document = readPlanDocument(plan.id, plan.document)
    if (!document) return apiError("PLN13", "This plan could not be read", 500)
    return NextResponse.json({ plan: { ...plan, document } })
  } catch (err) {
    return apiError("PLN14", "Failed to load plan", 500, err)
  }
}

/** PUT: replace the plan's document. */
export async function PUT(req: NextRequest, ctx: RouteContext) {
  const user = await getCurrentUser()
  if (!user) return apiError("PLN21", "Authentication required", 401)
  const { id } = await ctx.params

  const parsed = putSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError("PLN22", parsed.error.issues[0]?.message ?? "Invalid plan", 400)
  const { document, expectedUpdatedAt } = parsed.data

  try {
    const result = await db.plan.updateMany({
      where: {
        id,
        userId: user.id,
        ...(expectedUpdatedAt ? { updatedAt: new Date(expectedUpdatedAt) } : {}),
      },
      data: { document },
    })
    if (result.count === 0) {
      const exists = await db.plan.findFirst({ where: { id, userId: user.id }, select: { id: true } })
      if (!exists) return apiError("PLN23", "Plan not found", 404)
      return apiError("PLN24", "This plan was changed in another tab. Reloaded the latest version.", 409)
    }
    const plan = await db.plan.findFirst({ where: { id, userId: user.id }, select: PLAN_META_SELECT })
    return NextResponse.json({ plan })
  } catch (err) {
    return apiError("PLN25", "Failed to save plan", 500, err)
  }
}

/** PATCH: rename, or make this the primary plan. */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const user = await getCurrentUser()
  if (!user) return apiError("PLN31", "Authentication required", 401)
  const { id } = await ctx.params

  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError("PLN32", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  const { name, isPrimary } = parsed.data

  try {
    const existing = await db.plan.findFirst({ where: { id, userId: user.id }, select: { id: true } })
    if (!existing) return apiError("PLN33", "Plan not found", 404)
    const plan = await db.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.plan.updateMany({ where: { userId: user.id, NOT: { id } }, data: { isPrimary: false } })
      }
      return tx.plan.update({
        where: { id },
        data: { ...(name !== undefined ? { name } : {}), ...(isPrimary ? { isPrimary: true } : {}) },
        select: PLAN_META_SELECT,
      })
    })
    return NextResponse.json({ plan })
  } catch (err) {
    return apiError("PLN34", "Failed to update plan", 500, err)
  }
}

/** DELETE: remove a plan. If it was primary, the oldest remaining plan becomes primary. */
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const user = await getCurrentUser()
  if (!user) return apiError("PLN41", "Authentication required", 401)
  const { id } = await ctx.params

  try {
    const existing = await db.plan.findFirst({ where: { id, userId: user.id }, select: { isPrimary: true } })
    if (!existing) return apiError("PLN42", "Plan not found", 404)
    await db.$transaction(async (tx) => {
      await tx.plan.delete({ where: { id } })
      if (!existing.isPrimary) return
      const next = await tx.plan.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })
      if (next) await tx.plan.update({ where: { id: next.id }, data: { isPrimary: true } })
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiError("PLN43", "Failed to delete plan", 500, err)
  }
}
