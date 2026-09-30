"use client"

import { use } from "react"
import { PlanTradingView } from "@/components/plans/trading/plan-trading-view"

export default function PlanTradingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <PlanTradingView planId={id} />
}
