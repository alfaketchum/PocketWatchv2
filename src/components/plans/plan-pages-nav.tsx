"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { HybridTooltip } from "@/components/ui/hybrid-tooltip"
import { usePlanMode } from "@/hooks/plans/use-plan-mode"
import { useIsTouchDevice } from "@/hooks/use-touch-device"

interface PlanPage {
  /** After /plans/[id]; "" is the plan itself. */
  path: string
  label: string
  icon: string
  /** What's on the page, shown on hover. */
  hint: string
  advanced?: boolean
}

const PLAN_PAGES: PlanPage[] = [
  { path: "", label: "Plan", icon: "dashboard", hint: "Your plan's chart, key numbers and editor" },
  { path: "cashflow", label: "Money flow", icon: "account_tree", hint: "Where each year's money comes from and where it goes" },
  { path: "whatif", label: "What if", icon: "tune", hint: "Try changes (retire earlier, spend less, a windfall) without touching your plan" },
  { path: "trading", label: "Trading", icon: "candlestick_chart", hint: "What active trading costs in tax, and how much better than holding it has to do", advanced: true },
  {
    path: "loans",
    label: "Loans",
    icon: "request_quote",
    hint: "Each loan's amortization, and what paying extra, investing the difference or a shorter loan does to your plan",
    advanced: true,
  },
  { path: "stress", label: "Stress test", icon: "thunderstorm", hint: "Your plan replayed through every market since 1871, crashes and stagflation included", advanced: true },
]

/** The page you're on: accent-filled, like the active Basic / Advanced segment. */
const ACTIVE_STYLE = { background: "var(--primary)", borderColor: "var(--primary)", color: "#fff" }

/** One page button; hovering says what's there (on touch, a tap just opens it). */
function PageLink({ planId, page, active }: { planId: string; page: PlanPage; active: boolean }) {
  const isTouch = useIsTouchDevice()
  const link = (
    <Link
      href={page.path ? `/plans/${planId}/${page.path}` : `/plans/${planId}`}
      aria-current={active ? "page" : undefined}
      className="btn-secondary text-xs inline-flex items-center gap-1.5"
      style={active ? ACTIVE_STYLE : undefined}
    >
      <span className="material-symbols-rounded" style={{ fontSize: 16 }} aria-hidden="true">
        {page.icon}
      </span>
      {page.label}
    </Link>
  )
  if (isTouch) return link
  return (
    <HybridTooltip content={page.hint} side="bottom" contentClassName="text-xs">
      {link}
    </HybridTooltip>
  )
}

/** A plan's pages as one row, the same on every one of them, with the current page highlighted. */
export function PlanPagesNav({ planId }: { planId: string }) {
  const pathname = usePathname()
  const { isBasic } = usePlanMode()
  const current = pathname.replace(/\/$/, "").split("/")[3] ?? ""
  // Basic hides the Advanced pages, unless you're on one (it shows its own notice).
  const pages = PLAN_PAGES.filter((p) => !p.advanced || !isBasic || p.path === current)
  return (
    <nav aria-label="Plan pages" className="flex items-center justify-center gap-2 flex-wrap">
      {pages.map((page) => (
        <PageLink key={page.label} planId={planId} page={page} active={page.path === current} />
      ))}
    </nav>
  )
}
