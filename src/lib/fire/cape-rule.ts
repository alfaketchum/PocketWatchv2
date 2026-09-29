import { SWR_PRESET_RATES } from "./fire-constants"
import type { FireInputs } from "./fire-types"

/** ERN's CAPE-based withdrawal rate: a + b × (1 / CAPE). */
export function capeWithdrawalRate(cape: number, a: number, b: number): number {
  if (cape <= 0) return a
  return a + b / cape
}

/** The withdrawal rate implied by the user's SWR choice. */
export function resolveSwr(inputs: FireInputs, currentCape: number | null): number {
  switch (inputs.swrPreset) {
    case "cape":
      return currentCape ? capeWithdrawalRate(currentCape, inputs.capeA, inputs.capeB) : SWR_PRESET_RATES["3.5"]
    case "custom":
      return inputs.customSwr
    default:
      return SWR_PRESET_RATES[inputs.swrPreset]
  }
}
