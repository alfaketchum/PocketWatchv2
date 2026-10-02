import test from "node:test"
import assert from "node:assert/strict"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { applyNewSource, ignoreNewSource, newSources, type LinkedSources } from "@/lib/plans/plan-new-sources"
import type { DebtKind, PlanAccount, PlanDebt, PlanDocument } from "@/lib/plans/plan-types"

const CREATED = "2026-09-01T00:00:00.000Z"
const BEFORE = "2026-08-01T00:00:00.000Z"
const AFTER = "2026-09-20T00:00:00.000Z"

const account = (ref: string, name = `Account ${ref}`): PlanAccount => ({
  id: `acct-${ref}`, name, taxTreatment: "taxable", balance: 10_000, costBasis: null, returnRate: 0.07, owner: null,
  source: { kind: "finance-account", refId: ref },
})
const debt = (ref: string, kind: DebtKind): PlanDebt => ({
  id: `debt-${ref}`, name: `Loan ${ref}`, kind, balance: 20_000, rate: 0.05, monthlyPayment: 300, start: { type: "planStart" }, assetId: null,
  source: { kind: "finance-account", refId: ref },
})

const plan = (extra: Partial<PlanDocument> = {}): PlanDocument => ({ ...blankPlanDocument(new Date(2026, 8, 1), 40), ...extra })
const ids = (doc: PlanDocument, linked: LinkedSources) =>
  newSources(doc, linked, CREATED).map((s) => (s.type === "account" ? s.account.source?.refId : s.debt.source?.refId))

test("offers only accounts linked after the plan was created", () => {
  const linked: LinkedSources = { accounts: [account("old"), account("new")], debts: [], linkedAt: { old: BEFORE, new: AFTER } }
  assert.deepEqual(ids(plan(), linked), ["new"])
})

test("skips what the plan already holds, ignores, or has under the same name (a reconnected account)", () => {
  const linked: LinkedSources = {
    accounts: [account("held"), account("ignored"), account("relinked", "Brokerage (Fidelity)"), account("fresh")],
    debts: [],
    linkedAt: { held: AFTER, ignored: AFTER, relinked: AFTER, fresh: AFTER },
  }
  const doc = plan({ accounts: [account("held"), { ...account("gone"), name: "Brokerage (Fidelity)" }], ignoredSources: ["ignored"] })
  assert.deepEqual(ids(doc, linked), ["fresh"])
})

test("offers student and other loans; mortgages, car loans and cards are left to their own flows", () => {
  const kinds: DebtKind[] = ["student", "other", "mortgage", "auto", "credit"]
  const linked: LinkedSources = { accounts: [], debts: kinds.map((k) => debt(k, k)), linkedAt: Object.fromEntries(kinds.map((k) => [k, AFTER])) }
  assert.deepEqual(ids(plan(), linked), ["student", "other"])
})

test("adding brings the item in linked back; ignoring stops the offer", () => {
  const linked: LinkedSources = { accounts: [account("a")], debts: [debt("s", "student")], linkedAt: { a: AFTER, s: AFTER } }
  let n = 0
  const newId = (p: string) => `${p}-${++n}`
  const [acct, loan] = newSources(plan(), linked, CREATED)
  const added = applyNewSource(applyNewSource(plan(), acct, newId), loan, newId)
  assert.equal(added.accounts.at(-1)?.source?.refId, "a")
  assert.equal(added.debts.at(-1)?.source?.refId, "s")
  assert.deepEqual(newSources(added, linked, CREATED), [])
  const ignored = ignoreNewSource(plan(), acct)
  assert.deepEqual(ids(ignored, linked), ["s"])
})
