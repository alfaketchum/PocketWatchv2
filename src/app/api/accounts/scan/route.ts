/**
 * Account directory ← Gmail scan API.
 *
 * GET  → Gmail connection + the current scan's progress (polled while scanning).
 * POST → start a background scan of connected Gmail (202); 409 if one is running.
 *
 * Session-guarded and userId-scoped. POST is rate-limited (provider-bound) and
 * requires at least one connected Gmail account.
 */

import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { accountsRateLimiters, checkRateLimit, getClientId } from "@/lib/rate-limit"
import { listGmailAccounts } from "@/lib/integrations/gmail-client"
import { ScanAlreadyRunningError, startBackgroundScan } from "@/lib/email/account-sync"
import { getScanStatus } from "@/lib/email/account-scan-status"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("ACC10", "Authentication required", 401)

  try {
    const accounts = await listGmailAccounts(user.id)
    return NextResponse.json({
      connected: accounts.length > 0,
      accounts,
      status: getScanStatus(user.id),
    })
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

    startBackgroundScan(user.id)
    return NextResponse.json({ status: getScanStatus(user.id) }, { status: 202, headers: rl.headers })
  } catch (err) {
    if (err instanceof ScanAlreadyRunningError) {
      return apiError("ACC16", err.message, 409)
    }
    return apiError("ACC15", "Failed to scan Gmail for accounts", 500, err)
  }
}
