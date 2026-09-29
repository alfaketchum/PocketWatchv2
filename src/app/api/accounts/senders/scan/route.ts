/**
 * Mailing-list sender scan.
 * GET  → scan progress (polled while running).
 * POST → start a background scan of connected Gmail (202); 409 if running.
 */

import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { accountsRateLimiters, checkRateLimit, getClientId } from "@/lib/rate-limit"
import { listGmailAccounts } from "@/lib/integrations/gmail-client"
import {
  SenderScanRunningError,
  getSenderScanStatus,
  startSenderScan,
} from "@/lib/email/sender-scan"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("ACC55", "Authentication required", 401)
  return NextResponse.json({ status: getSenderScanStatus(user.id) })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return apiError("ACC56", "Authentication required", 401)

  const rl = checkRateLimit(accountsRateLimiters.senderScan, getClientId(request))
  if (!rl.ok) {
    return apiError("ACC57", "Too many scan requests — try again later", 429, undefined, rl.headers)
  }

  try {
    const accounts = await listGmailAccounts(user.id)
    if (accounts.length === 0) return apiError("ACC58", "Connect Gmail first.", 400)
    startSenderScan(user.id)
    return NextResponse.json({ status: getSenderScanStatus(user.id) }, { status: 202, headers: rl.headers })
  } catch (err) {
    if (err instanceof SenderScanRunningError) return apiError("ACC59", err.message, 409)
    return apiError("ACC60", "Failed to start sender scan", 500, err)
  }
}
