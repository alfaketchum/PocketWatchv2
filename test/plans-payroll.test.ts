import test from "node:test"
import assert from "node:assert/strict"
import { payrollTax, SOCIAL_SECURITY_WAGE_BASE } from "@/lib/plans/tax/payroll-2026"

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≈ ${b}`)

test("wages: 6.2% Social Security up to the wage base, 1.45% Medicare on everything", () => {
  close(payrollTax([100_000], [], "single", 1).total, 7_650)
  const high = payrollTax([300_000], [], "single", 1)
  close(high.wages, 0.062 * SOCIAL_SECURITY_WAGE_BASE + 0.0145 * 300_000)
  close(high.additionalMedicare, 0.009 * 100_000)
})

test("each job has its own wage base; Additional Medicare uses the household's combined wages", () => {
  const couple = payrollTax([150_000, 150_000], [], "joint", 1)
  close(couple.wages, 2 * 150_000 * 0.0765)
  close(couple.additionalMedicare, 0.009 * 50_000)
})

test("self-employment: 15.3% on 92.35% of profit, half deductible; the wage base follows inflation", () => {
  const se = payrollTax([], [100_000], "single", 1)
  close(se.selfEmployment, 92_350 * 0.153)
  close(se.seDeduction, (92_350 * 0.153) / 2)
  const later = payrollTax([300_000], [], "single", 2)
  close(later.wages - 0.0145 * 300_000, 0.062 * 300_000)
})
