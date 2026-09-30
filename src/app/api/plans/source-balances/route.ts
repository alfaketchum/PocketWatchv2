import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { loadSourceBalances } from "@/lib/plans/import/import-plan"

/** GET: current balances of linked accounts and crypto, for refreshing a plan's starting balances. */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("PLN61", "Authentication required", 401)

  try {
    return NextResponse.json(await loadSourceBalances(user.id))
  } catch (err) {
    return apiError("PLN62", "Failed to load current balances", 500, err)
  }
}
