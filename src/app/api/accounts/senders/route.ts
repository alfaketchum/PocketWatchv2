/**
 * GET /api/accounts/senders — mailing-list senders for the unsubscribe manager,
 * most prolific first. Filters: status, mailbox, q (name / address); sort:
 * count | recent. Offset-paginated.
 */

import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"
import type { Prisma } from "@/generated/prisma/client"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { emailFromService, gmailServiceForEmail } from "@/lib/integrations/gmail-client"
import type { MailSenderRow, UnsubscribeMethod } from "@/types/mail-senders"

// Mail that arrives this long after unsubscribing counts as "still sending"
// (senders are allowed a couple of days to process the request).
const GRACE_MS = 3 * 24 * 60 * 60 * 1000

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  status: z.enum(["active", "unsubscribed", "kept", "all"]).default("active"),
  mailbox: z.string().trim().email().optional(),
  q: z.string().trim().min(1).max(80).optional(),
  sort: z.enum(["count", "recent"]).default("count"),
})

const ROW_SELECT = {
  id: true, service: true, senderEmail: true, senderDomain: true, displayName: true,
  messageCount: true, firstSeenAt: true, lastSeenAt: true, unsubscribeUrl: true,
  unsubscribeMailto: true, oneClick: true, status: true, unsubscribedAt: true, lastError: true,
} satisfies Prisma.MailSenderSelect

type Row = Prisma.MailSenderGetPayload<{ select: typeof ROW_SELECT }>

function methodFor(row: Row): UnsubscribeMethod | null {
  if (row.oneClick && row.unsubscribeUrl) return "one_click"
  if (row.unsubscribeUrl) return "link"
  return row.unsubscribeMailto ? "mailto" : null
}

function toRow(row: Row, accountDomains: Set<string>): MailSenderRow {
  const stillSending =
    row.status === "unsubscribed" && !!row.unsubscribedAt && !!row.lastSeenAt &&
    row.lastSeenAt.getTime() > row.unsubscribedAt.getTime() + GRACE_MS
  return {
    id: row.id,
    mailbox: emailFromService(row.service),
    senderEmail: row.senderEmail,
    senderDomain: row.senderDomain,
    displayName: row.displayName,
    messageCount: row.messageCount,
    firstSeenAt: row.firstSeenAt?.toISOString() ?? null,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    method: methodFor(row),
    unsubscribeUrl: row.unsubscribeUrl,
    unsubscribeMailto: row.unsubscribeMailto,
    status: row.status as MailSenderRow["status"],
    unsubscribedAt: row.unsubscribedAt?.toISOString() ?? null,
    stillSending,
    isAccount: accountDomains.has(row.senderDomain),
    lastError: row.lastError,
  }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("ACC50", "Authentication required", 401)

  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return apiError("ACC51", parsed.error.issues[0]?.message ?? "Invalid query", 400)
  }
  const { page, limit, status, mailbox, q, sort } = parsed.data

  try {
    const where: Prisma.MailSenderWhereInput = { userId: user.id }
    if (status !== "all") where.status = status
    if (mailbox) where.service = gmailServiceForEmail(mailbox)
    if (q) {
      where.OR = [
        { displayName: { contains: q, mode: "insensitive" } },
        { senderEmail: { contains: q, mode: "insensitive" } },
      ]
    }

    const [rows, total, mailboxGroups, accountRows] = await Promise.all([
      db.mailSender.findMany({
        where,
        select: ROW_SELECT,
        orderBy: sort === "count" ? [{ messageCount: "desc" }, { lastSeenAt: "desc" }] : [{ lastSeenAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.mailSender.count({ where }),
      db.mailSender.groupBy({ by: ["service"], where: { userId: user.id }, _count: { _all: true } }),
      db.discoveredAccount.findMany({
        where: { userId: user.id, status: "active" },
        select: { serviceDomain: true },
        distinct: ["serviceDomain"],
        take: 5_000,
      }),
    ])

    const accountDomains = new Set(accountRows.map((r) => r.serviceDomain))
    return NextResponse.json({
      senders: rows.map((r) => toRow(r, accountDomains)),
      total,
      page,
      limit,
      mailboxes: mailboxGroups
        .map((g) => ({ email: emailFromService(g.service) ?? g.service, count: g._count._all }))
        .sort((a, b) => b.count - a.count),
    })
  } catch (err) {
    return apiError("ACC52", "Failed to load mail senders", 500, err)
  }
}
