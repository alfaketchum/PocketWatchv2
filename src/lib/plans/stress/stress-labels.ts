import type { CohortResult } from "./stress-test"

/** A stable id per result: the trial number for simulated trials, the start year in the historical replay. */
export const trialId = (c: CohortResult): number => c.trial ?? c.year

/** "Trial 12" for a simulated trial, "Starting 1966" for a historical one. */
export const trialName = (c: CohortResult): string => (c.trial !== undefined ? `Trial ${c.trial + 1}` : `Starting ${c.year}`)

const short = (from: number, to: number) => (from === to ? `${from}` : `${from}–${String(to).slice(Math.floor(from / 100) === Math.floor(to / 100) ? 2 : 0)}`)

/**
 * The years a trial lived through, as runs of consecutive years: "1966–75 · 1931–40 · 2001–08". Years before the
 * record (assumed returns) read "assumed".
 */
export function sequenceLabel(sequence: (number | null)[], maxRuns = Infinity): string {
  const runs: string[] = []
  let i = 0
  while (i < sequence.length) {
    const from = sequence[i]
    let j = i
    if (from === null) {
      while (j + 1 < sequence.length && sequence[j + 1] === null) j++
      runs.push("assumed")
    } else {
      while (j + 1 < sequence.length && sequence[j + 1] === (sequence[j] as number) + 1) j++
      runs.push(short(from, sequence[j] as number))
    }
    i = j + 1
  }
  const shown = runs.slice(0, maxRuns)
  return shown.join(" · ") + (runs.length > shown.length ? ` · +${runs.length - shown.length} more` : "")
}

/** One trial's ending in words: assets exhausted is the failure (bad); accounts depleted with property left is
 *  a warning (warn); otherwise it was fully funded (ok). */
export function trialStatus(c: Pick<CohortResult, "depletedAge" | "brokeAge">): { text: string; tone: "ok" | "warn" | "bad" } {
  if (c.brokeAge !== undefined) return { text: `Assets exhausted at ${c.brokeAge}`, tone: "bad" }
  if (c.depletedAge !== null) return { text: `Accounts depleted at ${c.depletedAge}`, tone: "warn" }
  return { text: "Fully funded", tone: "ok" }
}

export const TRIAL_TONE_CLASS = { ok: "text-success", warn: "text-warning", bad: "text-error" } as const
