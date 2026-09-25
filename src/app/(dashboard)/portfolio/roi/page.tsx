"use client"

import { useRoi } from "@/hooks/portfolio/use-roi"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import { PortfolioPageHeader } from "@/components/portfolio/portfolio-page-header"
import { RoiSummary } from "@/components/portfolio/roi/roi-summary"
import { RoiTokenTable } from "@/components/portfolio/roi/roi-token-table"
import { RoiVenueTable } from "@/components/portfolio/roi/roi-venue-table"

function SectionTitle({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
      <span className="material-symbols-rounded text-sm" aria-hidden="true">{icon}</span>
      {children}
    </h2>
  )
}

export default function RoiPage() {
  const { data, isLoading, isError } = useRoi()
  const { isHidden } = usePrivacyMode()

  return (
    <div className="space-y-6">
      <PortfolioPageHeader title="ROI" subtitle="Average entry, cost basis, and profit per investment" />

      {isError ? (
        <div className="bg-card border border-error/30 rounded-xl p-6 text-center text-sm text-error">
          Failed to load ROI data. Please try again.
        </div>
      ) : (
        <>
          <RoiSummary data={data} isLoading={isLoading} isHidden={isHidden} />
          <section>
            <SectionTitle icon="token">Tokens</SectionTitle>
            {isLoading
              ? <div className="h-64 rounded-xl animate-shimmer" />
              : <RoiTokenTable tokens={data?.tokens ?? []} isHidden={isHidden} />}
          </section>
          <section>
            <SectionTitle icon="candlestick_chart">Hyperliquid &amp; Lighter positions</SectionTitle>
            {isLoading
              ? <div className="h-32 rounded-xl animate-shimmer" />
              : <RoiVenueTable venues={data?.venues ?? []} isHidden={isHidden} />}
          </section>
        </>
      )}
    </div>
  )
}
