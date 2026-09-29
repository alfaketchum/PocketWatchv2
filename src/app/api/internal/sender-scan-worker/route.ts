/**
 * Sender Scan Worker — refreshes the unsubscribe manager's mailing-list senders
 * from Gmail (headers only; incremental after each mailbox's first scan).
 *
 * POST /api/internal/sender-scan-worker
 *
 * Protected by ACCOUNTS_SCAN_SECRET (same feature as the account scan).
 * Triggered daily by the in-process scheduler, or via curl.
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { checkAuthFailureLimit, isAuthorizedBearer } from "@/lib/internal-auth"
import { SenderScanRunningError, runSenderScan } from "@/lib/email/sender-scan"

export const maxDuration = 300
export const dynamic = "force-dynamic"

const WORKER_SECRET = process.env.ACCOUNTS_SCAN_SECRET ?? ""
// Stop starting new mailboxes after this, leaving headroom under maxDuration.
const RUN_BUDGET_MS = 240_000

export async function POST(request: NextRequest) {
  if (!isAuthorizedBearer(request, WORKER_SECRET)) {
    const rl = checkAuthFailureLimit(request)
    if (!rl.ok) return NextResponse.json(rl.response, { status: 429, headers: rl.headers })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const users = await db.user.findMany({ select: { id: true } })
    const deadline = Date.now() + RUN_BUDGET_MS
    let scanned = 0
    let newSenders = 0
    let errors = 0

    for (const user of users) {
      const timeBudgetMs = deadline - Date.now()
      if (timeBudgetMs <= 0) break
      try {
        const status = await runSenderScan(user.id, { timeBudgetMs })
        scanned += status.scanned
        newSenders += status.imported
      } catch (error) {
        if (error instanceof SenderScanRunningError) continue
        console.error(`[sender-scan-worker] Failed for user ${user.id}:`, (error as Error).message)
        errors++
      }
    }

    console.log(`[sender-scan-worker] scanned=${scanned} newSenders=${newSenders} errors=${errors}`)
    return NextResponse.json({ scanned, newSenders, errors })
  } catch (error) {
    console.error("[sender-scan-worker] worker failed:", error)
    return NextResponse.json({ error: "Sender scan worker failed" }, { status: 500 })
  }
}
