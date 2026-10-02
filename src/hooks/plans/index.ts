/**
 * Barrel re-export for the Plans React Query hooks.
 */

export { plansFetch, plansKeys, PlansFetchError } from "./shared"
export type { PlanDetail, PlanListItem, PlanMeta } from "./shared"
export { usePlansList, useCreatePlan, useUpdatePlanMeta, useDeletePlan } from "./use-plans-list"
export type { CreatePlanInput } from "./use-plans-list"
export { usePlanDetail, usePlanDocument } from "./use-plan-document"
export type { PlanUpdater } from "./use-plan-document"
export { usePlanProjection } from "./use-plan-projection"
export { useComparePlans } from "./use-compare-plans"
export { useWhatIf } from "./use-what-if"
export { usePlanImportPreview, fetchSourceBalances } from "./use-plan-import"
export type { ImportDraftResponse, SourceBalancesResponse } from "./use-plan-import"
export { useTradingActivity } from "./use-trading-activity"
export { useLinkedLoans } from "./use-linked-loans"
export { useLinkedSources } from "./use-linked-sources"
export { useMarketInflation } from "./use-market-inflation"
export { useCategorySpending } from "./use-category-spending"
export type { CategorySpendingItem } from "./use-category-spending"
