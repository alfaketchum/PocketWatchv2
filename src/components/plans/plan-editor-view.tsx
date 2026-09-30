"use client"

import dynamic from "next/dynamic"
import { useCallback, type ComponentType } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { EmptyState } from "@/components/ui/empty-state"
import { usePlanDocument } from "@/hooks/plans/use-plan-document"
import { usePlanProjection } from "@/hooks/plans/use-plan-projection"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import type { PlanEditorProps } from "./plans-helpers"
import { AccountsEditor } from "./editor/accounts-editor"
import { AssetsDebtsEditor } from "./editor/assets-debts-editor"
import { CashFlowEditor } from "./editor/cash-flow-editor"
import { ExpensesEditor } from "./editor/expenses-editor"
import { IncomesEditor } from "./editor/incomes-editor"
import { MilestonesEditor } from "./editor/milestones-editor"
import { isPlanTab, PlanEditorTabs, type PlanTab } from "./editor/plan-editor-tabs"
import { PlanSettingsEditor } from "./editor/plan-settings"
import { PlanEditorHeader } from "./plan-editor-header"
import { PlanBacktestCard } from "./results/plan-backtest-card"
import { PlanLedgerTable } from "./results/plan-ledger-table"
import { PlanSummaryStrip } from "./results/plan-summary-strip"

const PlanNetWorthChart = dynamic(
  () => import("./results/plan-net-worth-chart").then((m) => m.PlanNetWorthChart),
  { ssr: false, loading: () => <div className="h-[380px] animate-shimmer rounded-2xl" /> },
)

const EDITORS: Record<Exclude<PlanTab, "overview">, ComponentType<PlanEditorProps>> = {
  accounts: AccountsEditor,
  income: IncomesEditor,
  expenses: ExpensesEditor,
  assets: AssetsDebtsEditor,
  cashflow: CashFlowEditor,
  milestones: MilestonesEditor,
  settings: PlanSettingsEditor,
}

function EditorSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-[60px] animate-shimmer rounded-2xl" />
      <div className="h-[110px] animate-shimmer rounded-2xl" />
      <div className="h-[380px] animate-shimmer rounded-2xl" />
    </div>
  )
}

/** One plan: summary, net-worth chart, and the editor tabs (or the ledger on Overview). */
export function PlanEditorView({ planId }: { planId: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const tabParam = params.get("tab")
  const tab: PlanTab = isPlanTab(tabParam) ? tabParam : "overview"
  const setTab = useCallback(
    (next: PlanTab) => router.replace(next === "overview" ? pathname : `${pathname}?tab=${next}`, { scroll: false }),
    [router, pathname],
  )
  const { isHidden } = usePrivacyMode()
  const { plan, document, update, isLoading, error, isSaving } = usePlanDocument(planId)
  const { projection, summary, rows, basis, setBasis, view } = usePlanProjection(document)

  if (isLoading) return <EditorSkeleton />
  if (error || !plan || !document || !projection || !summary || !view) {
    return (
      <EmptyState
        icon="error"
        variant="error"
        title="Couldn't open this plan"
        description={error?.message ?? "It may have been deleted."}
        action={{ label: "Back to plans", href: "/plans" }}
      />
    )
  }

  const Editor = tab === "overview" ? null : EDITORS[tab]
  return (
    <div className="space-y-5">
      <PlanEditorHeader planId={planId} name={plan.name} isPrimary={plan.isPrimary} isSaving={isSaving} basis={basis} onBasisChange={setBasis} />
      <PlanSummaryStrip summary={summary} isHidden={isHidden} />
      <PlanNetWorthChart doc={view} projection={projection} rows={rows} basis={basis} isHidden={isHidden} />
      <PlanEditorTabs value={tab} onChange={setTab} />
      {Editor ? (
        <div className="bg-card border border-card-border rounded-2xl p-4 sm:p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
          <Editor doc={document} update={update} />
        </div>
      ) : (
        <>
          <PlanBacktestCard doc={view} projection={projection} isHidden={isHidden} />
          <PlanLedgerTable doc={view} rows={rows} basis={basis} isHidden={isHidden} />
        </>
      )}
    </div>
  )
}
