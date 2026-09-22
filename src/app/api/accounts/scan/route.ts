/**
 * Account directory ← Gmail scan API.
 *
 * GET  → report whether Gmail is connected (drives the connect/scan button).
 * POST → scan connected Gmail for account signals and upsert discovered accounts.
 *
 * Session-guarded and userId-scoped. POST is rate-limited (provider-bound) and
 * requires at least one connected Gmail account.
 */

import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { accountsRateLimiters, checkRateLimit, getClientId } from "@/lib/rate-limit"
import { listGmailAccounts } from "@/lib/integrations/gmail-client"
import { syncAccountsFromGmail } from "@/lib/email/account-sync"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("ACC10", "Authentication required", 401)

  try {
    const accounts = await listGmailAccounts(user.id)
    return NextResponse.json({ connected: accounts.length > 0, accounts })
  } catch (err) {
    return apiError("ACC11", "Failed to check Gmail connection", 500, err)
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return apiError("ACC12", "Authentication required", 401)

  const rl = checkRateLimit(accountsRateLimiters.scan, getClientId(request))
  if (!rl.ok) {
    return apiError("ACC13", "Too many scan requests — try again later", 429, undefined, rl.headers)
  }

  try {
    const accounts = await listGmailAccounts(user.id)
    if (accounts.length === 0) {
      return apiError(
        "ACC14",
        "Connect Gmail first to discover your logins from your email.",
        400,
      )
    }

    const result = await syncAccountsFromGmail(user.id)
    return NextResponse.json(result, { headers: rl.headers })
  } catch (err) {
    return apiError("ACC15", "Failed to scan Gmail for accounts", 500, err)
  }
}
