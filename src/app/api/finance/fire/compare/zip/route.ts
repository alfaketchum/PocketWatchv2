import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import zctaJson from "@/lib/fire/data/acs-zcta.json"
import type { ZipRow } from "@/lib/fire/compare-income"

type ZctaRow = [string | null, number | null, number[], number | null, number | null]
const ZCTA = zctaJson as unknown as { source: string; zips: Record<string, ZctaRow> }

/** GET ?zip=12345 — ACS household income distribution, home value and rent for one zip (server-side lookup). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("FIRE09", "Authentication required", 401)

  const zip = req.nextUrl.searchParams.get("zip") ?? ""
  if (!/^\d{5}$/.test(zip)) return apiError("FIRE10", "Enter a 5-digit US zip code", 400)

  const row = ZCTA.zips[zip]
  if (!row) return apiError("FIRE11", "No Census data for that zip code", 404)
  const [state, medianIncome, bracketCounts, medianHomeValue, medianRent] = row
  const data: ZipRow = { zip, state, medianIncome, bracketCounts, medianHomeValue, medianRent }
  return NextResponse.json({ ...data, source: ZCTA.source })
}
