import {
  applyBreak,
  applyCareer,
  applyChild,
  applyCustom,
  applyDivorce,
  applyHome,
  applyInheritance,
  applyMarried,
  applyMove,
  applyRetire,
  applyVehicle,
  applyWindfall,
  type TemplateKey,
} from "@/lib/plans/milestone-templates"
import { applyElderCare } from "@/lib/plans/elder-care"
import { applyWidowed } from "@/lib/plans/widowed"
import { applyPension, applySocialSecurity } from "@/lib/plans/income-templates"
import type { PlanDocument } from "@/lib/plans/plan-types"
import { newItemId } from "../plans-helpers"
import { NO_STATE } from "./plan-tax-settings"
import { DEFAULT_NAMES, SAME_STATE, type TemplateDraft } from "./template-draft"

const ELDER_CARE_ICON = "elderly_woman"

/** Apply a template's draft to the plan. */
export function applyTemplate(key: TemplateKey, d: TemplateDraft, doc: PlanDocument): PlanDocument {
  const name = d.name.trim() || DEFAULT_NAMES[key] || "Milestone"
  switch (key) {
    case "retire":
      return applyRetire(doc, d.when)
    case "married":
      return applyMarried(
        doc,
        {
          when: d.when,
          partner: d.partnerOn ? { name: d.partnerName || "Partner", birthYear: d.partnerBirthYear } : null,
          partnerIncome: d.partnerOn ? d.partnerIncome : 0,
          incomeTaxRate: d.incomeTaxRate,
          capitalGainsRate: d.capitalGainsRate,
          weddingCost: d.weddingCost,
        },
        newItemId,
      )
    case "divorce":
      return applyDivorce(
        doc,
        {
          when: d.when,
          endIncomeIds: d.endIncomeIds,
          exShare: d.exShare,
          legalCost: d.legalCost,
          supportPerYear: d.supportPerYear,
          supportYears: d.years,
          incomeTaxRate: d.incomeTaxRate,
          capitalGainsRate: d.capitalGainsRate,
        },
        newItemId,
      )
    case "widowed":
      return applyWidowed(
        doc,
        {
          personId: d.personId,
          when: d.when,
          endIncomeIds: d.endIncomeIds,
          survivorBenefit: d.survivorBenefit,
          lifeInsurance: d.lifeInsurance,
          finalCosts: d.finalCosts,
          incomeTaxRate: d.incomeTaxRate,
          capitalGainsRate: d.capitalGainsRate,
        },
        "local_florist",
        newItemId,
      )
    case "elderCare":
      return applyElderCare(
        doc,
        {
          parentName: d.name,
          arrangement: d.arrangement,
          startYear: d.startYear,
          years: d.years,
          yearlyCost: d.yearlyCost,
          oneTimeCost: d.arrangement === "moveIn" ? d.oneTimeCost : 0,
          aidePerYear: d.aidePerYear,
          payer: d.payer,
          parentShare: d.parentShare,
          workCut: d.cutWork ? { incomeId: d.incomeId, keep: d.workKeep } : null,
        },
        ELDER_CARE_ICON,
        newItemId,
      )
    case "socialSecurity":
      return applySocialSecurity(doc, { personId: d.personId, monthlyAtFra: d.monthlyAtFra, claimAge: d.age }, newItemId)
    case "pension":
      return applyPension(doc, { name, personId: d.personId, amount: d.amount, startAge: d.age, raises: d.raises }, newItemId)
    case "child":
      return applyChild(doc, name, d.startYear, newItemId)
    case "home":
    case "vehicle": {
      const input = {
        name, when: d.when, price: d.price, payWith: d.payWith, downPayment: d.downPayment, rate: d.rate, termYears: d.termYears,
        appreciation: d.appreciation, replaceEveryYears: key === "vehicle" && d.replaceEvery >= 1 ? Math.round(d.replaceEvery) : null,
        ...(key === "vehicle" ? { vehicleAge: d.vehicleAge } : {}),
      }
      return key === "home" ? applyHome(doc, input, newItemId) : applyVehicle(doc, input, newItemId)
    }
    case "career":
      return applyCareer(doc, { incomeId: d.incomeId, when: d.when, name, amount: d.amount }, newItemId)
    case "break":
      return applyBreak(doc, { incomeId: d.incomeId, startYear: d.startYear, years: d.years }, newItemId)
    case "move":
      return applyMove(doc, { name, when: d.when, percent: d.percent, state: d.moveTo === SAME_STATE ? undefined : d.moveTo === NO_STATE ? null : d.moveTo }, newItemId)
    case "inheritance":
      return applyInheritance(doc, { name, when: d.when, parts: d.parts, relationship: d.relationship, decedentState: d.decedentState }, newItemId)
    case "windfall":
      return applyWindfall(doc, { name, when: d.when, amount: d.amount, taxable: d.taxable }, newItemId)
    case "custom":
      return applyCustom(doc, { name, when: d.when }, newItemId)
  }
}

/** Why Create is disabled, if it is. */
export function draftProblem(key: TemplateKey, d: TemplateDraft, doc: PlanDocument): string | null {
  if ((key === "career" || key === "break") && !doc.incomes.some((i) => i.id === d.incomeId)) return "Add an income first."
  if (key === "custom" && !d.name.trim()) return "Give it a name."
  if (key === "widowed" && doc.people.length < 2) return "Add your partner first."
  if (key === "socialSecurity" && d.monthlyAtFra <= 0) return "Enter your benefit."
  if (key === "pension" && d.amount <= 0) return "Enter an amount."
  if (key === "inheritance" && !d.parts.some((p) => p.amount > 0)) return "Enter an amount."
  return null
}
