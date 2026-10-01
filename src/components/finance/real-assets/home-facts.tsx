"use client"

import { BlurredValue } from "@/components/portfolio/blurred-value"
import type { HomeDetailsSnapshot } from "@/hooks/finance/use-real-assets"
import { formatCurrency } from "@/lib/utils"

const SOURCE_LABELS: Record<string, string> = { rentcast: "RentCast", mock: "Sample data (no provider key yet)" }

interface Props {
  propertyTaxAnnual: number | null | undefined
  rentEstimate: number | null | undefined
  details: HomeDetailsSnapshot | null | undefined
  dataSource: string | null | undefined
  isHidden?: boolean
}

/** A looked-up home's tax bill, rent estimate and facts, with where they came from. */
export function HomeFacts({ propertyTaxAnnual, rentEstimate, details, dataSource, isHidden }: Props) {
  if (!dataSource) return null
  const facts = [
    details?.bedrooms != null ? `${details.bedrooms} bd` : null,
    details?.bathrooms != null ? `${details.bathrooms} ba` : null,
    details?.squareFeet ? `${details.squareFeet.toLocaleString()} sq ft` : null,
    details?.yearBuilt ? `built ${details.yearBuilt}` : null,
    details?.propertyType ?? null,
  ].filter(Boolean)
  const money = (v: number) => <BlurredValue isHidden={!!isHidden}>{formatCurrency(v)}</BlurredValue>
  return (
    <div className="rounded-xl border border-card-border bg-background-secondary/40 px-3 py-2 space-y-1 text-[11px]">
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {propertyTaxAnnual != null && (
          <span className="text-foreground-muted">
            Property tax <span className="text-foreground font-medium">{money(propertyTaxAnnual)}</span>/yr
            {details?.effectiveTaxRate ? ` (${(details.effectiveTaxRate * 100).toFixed(2)}%)` : ""}
          </span>
        )}
        {rentEstimate != null && (
          <span className="text-foreground-muted">
            Rent estimate <span className="text-foreground font-medium">{money(rentEstimate)}</span>/mo
          </span>
        )}
        {details?.valueRange && (
          <span className="text-foreground-muted">
            Value range {money(details.valueRange.low)} – {money(details.valueRange.high)}
          </span>
        )}
        {details?.hoaMonthly ? <span className="text-foreground-muted">HOA {money(details.hoaMonthly)}/mo</span> : null}
      </div>
      {facts.length > 0 && <p className="text-foreground-muted">{facts.join(" · ")}</p>}
      <p className="text-foreground-muted opacity-80">Source: {SOURCE_LABELS[dataSource] ?? dataSource}</p>
    </div>
  )
}
