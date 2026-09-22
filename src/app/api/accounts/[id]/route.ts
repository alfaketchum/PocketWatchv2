/**
 * Single discovered-account API.
 *
 * PATCH  /api/accounts/:id — dismiss/restore or edit service name/category/email.
 * DELETE /api/accounts/:id — permanently remove one discovered account.
 *
 * Session-guarded and userId-scoped. Editing a curated field sets userEdited so
 * future scans never clobber the user's correction.
 */

import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { hashAccountEmail } from "@/lib/email/account-hash"
import { Prisma } from "@/generated/prisma/client"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"

const patchSchema = z
  .object({
    status: z.enum(["active", "dismissed"]).optional(),
    serviceName: z.string().trim().min(1).max(60).optional(),
    category: z.string().trim().min(1).max(24).nullable().optional(),
    accountEmail: z.string().trim().email().max(200).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" })

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const user = await getCurrentUser()
  if (!user) return apiError("ACC20", "Authentication required", 401)

  const { id } = await ctx.params
  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return apiError("ACC21", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  try {
    const existing = await db.discoveredAccount.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    })
    if (!existing) return apiError("ACC22", "Account not found", 404)

    const { status, serviceName, category, accountEmail } = parsed.data
    const curated = serviceName !== undefined || category !== undefined || accountEmail !== undefined

    const data: Prisma.DiscoveredAccountUpdateInput = {}
    if (status !== undefined) data.status = status
    if (serviceName !== undefined) data.serviceName = serviceName
    if (category !== undefined) data.category = category
    if (accountEmail !== undefined) {
      data.accountEmail = accountEmail
      data.accountEmailHash = hashAccountEmail(accountEmail)
    }
    if (curated) data.userEdited = true

    const account = await db.discoveredAccount.update({
      where: { id },
      data,
      select: {
        id: true,
        serviceName: true,
        serviceDomain: true,
        category: true,
        accountEmail: true,
        signalTypes: true,
        confidence: true,
        extractedBy: true,
        lastSeenAt: true,
        status: true,
      },
    })
    return NextResponse.json({ account })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return apiError("ACC23", "Another account already uses that email for this service", 409)
    }
    return apiError("ACC24", "Failed to update account", 500, err)
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const user = await getCurrentUser()
  if (!user) return apiError("ACC25", "Authentication required", 401)

  const { id } = await ctx.params
  try {
    const result = await db.discoveredAccount.deleteMany({ where: { id, userId: user.id } })
    if (result.count === 0) return apiError("ACC26", "Account not found", 404)
    return NextResponse.json({ deleted: true })
  } catch (err) {
    return apiError("ACC27", "Failed to delete account", 500, err)
  }
}
