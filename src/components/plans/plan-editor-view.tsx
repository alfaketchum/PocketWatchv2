"use client"

import dynamic from "next/dynamic"
import { useCallback, useDeferredValue, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { EmptyState } from "@/components/ui/empty-state"
import { usePlanDocument } from "@/hooks/plans/use-plan-document"
import { usePlanMode } from "@/hooks/plans/use-plan-mode"
import { usePlanProjection } from "@/hooks/plans/use-plan-projection"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import { advancedSettingsInUse, BASIC_TABS } from "@/lib/plans/plan-mode"
import { AdvancedInUseNotice } from "./advanced-in-use-notice"
import type { PlanEditorProps } from "./plans-helpers"
import { AccountsEditor } from "./editor/accounts-editor"
import { AssetsDebtsEditor } from "./editor/assets-debts-editor"
import { CashFlowEditor } from "./editor/cash-flow-editor"
import { ExpensesEditor } from "./editor/expenses-editor"
import { IncomesEditor } from "./editor/incomes-editor"
import { MilestonesEditor } from "./editor/milestones-editor"
import { PlanEditorPanel } from "./editor/plan-editor-panel"
import { DEFAULT_PLAN_TAB, isPlanTab, planTabFrom, type PlanTab } from "./editor/plan-editor-tabs"
import { PlanSettingsEditor } from "./editor/plan-settings"
import { usePlanEditorView, ViewToggle } from "./editor/plan-table"
import { PlanEditorHeader } from "./plan-editor-header"
import { DEFAULT_LAYOUT, LayoutBlock, usePlanLayout, type PlanBlock } from "./plan-layout"
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
  const pathname = usePathname()
  const params = useSearchParams()
  const tabParam = params.get("tab")
  // The tab lives in state; the URL follows via history.replaceState (no navigation, no server round trip).
  const [tab, setTabState] = useState<PlanTab>(() => planTabFrom(tabParam))
  useEffect(() => setTabState(planTabFrom(tabParam)), [tabParam])
  const setTab = useCallback(
    (next: PlanTab) => {
      setTabState(next)
      window.history.replaceState(window.history.state, "", next === DEFAULT_PLAN_TAB ? pathname : `${pathname}?tab=${next}`)
    },
    [pathname],
  )
  const { isBasic, setMode } = usePlanMode()
  // Basic has no Cash flow tab: a link to it lands on the first tab.
  const activeTab = isBasic && !BASIC_TABS.includes(tab) ? DEFAULT_PLAN_TAB : tab
  // The tab highlights at once; its content renders right after, without holding up the click.
  const shownTab = useDeferredValue(activeTab)
  const { isHidden } = usePrivacyMode()
  const [listView, setListView] = usePlanEditorView()
  const [layout, setLayout] = usePlanLayout()
  const [editingLayout, setEditingLayout] = useState(false)
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
  // Basic always shows today's dollars (its toggle is Advanced).
  useEffect(() => {
    if (isBasic) setBasis("today")
  }, [isBasic, setBasis])
  const advancedInUse = useMemo(() => (isBasic && document ? advancedSettingsInUse(document) : []), [isBasic, document])
  const router = useRouter()
  const openAdvanced = useCallback(
    (target: string) => {
      setMode("advanced")
      if (isPlanTab(target)) setTab(target)
      else router.push(`/plans/${planId}/${target}`)
    },
    [setMode, setTab, router, planId],
  )

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

  const Editor = shownTab === "overview" ? null : EDITORS[shownTab]
  const blocks: Record<PlanBlock, ReactNode> = {
    summary: <PlanSummaryStrip summary={summary} isHidden={isHidden} />,
    tabs: (
      <PlanEditorPanel tab={activeTab} onTabChange={setTab}>
        {Editor ? (
          <Editor
            doc={document}
            update={update}
            view={TABLE_TABS.has(shownTab) ? listView : "detailed"}
            onEditItem={editInList}
            viewToggle={TABLE_TABS.has(shownTab) ? <ViewToggle value={listView} onChange={setListView} /> : undefined}
            planCreatedAt={plan.createdAt}
          />
        ) : (
          <>
            <StressOverviewCard doc={document} planId={planId} projection={projection} />
            <PlanLedgerTable doc={view} rows={rows} basis={basis} isHidden={isHidden} fileName={plan.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")} />
          </>
        )}
      </PlanEditorPanel>
    ),
    chart: <PlanNetWorthChart doc={view} projection={projection} rows={rows} basis={basis} onBasisChange={setBasis} isHidden={isHidden} panelSide={layout.panelSide} />,
  }
  return (
    <div className="space-y-5">
      <PlanEditorHeader
        name={plan.name}
        isPrimary={plan.isPrimary}
        isSaving={isSaving}
        editingLayout={editingLayout && !isBasic}
        onEditLayout={() => setEditingLayout((on) => !on)}
        onResetLayout={() => setLayout(DEFAULT_LAYOUT)}
      />
      <AdvancedInUseNotice settings={advancedInUse} onOpen={openAdvanced} />
      {layout.order.map((block) => (
        <LayoutBlock key={block} block={block} layout={layout} editing={editingLayout && !isBasic} onChange={setLayout}>
          {blocks[block]}
        </LayoutBlock>
      ))}
    </div>
  )
}
