/**
 * Accounts Scan Worker — refreshes the login/account directory from Gmail.
 *
 * POST /api/internal/accounts-scan-worker
 *
 * For each vault owner with connected Gmail, scans for account-signal emails and
 * upserts discovered accounts. Protected by ACCOUNTS_SCAN_SECRET. Trigger via the
 * in-process scheduler (prod) or curl.
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { checkAuthFailureLimit, isAuthorizedBearer } from "@/lib/internal-auth"
import { syncAccountsFromGmail } from "@/lib/email/account-sync"

// LLM extraction over many messages is slow — give the route the full window
// the scheduler's long-timeout fetch allows.
export const maxDuration = 300
export const dynamic = "force-dynamic"

const WORKER_SECRET = process.env.ACCOUNTS_SCAN_SECRET ?? ""

export async function POST(request: NextRequest) {
  if (!isAuthorizedBearer(request, WORKER_SECRET)) {
    const rl = checkAuthFailureLimit(request)
    if (!rl.ok) return NextResponse.json(rl.response, { status: 429, headers: rl.headers })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const users = await db.user.findMany({ select: { id: true } })

    let imported = 0
    let updated = 0
    const errors: string[] = []

    for (const user of users) {
      try {
        const result = await syncAccountsFromGmail(user.id)
        imported += result.imported
        updated += result.updated
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[accounts-scan-worker] Failed for user ${user.id}:`, message)
        errors.push(user.id)
      }
    }

    console.log(`[accounts-scan-worker] imported=${imported} updated=${updated} errors=${errors.length}`)
    return NextResponse.json({ imported, updated, errors: errors.length })
  } catch (error) {
    console.error("[accounts-scan-worker] worker failed:", error)
    return NextResponse.json({ error: "Accounts scan worker failed" }, { status: 500 })
  }
}
