import test from "node:test"
import assert from "node:assert/strict"
import { mix } from "@/components/plans/results/use-plan-colors"

test("mix blends 3-digit, 6-digit and rgb() colors", () => {
  assert.equal(mix("#1a1a27", "#fff", 0.75), "#c6c6c9")
  assert.equal(mix("#5b5bd6", "#ffffff", 0.5), "#adadeb")
  assert.equal(mix("rgb(91, 91, 214)", "#fff", 0.5), "#adadeb")
  assert.equal(mix("var(--x)", "#fff", 0.5), "var(--x)")
})
