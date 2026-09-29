import { z } from "zod/v4"
import { DEFAULT_FIRE_INPUTS } from "./fire-constants"
import type { FireInputs } from "./fire-types"

const money = z.number().min(0).max(1e9)
const rate = z.number().min(-0.2).max(0.5)
const share = z.number().min(0).max(1)
const age = z.number().min(0).max(120)

export const fireInputsSchema = z.object({
  mode: z.enum(["basic", "advanced"]),
  currentAge: age,
  coastAge: age,
  annualSpend: money.nullable(),
  annualContribution: z.number().min(-1e8).max(1e8).nullable(),
  investableOverride: money.nullable(),
  includeCash: z.boolean(),
  includeCrypto: z.boolean(),
  swrPreset: z.enum(["4", "3.5", "3.25", "cape", "custom"]),
  customSwr: z.number().min(0.005).max(0.15),
  realReturn: rate,
  equityShare: share,
  glidepath: z.object({
    enabled: z.boolean(),
    startEquity: share,
    endEquity: share,
    years: z.number().min(1).max(40),
  }),
  horizonYears: z.number().int().min(10).max(80),
  finalValueTarget: share,
  capeA: z.number().min(0).max(0.1),
  capeB: z.number().min(0).max(5),
  partTimeIncome: money,
  flows: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        label: z.string().max(60),
        startAge: age,
        endAge: age.nullable(),
        annualAmount: z.number().min(-1e7).max(1e7),
      }),
    )
    .max(10),
  tiers: z
    .array(
      z.object({
        key: z.enum(["lean", "regular", "chubby", "fat"]),
        label: z.string().min(1).max(40),
        annualSpend: money,
      }),
    )
    .length(4),
})

/** Stored inputs merged over defaults, so newly added fields always have values. */
export function mergeFireInputs(stored: unknown): FireInputs {
  const merged = {
    ...DEFAULT_FIRE_INPUTS,
    ...(stored && typeof stored === "object" ? stored : {}),
  }
  const parsed = fireInputsSchema.safeParse(merged)
  return parsed.success ? parsed.data : DEFAULT_FIRE_INPUTS
}
