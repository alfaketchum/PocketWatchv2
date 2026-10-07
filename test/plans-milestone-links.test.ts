import test from "node:test"
import assert from "node:assert/strict"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { applyHome } from "@/lib/plans/milestone-templates"
import { duplicateMilestone, linkToMilestone } from "@/lib/plans/plan-milestone-links"
import { generatedMilestones } from "@/lib/plans/plan-milestones"
import { milestoneUses } from "@/lib/plans/plan-milestone-uses"
import type { PlanDocument, PlanMilestone } from "@/lib/plans/plan-types"

let n = 0
const newId = (p: string) => `${p}-${++n}`
const HOME = { name: "House", when: { type: "year" as const, year: 2030 }, price: 500_000, payWith: "loan" as const, downPayment: 100_000, rate: 0.06, termYears: 30, appreciation: 0.03 }

/** A house bought in 2030 from the Assets tab, plus one milestone of your own. */
function plan(mine: Omit<PlanMilestone, "id">): PlanDocument {
  const base = applyHome(blankPlanDocument(new Date(2026, 0, 15), 35), HOME, newId)
  return { ...base, milestones: [...base.milestones, { id: "mine", ...mine }] }
}
const buyMark = (d: PlanDocument) => generatedMilestones(d).find((m) => m.id.endsWith("-buy"))!

test("a milestone of yours in the same year with a matching name is the house purchase's twin", () => {
  const d = plan({ name: "Purchase a home", kind: "custom", timing: { type: "year", year: 2030 } })
  assert.equal(duplicateMilestone(d, buyMark(d))?.id, "mine")
})

test("same year but a different event isn't a twin", () => {
  const d = plan({ name: "Start a business", kind: "custom", timing: { type: "year", year: 2030 } })
  assert.equal(duplicateMilestone(d, buyMark(d)), null)
})

test("a matching name in another year isn't a twin", () => {
  const d = plan({ name: "Purchase a home", kind: "custom", timing: { type: "year", year: 2031 } })
  assert.equal(duplicateMilestone(d, buyMark(d)), null)
})

test("linking ties the purchase to your milestone: the generated marker goes, and they move together", () => {
  const d = plan({ name: "Purchase a home", kind: "custom", timing: { type: "year", year: 2030 } })
  const linked = linkToMilestone(d, buyMark(d), "mine")
  assert.equal(generatedMilestones(linked).some((m) => m.id.endsWith("-buy")), false)
  assert.ok(milestoneUses(linked, "mine").includes("House bought"))
  const house = linked.assets.find((a) => a.name === "House")!
  assert.deepEqual(house.start, { type: "milestone", milestoneId: "mine" })
})
