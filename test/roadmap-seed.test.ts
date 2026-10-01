import test from "node:test"
import assert from "node:assert/strict"
import { ROADMAP_SEED } from "@/lib/roadmap/roadmap-seed"
import { patchRoadmapSchema, createRoadmapSchema } from "@/lib/roadmap/roadmap-schema"

test("roadmap seed: unique keys and ranks, every item fills its fields", () => {
  assert.equal(new Set(ROADMAP_SEED.map((i) => i.key)).size, ROADMAP_SEED.length)
  assert.equal(new Set(ROADMAP_SEED.map((i) => i.rank)).size, ROADMAP_SEED.length)
  for (const i of ROADMAP_SEED) assert.ok(i.title && i.summary && i.demand && i.effort, i.key)
})

test("roadmap schemas: patches need a field and a known status; new items default to tier B", () => {
  assert.equal(patchRoadmapSchema.safeParse({}).success, false)
  assert.equal(patchRoadmapSchema.safeParse({ status: "shipped" }).success, false)
  assert.equal(patchRoadmapSchema.safeParse({ status: "building", notes: "started" }).success, true)
  assert.equal(createRoadmapSchema.parse({ title: "Dark mode" }).tier, "B")
})
