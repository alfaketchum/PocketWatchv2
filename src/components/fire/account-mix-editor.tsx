"use client"

import { cn } from "@/lib/utils"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import { defaultMix } from "@/lib/fire/fire-portfolio"
import type { AccountMix, CryptoTreatment } from "@/lib/fire/fire-types"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { fmtMoney } from "./fire-helpers"
import { FireNumberField } from "./fire-number-field"
import { FireSectionCard } from "./fire-section-card"

const CRYPTO_OPTIONS: { value: CryptoTreatment; label: string }[] = [
  { value: "stocks", label: "Like stocks" },
  { value: "cash", label: "Like cash" },
]

/** Stocks/bonds split per investment account (cash = the rest) and how crypto is simulated. */
export function AccountMixEditor({ state, isHidden }: { state: FirePlanState; isHidden: boolean }) {
  const { accounts, inputs, update } = state
  const investmentAccounts = accounts.filter((a) => a.group === "investments")

  const setMix = (id: string, patch: Partial<AccountMix>) => {
    const current = inputs.accountMixes[id] ?? defaultMix("investments")
    const stocks = Math.min(1, patch.stocks ?? current.stocks)
    const bonds = Math.min(1 - stocks, patch.bonds ?? current.bonds)
    update({ accountMixes: { ...inputs.accountMixes, [id]: { stocks, bonds, cash: Math.max(0, 1 - stocks - bonds) } } })
  }

  return (
    <FireSectionCard
      eyebrow="Account mix"
      info="Your brokers only report balances, so set roughly what each account holds. Anything not in stocks or bonds counts as cash. Savings and checking are cash; stablecoins are cash."
    >
      {investmentAccounts.length === 0 ? (
        <p className="text-sm text-foreground-muted">No investment accounts connected.</p>
      ) : (
        <ul className="space-y-3">
          {investmentAccounts.map((a) => {
            const mix = inputs.accountMixes[a.id] ?? defaultMix(a.group)
            return (
              <li key={a.id} className="grid grid-cols-[1fr_88px_88px] sm:grid-cols-[1fr_110px_110px_70px] gap-2 items-end">
                <div className="min-w-0 pb-1.5">
                  <p className="text-sm text-foreground truncate">{a.name}</p>
                  <BlurredValue isHidden={isHidden}>
                    <p className="text-[11px] text-foreground-muted truncate">{a.institution} · {fmtMoney(a.balance)}</p>
                  </BlurredValue>
                </div>
                <FireNumberField label="Stocks" suffix="%" scale={100} value={mix.stocks} min={0} max={1} onChange={(stocks) => setMix(a.id, { stocks })} />
                <FireNumberField label="Bonds" suffix="%" scale={100} value={mix.bonds} min={0} max={1} onChange={(bonds) => setMix(a.id, { bonds })} />
                <p className="hidden sm:block pb-2 text-right text-[11px] text-foreground-muted tabular-nums">{Math.round(mix.cash * 100)}% cash</p>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap mt-5 pt-4 border-t border-card-border">
        <p className="text-xs text-foreground-muted">
          Simulate crypto <span className="text-foreground">(no history before 2010)</span>
        </p>
        <div role="radiogroup" aria-label="Crypto treatment" className="inline-flex rounded-lg border border-card-border p-0.5">
          {CRYPTO_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={inputs.cryptoTreatment === o.value}
              onClick={() => update({ cryptoTreatment: o.value })}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                inputs.cryptoTreatment === o.value ? "bg-primary text-white" : "text-foreground-muted hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </FireSectionCard>
  )
}
