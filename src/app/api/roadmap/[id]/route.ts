import { NextResponse, type NextRequest } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { patchRoadmapSchema, ROADMAP_SELECT } from "@/lib/roadmap/roadmap-schema"

type RouteContext = { params: Promise<{ id: string }> }

/** PATCH: change a feature's status, notes, tier, rank or text. */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const user = await getCurrentUser()
  if (!user) return apiError("RDM11", "Authentication required", 401)
  const { id } = await ctx.params

  const parsed = patchRoadmapSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError("RDM12", parsed.error.issues[0]?.message ?? "Invalid update", 400)

  try {
    const owned = await db.roadmapItem.findFirst({ where: { id, userId: user.id }, select: { id: true } })
    if (!owned) return apiError("RDM13", "Feature not found", 404)
    const item = await db.roadmapItem.update({ where: { id }, data: parsed.data, select: ROADMAP_SELECT })
    return NextResponse.json({ item })
  } catch (err) {
    return apiError("RDM14", "Failed to update the feature", 500, err)
  }
}

/** DELETE: remove a feature from the roadmap. */
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const user = await getCurrentUser()
  if (!user) return apiError("RDM21", "Authentication required", 401)
  const { id } = await ctx.params

  try {
    const { count } = await db.roadmapItem.deleteMany({ where: { id, userId: user.id } })
    if (count === 0) return apiError("RDM22", "Feature not found", 404)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiError("RDM23", "Failed to remove the feature", 500, err)
  }
}
