import test from "node:test"
import assert from "node:assert/strict"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { diffPlanInputs, matchItems } from "@/lib/plans/plan-diff"
import { alignYears, diffRows, tone, unionSeries } from "@/components/plans/compare/compare-helpers"
import type { ChartRow } from "@/components/plans/results/use-chart-series"
import type { PlanDocument, PlanIncome } from "@/lib/plans/plan-types"

const base = blankPlanDocument(new Date(2026, 0, 1), 40)
const salary: PlanIncome = {
  id: "inc-1",
  name: "Salary",
  kind: "salary",
  amount: 100_000,
  growth: null,
  start: { type: "planStart" },
  end: { type: "planEnd" },
  taxable: true,
  oneTime: false,
  contributions: [],
}
const doc: PlanDocument = { ...base, incomes: [salary] }

const changesOf = (a: PlanDocument, b: PlanDocument, group: string) => diffPlanInputs(a, b).find((g) => g.key === group)?.changes ?? []

test("identical plans have no differences", () => {
  assert.deepEqual(diffPlanInputs(doc, structuredClone(doc)), [])
})

test("a changed setting is listed with both values", () => {
  const b = { ...doc, settings: { ...doc.settings, inflation: 0.035 } }
  const changes = changesOf(doc, b, "settings")
  assert.equal(changes.length, 1)
  assert.equal(changes[0].label, "Inflation")
  assert.notEqual(changes[0].a, changes[0].b)
})

test("items match by id: a changed amount shows as a change, not a remove and add", () => {
  const b = { ...doc, incomes: [{ ...salary, name: "Salary (raise)", amount: 120_000 }] }
  const changes = changesOf(doc, b, "incomes")
  assert.equal(changes.length, 1)
  assert.equal(changes[0].label, "Salary (raise) · Amount")
})

test("items with new ids match by name; unmatched ones are only in one plan", () => {
  const b = { ...doc, incomes: [{ ...salary, id: "other" }, { ...salary, id: "x", name: "Side gig", amount: 5_000 }] }
  const changes = changesOf(doc, b, "incomes")
  assert.deepEqual(
    changes.map((c) => [c.label, c.a === null, c.b === null]),
    [["Side gig", true, false]],
  )
})

test("a change outside the listed fields is still reported", () => {
  const b = { ...doc, incomes: [{ ...salary, endBefore: { type: "planEnd" as const } }] }
  assert.equal(changesOf(doc, b, "incomes")[0]?.label, "Salary · Other details")
})

test("matchItems pairs by id first, then by name", () => {
  const { pairs, onlyA, onlyB } = matchItems([{ id: "1", n: "x" }, { id: "2", n: "y" }], [{ id: "9", n: "y" }, { id: "1", n: "z" }], (i) => i.n)
  assert.deepEqual(pairs.map(([a, b]) => [a.id, b.id]), [["1", "1"], ["2", "9"]])
  assert.equal(onlyA.length + onlyB.length, 0)
})

const row = (year: number, age: number, v: Record<string, number>): ChartRow => ({ year, age, ...v })

test("alignYears puts both plans on the same years, padding the shorter one", () => {
  const a = [row(2026, 40, { x: 1 }), row(2027, 41, { x: 2 })]
  const b = [row(2027, 41, { x: 5, y: 1 }), row(2028, 42, { x: 6 })]
  const out = alignYears(a, b, ["x", "y"])
  assert.deepEqual(out.years, [2026, 2027, 2028])
  assert.deepEqual(out.a.map((r) => [r.year, r.age, r.x, r.y]), [[2026, 40, 1, 0], [2027, 41, 2, 0], [2028, 42, 0, 0]])
  assert.deepEqual(out.b.map((r) => [r.year, r.age, r.x]), [[2026, 40, 0], [2027, 41, 5], [2028, 42, 6]])
})

test("diffRows is B − A for years both plans run, empty otherwise", () => {
  const a = [row(2026, 40, { x: 1 }), row(2027, 41, { x: 2 })]
  const b = [row(2027, 41, { x: 5 }), row(2028, 42, { x: 6 })]
  const { a: ra, b: rb } = alignYears(a, b, ["x"])
  const diff = diffRows(ra, rb, ["x"], new Set([2026, 2027]), new Set([2027, 2028]))
  assert.deepEqual(diff.map((r) => [r.inBoth, r.total]), [[0, undefined], [1, 3], [0, undefined]])
})

test("unionSeries keeps A's order and adds B's extra bands", () => {
  const s = (key: string) => ({ key, label: key, color: "#000" })
  assert.deepEqual(unionSeries([s("a"), s("b")], [s("c"), s("a")]).map((x) => x.key), ["a", "b", "c"])
})

test("tone: more net worth is good, more taxes are bad, cash flow is neutral", () => {
  assert.equal(tone("networth", 100), 1)
  assert.equal(tone("taxes", 100), -1)
  assert.equal(tone("expenses", -100), 1)
  assert.equal(tone("cashflow", 100), 0)
})

const line = (id: string, name: string, category: string | null, amount: number, oneTime = false) => ({
  id,
  name,
  category,
  amount,
  growth: null,
  start: { type: "planStart" as const },
  end: { type: "planEnd" as const },
  oneTime,
})

test("expenses compare by category totals, not line names", () => {
  const a = { ...doc, expenses: [line("1", "Groceries", "Food", 6_000), line("2", "Eating out", "Food", 3_600)] }
  // Same category, lines named and split differently, a higher total: one change for Food.
  const b = { ...doc, expenses: [line("x", "Food & dining", "Food", 12_000)] }
  const changes = changesOf(a, b, "expenses")
  assert.equal(changes.length, 1)
  assert.equal(changes[0].label, "Food")
  assert.notEqual(changes[0].a, changes[0].b)
})

test("a category only one plan has, and uncategorized lines, are listed by category", () => {
  const a = { ...doc, expenses: [line("1", "Gym", null, 600), line("2", "Wedding", "Events", 30_000, true)] }
  const b = { ...doc, expenses: [line("1", "Gym", null, 600)] }
  assert.deepEqual(
    changesOf(a, b, "expenses").map((c) => [c.label, c.a !== null, c.b !== null]),
    [["Events", true, false]],
  )
  const c = { ...doc, expenses: [line("1", "Gym", null, 1_200)] }
  assert.equal(changesOf(b, c, "expenses")[0]?.label, "Uncategorized")
})

test("a category with the same totals but different lines says so", () => {
  const a = { ...doc, expenses: [line("1", "Travel", "Travel", 6_000)] }
  const b = { ...doc, expenses: [{ ...line("1", "Travel", "Travel", 6_000), growth: 0.05 }] }
  assert.equal(changesOf(a, b, "expenses")[0]?.label, "Travel · Timing, growth or lines")
  // Same total, a renamed line: the totals match, so it's flagged as a line difference.
  const renamed = { ...doc, expenses: [line("9", "Trips", "Travel", 6_000)] }
  assert.equal(changesOf(a, renamed, "expenses")[0]?.label, "Travel · Timing, growth or lines")
})
