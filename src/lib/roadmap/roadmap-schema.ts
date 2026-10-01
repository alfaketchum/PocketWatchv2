import { z } from "zod/v4"
import { ROADMAP_STATUSES, ROADMAP_TIERS } from "./roadmap-seed"

const text = (max: number) => z.string().trim().max(max)

/** Fields a user can set on a roadmap item. */
export const roadmapFields = {
  tier: z.enum(ROADMAP_TIERS),
  rank: z.number().int().min(0).max(999),
  title: text(120).min(1),
  summary: text(1000),
  demand: text(300),
  plStatus: text(200),
  ourStatus: text(300),
  effort: text(10),
  status: z.enum(ROADMAP_STATUSES),
  notes: text(5000),
}

export const createRoadmapSchema = z.object({
  title: roadmapFields.title,
  tier: roadmapFields.tier.default("B"),
  summary: roadmapFields.summary.default(""),
  effort: roadmapFields.effort.default("M"),
})

export const patchRoadmapSchema = z
  .object(roadmapFields)
  .partial()
  .refine((b) => Object.keys(b).length > 0, "Nothing to update")

export const ROADMAP_SELECT = {
  id: true,
  key: true,
  tier: true,
  rank: true,
  title: true,
  summary: true,
  demand: true,
  plStatus: true,
  ourStatus: true,
  effort: true,
  status: true,
  notes: true,
  updatedAt: true,
} as const

/** Most items a user can have on the roadmap. */
export const MAX_ROADMAP_ITEMS = 200
