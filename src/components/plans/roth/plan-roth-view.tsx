"use client"

import Link from "next/link"
import { EmptyState } from "@/components/ui/empty-state"
import { usePlanDocument } from "@/hooks/plans/use-plan-document"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import { ConversionRulesEditor } from "./conversion-rules-editor"
import { RothImpact } from "./roth-impact"
import { RothOptimizerCard } from "./roth-optimizer-card"

/** A plan's Roth page: conversion rules, what they do, and the optimizer. */
export function PlanRothView({ planId }: { planId: string }) {
  const { plan, document: doc, update, isLoading } = usePlanDocument(planId)
  const { isHidden } = usePrivacyMode()

  if (isLoading) return <div className="h-[520px] animate-shimmer rounded-2xl" />
  if (!plan || !doc) {
    return <EmptyState icon="error" variant="error" title="Couldn't open this plan" description="It may have been deleted." action={{ label: "Back to plans", href: "/plans" }} />
  }
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Link href={`/plans/${planId}`} className="-ml-1 inline-flex min-h-11 items-center gap-1 px-1 text-xs text-foreground-muted hover:text-foreground lg:min-h-0">
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>
            arrow_back
          </span>
          {plan.name}
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl text-foreground font-semibold">Roth conversions</h1>
          <p className="text-xs text-foreground-muted mt-0.5">
            Pay tax on traditional money in low-tax years so it grows tax-free, shrinks required withdrawals and passes to heirs untaxed
          </p>
        </div>
      </div>
      <ConversionRulesEditor doc={doc} update={update} />
      <RothImpact doc={doc} isHidden={isHidden} />
      <RothOptimizerCard doc={doc} update={update} isHidden={isHidden} />
    </div>
  )
}
