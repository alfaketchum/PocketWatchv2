import { NextResponse, type NextRequest } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { ROADMAP_SEED } from "@/lib/roadmap/roadmap-seed"
import { createRoadmapSchema, MAX_ROADMAP_ITEMS, ROADMAP_SELECT } from "@/lib/roadmap/roadmap-schema"

/** GET: the user's roadmap; the first visit seeds it from the ProjectionLab review. */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("RDM01", "Authentication required", 401)

  try {
    const count = await db.roadmapItem.count({ where: { userId: user.id } })
    if (count === 0) {
      await db.roadmapItem.createMany({
        data: ROADMAP_SEED.map(({ status, ...item }) => ({ ...item, status: status ?? "backlog", userId: user.id })),
        skipDuplicates: true,
      })
    }
    const items = await db.roadmapItem.findMany({
      where: { userId: user.id },
      select: ROADMAP_SELECT,
      orderBy: [{ rank: "asc" }, { createdAt: "asc" }],
      take: MAX_ROADMAP_ITEMS,
    })
    return NextResponse.json({ items })
  } catch (err) {
    return apiError("RDM02", "Failed to load the roadmap", 500, err)
  }
}

/** POST: add a feature by hand; it goes to the end of its tier's ranking. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("RDM03", "Authentication required", 401)

  const parsed = createRoadmapSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError("RDM04", parsed.error.issues[0]?.message ?? "Invalid feature", 400)

  try {
    const [count, last] = await Promise.all([
      db.roadmapItem.count({ where: { userId: user.id } }),
      db.roadmapItem.findFirst({ where: { userId: user.id }, orderBy: { rank: "desc" }, select: { rank: true } }),
    ])
    if (count >= MAX_ROADMAP_ITEMS) return apiError("RDM05", `The roadmap holds up to ${MAX_ROADMAP_ITEMS} features`, 400)
    const item = await db.roadmapItem.create({
      data: { ...parsed.data, userId: user.id, rank: (last?.rank ?? 0) + 1, demand: "", plStatus: "", ourStatus: "" },
      select: ROADMAP_SELECT,
    })
    return NextResponse.json({ item }, { status: 201 })
  } catch (err) {
    return apiError("RDM06", "Failed to add the feature", 500, err)
  }
}
