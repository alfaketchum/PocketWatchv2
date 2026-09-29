import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { fireInputsSchema, mergeFireInputs } from "@/lib/fire/fire-schema"
import { NextRequest, NextResponse } from "next/server"

/** GET: the user's saved FIRE inputs merged over defaults. */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("FIRE01", "Authentication required", 401)

  try {
    const profile = await db.fireProfile.findUnique({
      where: { userId: user.id },
      select: { inputs: true, updatedAt: true },
    })
    return NextResponse.json({
      inputs: mergeFireInputs(profile?.inputs),
      saved: profile !== null,
      updatedAt: profile?.updatedAt ?? null,
    })
  } catch (err) {
    return apiError("FIRE02", "Failed to load FIRE profile", 500, err)
  }
}

/** PUT: replace the user's FIRE inputs. Body: FireInputs */
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("FIRE03", "Authentication required", 401)

  const body = await req.json().catch(() => null)
  const parsed = fireInputsSchema.safeParse(body)
  if (!parsed.success) return apiError("FIRE04", "Invalid FIRE inputs", 400)

  try {
    const profile = await db.fireProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, inputs: parsed.data },
      update: { inputs: parsed.data },
      select: { inputs: true, updatedAt: true },
    })
    return NextResponse.json({ inputs: mergeFireInputs(profile.inputs), saved: true, updatedAt: profile.updatedAt })
  } catch (err) {
    return apiError("FIRE05", "Failed to save FIRE profile", 500, err)
  }
}
