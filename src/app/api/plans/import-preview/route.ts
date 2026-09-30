import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { buildImportDraft } from "@/lib/plans/import/import-plan"

/** GET: a draft plan built from the user's linked accounts, liabilities, income and spending. */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("PLN51", "Authentication required", 401)

  try {
    return NextResponse.json(await buildImportDraft(user.id))
  } catch (err) {
    return apiError("PLN52", "Failed to read your data for the plan", 500, err)
  }
}
