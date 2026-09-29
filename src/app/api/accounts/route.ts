/**
 * Account directory list API.
 *
 * GET  /api/accounts — paginated, filterable list of discovered login accounts.
 * POST /api/accounts — add a service/email pair by hand (e.g. from "no email found").
 * Session-guarded and userId-scoped. accountEmail is decrypted transparently on
 * read (global key). The `email` filter matches on the deterministic hash — an
 * encrypted column cannot be filtered directly, so only exact-email match works.
 */

import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { domainFromHost, hashAccountEmail } from "@/lib/email/account-hash"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"
import { Prisma } from "@/generated/prisma/client"

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

const createSchema = z.object({
  serviceName: z.string().trim().min(1).max(60),
  serviceDomain: z.string().trim().min(3).max(120),
  accountEmail: z.string().trim().email().max(200),
  category: z.string().trim().min(1).max(24).nullable().optional(),
  paymentAccountId: z.string().trim().min(1).max(64).nullable().optional(),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("ACC04", "Authentication required", 401)

  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return apiError("ACC05", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }
  const { serviceName, accountEmail, category, paymentAccountId } = parsed.data
  const serviceDomain = domainFromHost(parsed.data.serviceDomain)
  if (!serviceDomain) return apiError("ACC06", "Enter a valid domain, e.g. netflix.com", 400)

  try {
    if (paymentAccountId) {
      const owned = await db.financeAccount.findFirst({
        where: { id: paymentAccountId, userId: user.id },
        select: { id: true },
      })
      if (!owned) return apiError("ACC07", "Payment account not found", 404)
    }

    const account = await db.discoveredAccount.create({
      data: {
        userId: user.id,
        serviceName,
        serviceDomain,
        category: category ?? null,
        accountEmail: accountEmail.toLowerCase(),
        accountEmailHash: hashAccountEmail(accountEmail),
        sourceService: "manual",
        confidence: 1,
        extractedBy: "manual",
        userEdited: true,
        paymentAccountId: paymentAccountId ?? null,
      },
      select: { id: true, serviceName: true, serviceDomain: true },
    })
    return NextResponse.json({ account }, { status: 201 })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return apiError("ACC08", "That email is already listed for this service", 409)
    }
    return apiError("ACC09", "Failed to add account", 500, err)
  }
}
