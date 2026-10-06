"use client"

import { FireSectionCard } from "@/components/fire/fire-section-card"
import type { Insight, InsightFix, InsightKey } from "@/lib/plans/stress/stress-diagnosis"

const ICONS: Record<InsightKey, string> = {
  when: "schedule",
  crunch: "trending_up",
  noPaycheck: "work_off",
  riskyMix: "candlestick_chart",
  lowRisk: "savings",
  lateMoney: "hourglass_bottom",
  illiquid: "home",
  optimism: "show_chart",
  taxDrag: "receipt_long",
}

/** The row a fix points at, for scrolling to it. */
export const fixAnchor = (fix: InsightFix) => `stress-fix-${fix}`

const INFO =
  "Patterns that commonly sink a plan, checked against yours: when the money runs out, what it goes to then (today's dollars), what you're invested in, whether a paycheck covers the bills, money that arrives too late, wealth that can't pay bills, your plan's assumed returns, and taxes. Only the ones that apply are shown. See fix jumps to the setting that pulls that lever."

/** "Why it fails": the failed trials explained, most telling first, each with a jump to the lever that fixes it. */
export function StressDiagnosisCard({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null
  const jump = (fix: InsightFix) => document.getElementById(fixAnchor(fix))?.scrollIntoView({ behavior: "smooth", block: "center" })
  return (
    <FireSectionCard eyebrow="Why it fails" info={INFO}>
      <ul className="divide-y divide-card-border/60">
        {insights.map((i) => (
          <li key={i.key} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className="material-symbols-rounded mt-0.5 text-foreground-muted" style={{ fontSize: 18 }} aria-hidden="true">
              {ICONS[i.key]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{i.title}</p>
              <p className="text-xs text-foreground-muted">{i.detail}</p>
            </div>
            {i.fix && (
              <button type="button" onClick={() => jump(i.fix!)} className="btn-ghost shrink-0 px-2 py-1 text-xs text-primary">
                See fix
              </button>
            )}
          </li>
        ))}
      </ul>
    </FireSectionCard>
  )
}
