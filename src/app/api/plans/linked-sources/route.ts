import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { loadLinkedSources } from "@/lib/plans/import/import-plan"

/** GET: accounts and debts in the user's linked accounts (as plan items) and when each was linked, to offer new ones to a plan. */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("PLN98", "Authentication required", 401)

  try {
    return NextResponse.json(await loadLinkedSources(user.id))
  } catch (err) {
    return apiError("PLN99", "Failed to load linked accounts", 500, err)
  }
}
