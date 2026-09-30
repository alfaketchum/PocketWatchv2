import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { loadImportAccounts } from "@/lib/plans/import/import-plan"
import { loadTradingActivity } from "@/lib/plans/import/trading-activity"

/** GET: trading activity of the user's linked brokerage accounts, keyed by finance account id. */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("PLN71", "Authentication required", 401)

  try {
    const rows = await loadImportAccounts(user.id)
    return NextResponse.json({ activity: await loadTradingActivity(user.id, rows) })
  } catch (err) {
    return apiError("PLN72", "Failed to load trading activity", 500, err)
  }
}
