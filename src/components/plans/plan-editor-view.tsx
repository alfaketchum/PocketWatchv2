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
import { DEFAULT_PLAN_TAB, PlanEditorTabs, planTabFrom, type PlanTab } from "./editor/plan-editor-tabs"
import { PlanSettingsEditor } from "./editor/plan-settings"
import { usePlanEditorView, ViewToggle } from "./editor/plan-table"
import { PlanEditorHeader } from "./plan-editor-header"
import { StressOverviewCard } from "./stress/stress-overview-card"
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
  assumptions: PlanSettingsEditor,
}

/** Tabs holding lists of items, which switch between a compact table and detailed cards. */
const TABLE_TABS = new Set<PlanTab>(["accounts", "income", "expenses", "assets", "milestones"])

/** After switching to the detailed view, scroll to an item's card once it has rendered. */
const SCROLL_DELAY_MS = 60

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
  const tab: PlanTab = planTabFrom(tabParam)
  const setTab = useCallback(
    (next: PlanTab) => router.replace(next === DEFAULT_PLAN_TAB ? pathname : `${pathname}?tab=${next}`, { scroll: false }),
    [router, pathname],
  )
  const { isHidden } = usePrivacyMode()
  const [listView, setListView] = usePlanEditorView()
  const editInList = useCallback(
    (anchor: string) => {
      setListView("detailed")
      setTimeout(
        () => window.document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "center" }),
        SCROLL_DELAY_MS,
      )
    },
    [setListView],
  )
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
        <div className="bg-card border border-card-border rounded-2xl p-4 sm:p-6 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
          <Editor
            doc={document}
            update={update}
            view={TABLE_TABS.has(tab) ? listView : "detailed"}
            onEditItem={editInList}
            viewToggle={TABLE_TABS.has(tab) ? <ViewToggle value={listView} onChange={setListView} /> : undefined}
            planCreatedAt={plan.createdAt}
          />
        </div>
      ) : (
        <>
          <StressOverviewCard doc={document} planId={planId} />
          <PlanLedgerTable doc={view} rows={rows} basis={basis} isHidden={isHidden} fileName={plan.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")} />
        </>
      )}
    </div>
  )
}
