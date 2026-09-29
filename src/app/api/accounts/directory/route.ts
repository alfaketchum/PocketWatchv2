/**
 * GET /api/accounts/directory — the account directory grouped by service, with
 * each service joined to finance data (which card pays it, recurring charge,
 * 12-month spend). Filters: q, email (address), category, accountId (card),
 * link (all | linked | unlinked), status, sort; offset-paginated over services.
 */

import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { hashAccountEmail } from "@/lib/email/account-hash"
import { loadDirectory, queryDirectory } from "@/lib/accounts/directory-query"

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  status: z.enum(["active", "dismissed"]).default("active"),
  q: z.string().trim().min(1).max(80).optional(),
  email: z.string().trim().email().optional(),
  category: z.string().trim().min(1).max(24).optional(),
  accountId: z.string().trim().min(1).max(64).optional(),
  link: z.enum(["all", "linked", "unlinked"]).default("all"),
  sort: z.enum(["name", "spend", "recent"]).default("name"),
})

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("ACC30", "Authentication required", 401)

  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return apiError("ACC31", parsed.error.issues[0]?.message ?? "Invalid query", 400)
  }
  const { email, ...query } = parsed.data

  try {
    const { services, index } = await loadDirectory(user.id, query.status)
    return NextResponse.json(
      queryDirectory(services, index, {
        ...query,
        emailHash: email ? hashAccountEmail(email) : undefined,
      }),
    )
  } catch (err) {
    return apiError("ACC32", "Failed to load account directory", 500, err)
  }
}
