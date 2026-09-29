"use client"

import Link from "next/link"
import { useFireProfile } from "@/hooks/finance/use-fire-profile"
import { comparePeers, type ScfData } from "@/lib/fire/scf-peers"
import scfJson from "@/lib/fire/data/scf-networth.json"
import { formatCurrency } from "@/lib/utils"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import { InfoTooltip } from "@/components/ui/info-tooltip"

const SCF = scfJson as ScfData

function fmtShort(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `$${Math.round(v / 1e3)}k`
  return formatCurrency(v, "USD", 0)
}

/** Where your net worth sits among US households your age (Fed SCF 2022). */
export function NetWorthPeersCard({ netWorth, isHidden }: { netWorth: number; isHidden: boolean }) {
  const profile = useFireProfile()
  if (profile.isLoading) return <div className="h-[132px] animate-shimmer rounded-xl" />

  if (!profile.data?.saved) {
    return (
      <div className="bg-card border border-card-border rounded-xl p-5 text-sm text-foreground-muted" style={{ boxShadow: "var(--shadow-sm)" }}>
        Compare your net worth with people your age —{" "}
        <Link href="/fire" className="text-primary hover:underline">set your age on the FIRE page</Link>.
      </div>
    )
  }

  const age = profile.data.inputs.currentAge
  const peers = comparePeers(SCF, age, netWorth)
  if (!peers) return null
  const [lo, hi] = peers.ages
  const ageLabel = hi >= 120 ? `${lo}+` : lo === 0 ? `under ${hi + 1}` : `${lo}–${hi}`

  return (
    <div className="bg-card border border-card-border rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center gap-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground-muted">Vs. people your age</p>
        <InfoTooltip content={`${SCF.source}, households whose head is ${ageLabel}, in ${SCF.dollars} dollars. The survey's net worth includes home equity and vehicles, which may not be in your PocketWatch total.`}>
          <span className="material-symbols-rounded text-foreground-muted cursor-help" style={{ fontSize: 13 }}>info</span>
        </InfoTooltip>
      </div>
      <p className="text-sm text-foreground mt-1">
        {peers.percentile >= 99 ? "Top 1%" : <>Ahead of about <b>{Math.round(peers.percentile)}%</b></>} of US households aged {ageLabel}{" "}
        <span className="text-foreground-muted">(median {fmtShort(peers.median)})</span>
      </p>
      <div className="relative mt-5 mb-6 h-2 rounded-full bg-gradient-to-r from-foreground/10 to-primary/40">
        {peers.marks.map((m) => (
          <div key={m.p} className="absolute -translate-x-1/2 top-3 text-[9px] text-foreground-muted text-center" style={{ left: `${m.p}%` }}>
            <div className="w-px h-2 bg-foreground/30 mx-auto -mt-3 mb-1" />
            p{m.p}
            <BlurredValue isHidden={isHidden}>
              <div className="tabular-nums">{fmtShort(m.value)}</div>
            </BlurredValue>
          </div>
        ))}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-primary ring-2 ring-card"
          style={{ left: `${Math.min(99.5, Math.max(0.5, peers.percentile))}%` }}
          title="You"
        />
      </div>
    </div>
  )
}
