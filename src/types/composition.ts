export type CompositionMode = "stable" | "asset"

/** Finance dashboard chart: by account group (Cash / Savings / Investments) or per account */
export type FinanceCompositionMode = "category" | "account"

/** Stacked portfolio breakdown over time */
export interface CompositionResponse<M extends string = CompositionMode> {
  mode: M
  /** Bottom → top stack order */
  layers: Array<{ key: string; label: string }>
  points: Array<{
    t: number
    values: Record<string, number>
    /** Per layer key: its biggest contents that day, e.g. what's inside Misc */
    details?: Record<string, Array<{ label: string; value: number }>>
    /** Extra tooltip rows below the layers, e.g. debt and net worth */
    footer?: Array<{ label: string; value: number }>
  }>
}
