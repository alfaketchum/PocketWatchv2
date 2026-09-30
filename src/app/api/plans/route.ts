import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import type { Prisma } from "@/generated/prisma/client"
import { MAX_PLANS_PER_USER, PLAN_SCHEMA_VERSION } from "@/lib/plans/plan-constants"
import { blankPlanForUser, PLAN_META_SELECT, readPlanDocument, summaryFor } from "@/lib/plans/plan-records"
import { planDocumentSchema, planNameSchema } from "@/lib/plans/plan-schema"
import type { PlanDocument } from "@/lib/plans/plan-types"

const createSchema = z.discriminatedUnion("from", [
  z.object({ from: z.literal("blank"), name: planNameSchema }),
  z.object({ from: z.literal("import"), name: planNameSchema, document: planDocumentSchema }),
  z.object({ from: z.literal("duplicate"), name: planNameSchema, sourcePlanId: z.string().min(1).max(64) }),
])

/** GET: the user's plans with their key numbers, primary first. */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("PLN01", "Authentication required", 401)

  try {
    const plans = await db.plan.findMany({
      where: { userId: user.id },
      select: { ...PLAN_META_SELECT, document: true },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      take: MAX_PLANS_PER_USER,
    })
    const items = plans.map(({ document, ...meta }) => ({ ...meta, summary: summaryFor(meta.id, document) }))
    return NextResponse.json({ plans: items })
  } catch (err) {
    return apiError("PLN02", "Failed to load plans", 500, err)
  }
}

async function sourceDocument(userId: string, sourcePlanId: string): Promise<PlanDocument | null> {
  const source = await db.plan.findFirst({
    where: { id: sourcePlanId, userId },
    select: { id: true, document: true },
  })
  return source ? readPlanDocument(source.id, source.document) : null
}

/** POST: create a plan — blank, from imported data, or as a copy of another plan. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("PLN03", "Authentication required", 401)

  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError("PLN04", parsed.error.issues[0]?.message ?? "Invalid plan", 400)
  const body = parsed.data

  try {
    const count = await db.plan.count({ where: { userId: user.id } })
    if (count >= MAX_PLANS_PER_USER) return apiError("PLN05", `You can have up to ${MAX_PLANS_PER_USER} plans`, 400)

    let document: PlanDocument | null
    if (body.from === "blank") document = await blankPlanForUser(user.id)
    else if (body.from === "import") document = body.document
    else document = await sourceDocument(user.id, body.sourcePlanId)
    if (!document) return apiError("PLN06", "Plan to copy was not found", 404)

    const plan = await db.plan.create({
      data: {
        userId: user.id,
        name: body.name,
        isPrimary: count === 0,
        schemaVersion: PLAN_SCHEMA_VERSION,
        document: document as unknown as Prisma.InputJsonValue,
      },
      select: PLAN_META_SELECT,
    })
    return NextResponse.json({ plan }, { status: 201 })
  } catch (err) {
    return apiError("PLN07", "Failed to create plan", 500, err)
  }
}
