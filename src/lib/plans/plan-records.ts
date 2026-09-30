import { db } from "@/lib/db"
import { mergeFireInputs } from "@/lib/fire/fire-schema"
import { blankPlanDocument } from "./plan-constants"
import { simulatePlan } from "./engine/simulate"
import { parsePlanDocument } from "./plan-schema"
import { summarizePlan } from "./plan-summary"
import type { PlanDocument, PlanSummary } from "./plan-types"

export const PLAN_META_SELECT = {
  id: true,
  name: true,
  isPrimary: true,
  createdAt: true,
  updatedAt: true,
} as const

export interface PlanListItem {
  id: string
  name: string
  isPrimary: boolean
  createdAt: Date
  updatedAt: Date
  /** Null when the stored document no longer validates. */
  summary: PlanSummary | null
}

/** Stored document, or null (logged) when it no longer validates. */
export function readPlanDocument(planId: string, stored: unknown): PlanDocument | null {
  const doc = parsePlanDocument(stored, blankPlanDocument(new Date()))
  if (!doc) console.error(`[plans] plan ${planId} has an invalid document`)
  return doc
}

export function summaryFor(planId: string, stored: unknown): PlanSummary | null {
  const doc = readPlanDocument(planId, stored)
  return doc ? summarizePlan(doc, simulatePlan(doc)) : null
}

/** A blank plan for the user, aged from their FIRE profile when they have one. */
export async function blankPlanForUser(userId: string): Promise<PlanDocument> {
  const profile = await db.fireProfile.findUnique({ where: { userId }, select: { inputs: true } })
  const age = profile ? mergeFireInputs(profile.inputs).currentAge : undefined
  return blankPlanDocument(new Date(), age)
}
