/**
 * POST /api/accounts/senders/unsubscribe — one-click (RFC 8058) unsubscribe for
 * up to MAX_IDS senders. Each POST goes through the SSRF-guarded client; the
 * per-sender outcome is returned and persisted.
 */

import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { accountsRateLimiters, checkRateLimit, getClientId } from "@/lib/rate-limit"
import { forEachConcurrent } from "@/lib/async-pool"
import { unsubscribeOneClick, type OneClickOutcome } from "@/lib/email/sender-unsubscribe"

export const maxDuration = 120

const MAX_IDS = 50
const CONCURRENCY = 4

const bodySchema = z.object({ ids: z.array(z.string().trim().min(1).max(64)).min(1).max(MAX_IDS) })

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("ACC65", "Authentication required", 401)

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return apiError("ACC66", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  const clientId = getClientId(req)
  const results: OneClickOutcome[] = []
  try {
    await forEachConcurrent([...new Set(parsed.data.ids)], CONCURRENCY, async (id) => {
      if (!checkRateLimit(accountsRateLimiters.unsubscribe, clientId).ok) {
        results.push({ id, ok: false, error: "Rate limited — try again in a few minutes" })
        return
      }
      results.push(await unsubscribeOneClick(user.id, id))
    })
    return NextResponse.json({ results })
  } catch (err) {
    return apiError("ACC67", "Failed to unsubscribe", 500, err)
  }
}
