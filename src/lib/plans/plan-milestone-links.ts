import { resolveTiming, timingContext } from "./plan-timing"
import type { PlanDocument, PlanMilestone, Timing } from "./plan-types"

/** Words too common in milestone names to say two milestones are the same event. */
const STOP_WORDS = new Set(["buy", "buying", "purchase", "sell", "selling", "sale", "the", "and", "new", "first", "our", "starts", "start", "claim", "receive", "get"])
/** Different words for the same thing: "Purchase a home" and "Buy House" are one event. */
const SYNONYMS: Record<string, string> = { house: "home", condo: "home", apartment: "home", property: "home", car: "vehicle", truck: "vehicle", suv: "vehicle" }

const words = (name: string) =>
  new Set(
    name
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
      .map((w) => SYNONYMS[w] ?? w),
  )

/** What a generated milestone's date comes from: an asset's purchase or sale, or an income's start. */
type Target = { kind: "assetStart" | "assetEnd" | "incomeStart"; id: string }

function targetOf(generated: PlanMilestone): Target | null {
  const asset = /^asset-(.+)-(buy|sell)$/.exec(generated.id)
  // A replacement's purchase follows the old one's sale, so it isn't relinked.
  if (asset && generated.icon !== "autorenew") return { kind: asset[2] === "buy" ? "assetStart" : "assetEnd", id: asset[1] }
  const income = /^income-(.+)-start$/.exec(generated.id)
  return income ? { kind: "incomeStart", id: income[1] } : null
}

/**
 * One of your own milestones that looks like the same event as a generated one: the same year, and the same icon or a
 * shared word in the name ("Purchase a home" and "Buy House"). Null when there's none, or the date can't be relinked.
 */
export function duplicateMilestone(doc: PlanDocument, generated: PlanMilestone): PlanMilestone | null {
  if (!targetOf(generated)) return null
  const ctx = timingContext(doc)
  const at = resolveTiming(generated.timing, ctx)
  if (at === null) return null
  const generatedWords = words(generated.name)
  return (
    doc.milestones.find((m) => {
      if (m.kind === "retirement" || resolveTiming(m.timing, ctx) !== at) return false
      return (m.icon !== undefined && m.icon === generated.icon) || [...words(m.name)].some((w) => generatedWords.has(w))
    }) ?? null
  )
}

/** Ties the generated milestone's source date to your milestone, so there's one milestone and the two move together. */
export function linkToMilestone(doc: PlanDocument, generated: PlanMilestone, milestoneId: string): PlanDocument {
  const target = targetOf(generated)
  if (!target) return doc
  const timing: Timing = { type: "milestone", milestoneId }
  if (target.kind === "incomeStart") return { ...doc, incomes: doc.incomes.map((i) => (i.id === target.id ? { ...i, start: timing } : i)) }
  const key = target.kind === "assetStart" ? "start" : "end"
  return { ...doc, assets: doc.assets.map((a) => (a.id === target.id ? { ...a, [key]: timing } : a)) }
}
