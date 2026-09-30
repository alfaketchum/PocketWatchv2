import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { loadImportRealAssets, loadLinkedLoans } from "@/lib/plans/import/import-plan"

/** GET: mortgages and auto loans in the user's linked accounts (as plan debts), and homes and vehicles they entered. */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("PLN81", "Authentication required", 401)

  try {
    const [loans, known] = await Promise.all([loadLinkedLoans(user.id), loadImportRealAssets(user.id)])
    return NextResponse.json({ loans, known })
  } catch (err) {
    return apiError("PLN82", "Failed to load linked loans", 500, err)
  }
}
