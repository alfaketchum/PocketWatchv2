/**
 * PATCH /api/accounts/senders/:id — set a sender's status: "unsubscribed" (after
 * the user followed a link / mailto unsubscribe), "kept" (hide from the junk
 * list), or "active" (undo).
 */

import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"

const patchSchema = z.object({
  status: z.enum(["active", "unsubscribed", "kept"]),
  method: z.enum(["link", "mailto"]).optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const user = await getCurrentUser()
  if (!user) return apiError("ACC61", "Authentication required", 401)

  const { id } = await ctx.params
  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return apiError("ACC62", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }
  const { status, method } = parsed.data

  try {
    const existing = await db.mailSender.findFirst({ where: { id, userId: user.id }, select: { id: true } })
    if (!existing) return apiError("ACC63", "Sender not found", 404)

    const sender = await db.mailSender.update({
      where: { id },
      data:
        status === "unsubscribed"
          ? { status, unsubscribedAt: new Date(), unsubscribeMethod: method ?? "link", lastError: null }
          : { status, ...(status === "active" ? { unsubscribedAt: null, unsubscribeMethod: null } : {}) },
      select: { id: true, status: true },
    })
    return NextResponse.json({ sender })
  } catch (err) {
    return apiError("ACC64", "Failed to update sender", 500, err)
  }
}
