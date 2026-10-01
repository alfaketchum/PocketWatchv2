/**
 * 2026 US payroll taxes (FICA) on wages and self-employment. The Social Security wage base rises with the
 * plan's inflation (SSA indexes it to average wages); the Additional Medicare Tax thresholds are fixed by law.
 */
import type { FilingStatus } from "./federal-2026"

/** Social Security (OASDI) employee rate, on wages up to the wage base. */
export const SOCIAL_SECURITY_RATE = 0.062
/** 2026 Social Security wage base (SSA, October 2025). */
export const SOCIAL_SECURITY_WAGE_BASE = 184_500
/** Medicare (HI) employee rate, on all wages. */
export const MEDICARE_RATE = 0.0145
/** Additional Medicare Tax on wages and self-employment income above these (not indexed). */
export const ADDITIONAL_MEDICARE_RATE = 0.009
export const ADDITIONAL_MEDICARE_THRESHOLD: Record<FilingStatus, number> = { single: 200_000, joint: 250_000 }
/** Self-employment tax is on 92.35% of net earnings (the employer half is netted out first). */
export const SE_EARNINGS_SHARE = 0.9235

export interface PayrollTax {
  /** Social Security and Medicare on wages (your half). */
  wages: number
  /** Self-employment tax (both halves) on business income. */
  selfEmployment: number
  /** Additional Medicare Tax. */
  additionalMedicare: number
  total: number
  /** Half of self-employment tax, deducted from income before income tax. */
  seDeduction: number
}

/**
 * Payroll tax on each wage and business income for a year. Each income is treated as one person's (each
 * job gets its own wage base); `index` scales the wage base into that year's dollars.
 */
export function payrollTax(wages: number[], business: number[], status: FilingStatus, index: number): PayrollTax {
  const base = SOCIAL_SECURITY_WAGE_BASE * index
  const onWages = wages.reduce((s, w) => s + SOCIAL_SECURITY_RATE * Math.min(w, base) + MEDICARE_RATE * w, 0)
  const seEarnings = business.map((b) => Math.max(0, b) * SE_EARNINGS_SHARE)
  const selfEmployment = seEarnings.reduce((s, e) => s + 2 * SOCIAL_SECURITY_RATE * Math.min(e, base) + 2 * MEDICARE_RATE * e, 0)
  const medicareIncome = wages.reduce((s, w) => s + w, 0) + seEarnings.reduce((s, e) => s + e, 0)
  const additionalMedicare = ADDITIONAL_MEDICARE_RATE * Math.max(0, medicareIncome - ADDITIONAL_MEDICARE_THRESHOLD[status])
  return { wages: onWages, selfEmployment, additionalMedicare, total: onWages + selfEmployment + additionalMedicare, seDeduction: selfEmployment / 2 }
}
