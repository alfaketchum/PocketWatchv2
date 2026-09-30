import test from "node:test"
import assert from "node:assert/strict"
import { blankPlanDocument, PRIMARY_PERSON_ID } from "@/lib/plans/plan-constants"
import { removeAccount, removePerson, timingLabel } from "@/components/plans/plans-helpers"
import type { PlanDocument } from "@/lib/plans/plan-types"

const base = blankPlanDocument(new Date(2026, 0, 1), 40)

test("removePerson re-points their ages at the first person", () => {
  const doc: PlanDocument = {
    ...base,
    people: [...base.people, { id: "p2", name: "Sam", birthYear: 1990, birthMonth: 5 }],
    milestones: [{ id: "m", name: "Sam retires", kind: "custom", timing: { type: "age", personId: "p2", age: 60 } }],
  }
  const out = removePerson(doc, "p2")
  assert.equal(out.people.length, 1)
  assert.deepEqual(out.milestones[0].timing, { type: "age", personId: PRIMARY_PERSON_ID, age: 60 })
})

test("removeAccount drops it from cash-flow orders and payroll contributions", () => {
  const doc: PlanDocument = {
    ...base,
    cashFlow: { surplusOrder: [{ accountId: "acct-brokerage", annualCap: null }], withdrawalOrder: ["acct-brokerage", "acct-cash"] },
    incomes: [
      {
        id: "i", name: "Pay", kind: "salary", amount: 1, growth: null, start: { type: "planStart" }, end: { type: "planEnd" },
        taxable: true, oneTime: false,
        contributions: [{ id: "c", accountId: "acct-brokerage", percent: 0.1, employerMatchPercent: 0, preTax: false }],
      },
    ],
  }
  const out = removeAccount(doc, "acct-brokerage")
  assert.equal(out.accounts.length, 1)
  assert.deepEqual(out.cashFlow.surplusOrder, [])
  assert.deepEqual(out.cashFlow.withdrawalOrder, ["acct-cash"])
  assert.deepEqual(out.incomes[0].contributions, [])
})

test("timingLabel names milestones and ages", () => {
  assert.equal(timingLabel({ type: "milestone", milestoneId: base.milestones[0].id }, base), "Retirement")
  assert.equal(timingLabel({ type: "age", personId: PRIMARY_PERSON_ID, age: 50 }, base), "age 50")
})
