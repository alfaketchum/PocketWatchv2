/**
 * POST /api/accounts/link-finances — finance-first linking: for each recurring
 * charge / 12-month merchant with no directory entry, find which connected Gmail
 * inbox holds that account and record it. Merchants no inbox has mail from are
 * remembered for 24h, so repeat calls are cheap.
 */

import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { linkFinancesToInboxes } from "@/lib/accounts/finance-inbox-link"

export const maxDuration = 120

export async function POST() {
  const user = await getCurrentUser()
  if (!user) return apiError("ACC40", "Authentication required", 401)

  try {
    return NextResponse.json(await linkFinancesToInboxes(user.id))
  } catch (err) {
    return apiError("ACC41", "Failed to match charges to your inboxes", 500, err)
  }
}
