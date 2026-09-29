export type BuilderMethod = "ai" | "simple" | "manual"

export type BuilderStep = "choose" | "ai-loading" | "ai-proposal" | "edit" | "review"

/** One category in the budget being built. `amount` is unrounded while editing. */
export interface DraftLine {
  category: string
  amount: number
  /** Average over the last complete months (0 when no history). */
  avgMonthly: number
  /** Last complete month's spend. */
  lastMonth: number
  /** Short AI rationale, when the line came from an AI proposal. */
  reason?: string
  locked: boolean
}

/** An active budget as stored (unscaled monthly limit). */
export interface ExistingBudget {
  category: string
  monthlyLimit: number
}

export interface CategoryStats {
  avgMonthly: number
  lastMonth: number
  /** Oldest → newest, complete months. */
  history: number[]
}

export interface DraftDiff {
  added: Array<{ category: string; amount: number }>
  changed: Array<{ category: string; from: number; to: number }>
  removed: Array<{ category: string; amount: number }>
}
