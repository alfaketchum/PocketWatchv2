export type CompositionMode = "stable" | "asset"

/** Stacked portfolio breakdown over time */
export interface CompositionResponse {
  mode: CompositionMode
  /** Bottom → top stack order */
  layers: Array<{ key: string; label: string }>
  points: Array<{ t: number; values: Record<string, number> }>
}
