"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { DEFAULT_FIRE_INPUTS } from "@/lib/fire/fire-constants"
import type { FireInputs, SwrPreset } from "@/lib/fire/fire-types"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { fmtMoney, fmtPct } from "./fire-helpers"
import { FireFlowsEditor } from "./fire-flows-editor"
import { FireLumpSumsEditor } from "./fire-lump-sums-editor"
import { FireNumberField } from "./fire-number-field"
import { CRYPTO_PRESET_LABELS, resolveDrops, type TierDrops } from "@/lib/fire/crypto-stress"
import { CRYPTO_TIER_LABELS, RISK_TIERS } from "@/lib/fire/crypto-tiers"

const SWR_OPTIONS: { value: SwrPreset; label: string }[] = [
  { value: "4", label: "4%" },
  { value: "3.5", label: "3.5%" },
  { value: "3.25", label: "3.25%" },
  { value: "cape", label: "CAPE rule" },
  { value: "custom", label: "Custom" },
]

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted mb-2">{title}</p>
      {children}
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[var(--primary)]" />
      {label}
    </label>
  )
}

/** Full Advanced-mode input set: portfolio, withdrawal rule, retirement simulation, income, tiers. */
export function FireInputsPanel({ state }: { state: FirePlanState }) {
  const { inputs, update, plan, baseline, history, allocation } = state
  const manual = inputs.allocationSource === "manual"
  const drops = resolveDrops(inputs.cryptoStressPreset, inputs.cryptoDrops)
  const setDrop = (tier: keyof TierDrops, value: number) =>
    update({ cryptoStressPreset: "custom", cryptoDrops: { ...drops, [tier]: value } })
  const set = <K extends keyof FireInputs>(key: K) => (value: FireInputs[K]) => update({ [key]: value } as Partial<FireInputs>)
  const b = baseline.investable

  return (
      <div className="space-y-6">
        <Group title="Today">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <FireNumberField label="Age" value={inputs.currentAge} min={10} max={100} onChange={set("currentAge")} />
            <FireNumberField
              label="Invested assets"
              prefix="$"
              value={Math.round(plan.investable)}
              min={0}
              onChange={set("investableOverride")}
              auto={{ isAuto: plan.investableIsAuto, onReset: () => update({ investableOverride: null }) }}
            />
            <FireNumberField
              label="Retirement spend / yr"
              prefix="$"
              value={Math.round(plan.annualSpend)}
              min={0}
              onChange={set("annualSpend")}
              hint={baseline.typicalAnnualSpend !== null ? `Median month ×12: ${fmtMoney(baseline.typicalAnnualSpend)}` : undefined}
              auto={{ isAuto: plan.spendIsAuto, onReset: () => update({ annualSpend: null }) }}
            />
            <FireNumberField
              label="Invested / yr"
              prefix="$"
              value={Math.round(plan.annualContribution)}
              onChange={set("annualContribution")}
              auto={{ isAuto: plan.contributionIsAuto, onReset: () => update({ annualContribution: null }) }}
            />
            <FireNumberField label="Real return" suffix="%" scale={100} value={inputs.realReturn} min={-0.05} max={0.15} onChange={set("realReturn")} />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3">
            <span className="text-[11px] text-foreground-muted">
              Auto = investments {fmtMoney(b.investments)} + savings {fmtMoney(b.savings)}
            </span>
            <Toggle label={`Include cash (${fmtMoney(b.cash)})`} checked={inputs.includeCash} onChange={set("includeCash")} />
            <Toggle label={`Include crypto (${fmtMoney(b.crypto)})`} checked={inputs.includeCrypto} onChange={set("includeCrypto")} />
          </div>
        </Group>

        <Group title="Withdrawal rule">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {SWR_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => update({ swrPreset: o.value })}
                className={cn(
                  "rounded-lg border px-3 py-1 text-xs font-medium transition-colors",
                  inputs.swrPreset === o.value ? "border-primary bg-primary/10 text-primary" : "border-card-border text-foreground-muted hover:text-foreground",
                )}
              >
                {o.label}
              </button>
            ))}
            <span className="self-center text-xs text-foreground-muted ml-2">Effective: <b className="text-foreground">{fmtPct(plan.swr, 2)}</b></span>
          </div>
          {inputs.swrPreset === "custom" && (
            <div className="max-w-[160px]">
              <FireNumberField label="Custom SWR" suffix="%" scale={100} value={inputs.customSwr} min={0.005} max={0.15} onChange={set("customSwr")} />
            </div>
          )}
          {inputs.swrPreset === "cape" && (
            <div className="grid grid-cols-2 gap-3 max-w-[340px]">
              <FireNumberField label="Base a" suffix="%" scale={100} value={inputs.capeA} min={0} max={0.1} onChange={set("capeA")} />
              <FireNumberField
                label="Slope b"
                value={inputs.capeB}
                min={0}
                max={5}
                onChange={set("capeB")}
                hint={history ? `WR = a + b ÷ CAPE (${history.latestCape.toFixed(1)})` : undefined}
              />
            </div>
          )}
        </Group>

        <Group title="Retirement simulation">
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {([
              { value: "portfolio", label: `My portfolio (${Math.round(allocation.sim.stocks * 100)}% stocks)` },
              { value: "manual", label: "Manual mix" },
            ] as const).map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => update({ allocationSource: o.value })}
                className={cn(
                  "rounded-lg border px-3 py-1 text-xs font-medium transition-colors",
                  inputs.allocationSource === o.value ? "border-primary bg-primary/10 text-primary" : "border-card-border text-foreground-muted hover:text-foreground",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <FireNumberField label="Horizon (years)" value={inputs.horizonYears} min={10} max={80} onChange={(v) => update({ horizonYears: Math.round(v) })} />
            <FireNumberField label="Final value target" suffix="%" scale={100} value={inputs.finalValueTarget} min={0} max={1} onChange={set("finalValueTarget")} hint="0% = spend it all · 100% = preserve capital" />
            {manual && !inputs.glidepath.enabled && (
              <FireNumberField label="Stocks" suffix="%" scale={100} value={inputs.equityShare} min={0} max={1} onChange={set("equityShare")} hint="Rest in 10-yr Treasuries" />
            )}
            {manual && inputs.glidepath.enabled && (
              <>
                <FireNumberField label="Stocks at start" suffix="%" scale={100} value={inputs.glidepath.startEquity} min={0} max={1} onChange={(startEquity) => update({ glidepath: { ...inputs.glidepath, startEquity } })} />
                <FireNumberField label="Stocks after glide" suffix="%" scale={100} value={inputs.glidepath.endEquity} min={0} max={1} onChange={(endEquity) => update({ glidepath: { ...inputs.glidepath, endEquity } })} />
              </>
            )}
          </div>
          {manual && <div className="flex flex-wrap items-center gap-4 mt-3">
            <Toggle
              label="Use an equity glidepath"
              checked={inputs.glidepath.enabled}
              onChange={(enabled) => update({ glidepath: { ...inputs.glidepath, enabled } })}
            />
            {inputs.glidepath.enabled && (
              <div className="max-w-[140px]">
                <FireNumberField label="Glide over (years)" value={inputs.glidepath.years} min={1} max={40} onChange={(years) => update({ glidepath: { ...inputs.glidepath, years } })} />
              </div>
            )}
          </div>}
        </Group>

        <Group title="Retirement income">
          <FireFlowsEditor flows={inputs.flows} onChange={set("flows")} />
        </Group>

        <Group title="Inheritance & one-time amounts">
          <FireLumpSumsEditor lumpSums={inputs.lumpSums} currentAge={inputs.currentAge} onChange={set("lumpSums")} />
        </Group>

        {inputs.includeCrypto && (
          <Group title={`Crypto stress · ${CRYPTO_PRESET_LABELS[inputs.cryptoStressPreset]}`}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {RISK_TIERS.map((t) => (
                <FireNumberField
                  key={t}
                  label={`${CRYPTO_TIER_LABELS[t]} drop`}
                  suffix="%"
                  scale={100}
                  value={drops[t]}
                  min={0}
                  max={1}
                  onChange={(v) => setDrop(t, v)}
                />
              ))}
            </div>
          </Group>
        )}

        <Group title="Milestones">
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <FireNumberField label="Coast: retire at" value={inputs.coastAge} min={inputs.currentAge + 1} max={100} onChange={set("coastAge")} />
            <FireNumberField label="Barista income / yr" prefix="$" value={inputs.partTimeIncome} min={0} onChange={set("partTimeIncome")} />
            {inputs.tiers.map((t, i) => (
              <FireNumberField
                key={t.key}
                label={t.label}
                prefix="$"
                value={t.annualSpend}
                min={0}
                onChange={(annualSpend) => update({ tiers: inputs.tiers.map((x, j) => (j === i ? { ...x, annualSpend } : x)) })}
              />
            ))}
          </div>
        </Group>
        <button type="button" className="btn-ghost text-xs" onClick={() => update({ ...DEFAULT_FIRE_INPUTS, mode: "advanced" })}>
          Reset all to defaults
        </button>
      </div>
  )
}
