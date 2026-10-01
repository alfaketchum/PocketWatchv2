import { NextResponse, type NextRequest } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { homeDataProvider } from "@/lib/finance/home-data"
import { homeLookupSchema } from "@/lib/finance/real-assets-input"

/** POST: look a home up by address: value and rent estimates, its property tax bill and facts. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("RA21", "Authentication required", 401)
  const parsed = homeLookupSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError("RA22", "Enter a street address with city and state", 400)
  try {
    const provider = await homeDataProvider(user.id)
    const home = await provider.lookup(parsed.data.address)
    if (!home) return apiError("RA23", "No data found for that address", 404)
    return NextResponse.json({ home })
  } catch (err) {
    return apiError("RA24", "Home lookup failed", 502, err)
  }
}
