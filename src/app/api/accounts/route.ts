/**
 * Account directory list API.
 *
 * GET /api/accounts — paginated, filterable list of discovered login accounts.
 * Session-guarded and userId-scoped. accountEmail is decrypted transparently on
 * read (global key). The `email` filter matches on the deterministic hash — an
 * encrypted column cannot be filtered directly, so only exact-email match works.
 */

import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { hashAccountEmail } from "@/lib/email/account-hash"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"
import type { Prisma } from "@/generated/prisma/client"

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(["active", "dismissed"]).default("active"),
  category: z.string().trim().min(1).max(24).optional(),
  service: z.string().trim().min(1).max(80).optional(),
  email: z.string().trim().email().optional(),
})

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("ACC01", "Authentication required", 401)

  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  )
  if (!parsed.success) {
    return apiError("ACC02", parsed.error.issues[0]?.message ?? "Invalid query", 400)
  }
  const { page, limit, status, category, service, email } = parsed.data

  try {
    const where: Prisma.DiscoveredAccountWhereInput = { userId: user.id, status }
    if (category) where.category = category
    if (email) where.accountEmailHash = hashAccountEmail(email)
    if (service) {
      where.OR = [
        { serviceName: { contains: service, mode: "insensitive" } },
        { serviceDomain: { contains: service, mode: "insensitive" } },
      ]
    }

    const [accounts, total] = await Promise.all([
      db.discoveredAccount.findMany({
        where,
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
        orderBy: [{ serviceName: "asc" }, { serviceDomain: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.discoveredAccount.count({ where }),
    ])

    return NextResponse.json({ accounts, total, page, limit })
  } catch (err) {
    return apiError("ACC03", "Failed to load accounts", 500, err)
  }
}
