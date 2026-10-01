import { z } from "zod"

/** Scoring models people commonly see; the number differs between them for the same report. */
export const SCORE_MODELS = [
  { value: "fico8", label: "FICO 8" },
  { value: "fico-mortgage", label: "FICO (mortgage)" },
  { value: "fico-auto", label: "FICO Auto" },
  { value: "vantage3", label: "VantageScore 3.0" },
  { value: "vantage4", label: "VantageScore 4.0" },
  { value: "other", label: "Other" },
] as const
export type ScoreModel = (typeof SCORE_MODELS)[number]["value"]

export const BUREAUS = [
  { value: "experian", label: "Experian" },
  { value: "equifax", label: "Equifax" },
  { value: "transunion", label: "TransUnion" },
] as const
export type Bureau = (typeof BUREAUS)[number]["value"]

export const MIN_SCORE = 300
export const MAX_SCORE = 850
/** Most entries one user keeps. */
export const MAX_CREDIT_SCORES = 500

const MODEL_VALUES = SCORE_MODELS.map((m) => m.value) as [ScoreModel, ...ScoreModel[]]
const BUREAU_VALUES = BUREAUS.map((b) => b.value) as [Bureau, ...Bureau[]]

const notInFuture = z.coerce.date().refine((d) => d.getTime() <= Date.now() + 24 * 60 * 60 * 1000, "Date can't be in the future")

export const creditScoreCreateSchema = z.object({
  score: z.number().int().min(MIN_SCORE).max(MAX_SCORE),
  model: z.enum(MODEL_VALUES),
  bureau: z.enum(BUREAU_VALUES).nullable().optional(),
  date: notInFuture,
  note: z.string().trim().max(200).nullable().optional(),
})
export const creditScoreUpdateSchema = creditScoreCreateSchema.partial()
export type CreditScoreInput = z.infer<typeof creditScoreCreateSchema>

export interface ScoreTier {
  key: "poor" | "fair" | "good" | "very-good" | "exceptional"
  label: string
  min: number
  max: number
}

/** FICO's own ranges (myFICO). */
export const SCORE_TIERS: ScoreTier[] = [
  { key: "poor", label: "Poor", min: MIN_SCORE, max: 579 },
  { key: "fair", label: "Fair", min: 580, max: 669 },
  { key: "good", label: "Good", min: 670, max: 739 },
  { key: "very-good", label: "Very good", min: 740, max: 799 },
  { key: "exceptional", label: "Exceptional", min: 800, max: MAX_SCORE },
]

export function scoreTier(score: number): ScoreTier {
  return SCORE_TIERS.find((t) => score <= t.max) ?? SCORE_TIERS[SCORE_TIERS.length - 1]
}

export function modelLabel(model: string): string {
  return SCORE_MODELS.find((m) => m.value === model)?.label ?? model
}

export interface CardUtilization {
  name: string
  balance: number
  limit: number
  share: number
}

/** Card balances against their limits: overall (all balances over all limits) and per card. Cards without a limit are left out. */
export function cardUtilization(accounts: { name: string; currentBalance: number | null; creditLimit: number | null }[]): {
  overall: number | null
  cards: CardUtilization[]
} {
  const cards = accounts
    .filter((a) => (a.creditLimit ?? 0) > 0)
    .map((a) => {
      const balance = Math.abs(a.currentBalance ?? 0)
      const limit = a.creditLimit!
      return { name: a.name, balance, limit, share: balance / limit }
    })
  const limit = cards.reduce((s, c) => s + c.limit, 0)
  return { overall: limit > 0 ? cards.reduce((s, c) => s + c.balance, 0) / limit : null, cards }
}

/** FICO's published guidance: under 30% helps, under 10% is where top scores sit. */
/** Finance account types that are credit cards. */
export const CARD_ACCOUNT_TYPES = ["credit", "business_credit"]

export const UTILIZATION_OK = 0.3
export const UTILIZATION_BEST = 0.1
