"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { TOOLBAR_CLASS } from "@/components/layout/header-tools"
import { HybridTooltip } from "@/components/ui/hybrid-tooltip"
import { usePlanMode } from "@/hooks/plans/use-plan-mode"
import { useIsTouchDevice } from "@/hooks/use-touch-device"
import { cn } from "@/lib/utils"

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
  {
    path: "roth",
    label: "Roth",
    icon: "conversion_path",
    hint: "Roth conversions: rules that move traditional money to Roth, what they save, and an optimizer that finds the best",
    advanced: true,
  },
  { path: "stress", label: "Stress test", icon: "thunderstorm", hint: "Your plan through 500 markets built from history since 1871, crashes and stagflation included", advanced: true },
]

/** Which tabs show their label: in the top bar, all from xl; in the page, all from sm, and only the current one on phones. */
function labelClass(inHeader: boolean, active: boolean): string | undefined {
  if (inHeader) return "hidden xl:inline"
  return active ? undefined : "hidden sm:inline"
}

/** One tab; hovering names it and says what's there (on touch, a tap just opens it). */
function PageLink({ planId, page, active, inHeader }: { planId: string; page: PlanPage; active: boolean; inHeader: boolean }) {
  const isTouch = useIsTouchDevice()
  const link = (
    <Link
      href={page.path ? `/plans/${planId}/${page.path}` : `/plans/${planId}`}
      aria-current={active ? "page" : undefined}
      aria-label={page.label}
      className={cn(
        "flex h-11 lg:h-9 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors",
        active ? "bg-primary text-white" : "text-foreground-muted hover:bg-background-secondary hover:text-foreground",
      )}
    >
      <span className="material-symbols-rounded" style={{ fontSize: 17 }} aria-hidden="true">
        {page.icon}
      </span>
      <span className={labelClass(inHeader, active)}>{page.label}</span>
    </Link>
  )
  if (isTouch) return link
  return (
    <HybridTooltip
      side="bottom"
      contentClassName="text-xs"
      content={
        <>
          <span className="font-semibold">{page.label}</span>
          <span className="block text-foreground-muted">{page.hint}</span>
        </>
      }
    >
      {link}
    </HybridTooltip>
  )
}

/**
 * A plan's pages as one tab group, boxed like the top-bar toolbars, with the current page highlighted. In the top bar
 * (`inHeader`) the labels show from xl up, icons only below, so it fits between the toolbars. In the page, phones see
 * icons plus the current page's name, so every tab fits without scrolling.
 */
export function PlanPagesNav({ planId, inHeader = false }: { planId: string; inHeader?: boolean }) {
  const pathname = usePathname()
  const { isBasic } = usePlanMode()
  const current = pathname.replace(/\/$/, "").split("/")[3] ?? ""
  // Basic hides the Advanced pages, unless you're on one (it shows its own notice).
  const pages = PLAN_PAGES.filter((p) => !p.advanced || !isBasic || p.path === current)
  return (
    <nav aria-label="Plan pages" className={cn(TOOLBAR_CLASS, "max-w-full overflow-x-auto scrollbar-hide")}>
      {pages.map((page) => (
        <PageLink key={page.label} planId={planId} page={page} active={page.path === current} inHeader={inHeader} />
      ))}
    </nav>
  )
}
