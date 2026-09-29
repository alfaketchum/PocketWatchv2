/**
 * GET /api/accounts/missing-email — recurring charges (subscriptions / Plaid
 * recurring streams) that match no service in the directory, i.e. "you pay for
 * this, but we don't know which email the account is on".
 */

import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { loadDirectory } from "@/lib/accounts/directory-query"
import { findMissingEmail } from "@/lib/accounts/finance-match"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("ACC35", "Authentication required", 401)

  try {
    const { services, index } = await loadDirectory(user.id, "active")
    return NextResponse.json({ services: findMissingEmail(services, index) })
  } catch (err) {
    return apiError("ACC36", "Failed to load unmatched charges", 500, err)
  }
}
