"use client"

import type { FireInputs, SwrPreset } from "@/lib/fire/fire-types"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { CRYPTO_PRESET_LABELS, resolveDrops, type TierDrops } from "@/lib/fire/crypto-stress"
import { CRYPTO_TIER_LABELS, RISK_TIERS } from "@/lib/fire/crypto-tiers"
import { fmtMoney, fmtPct } from "./fire-helpers"
import { FireFlowsEditor } from "./fire-flows-editor"
import { FireLumpSumsEditor } from "./fire-lump-sums-editor"
import { FireNumberField } from "./fire-number-field"
import { ChoiceChips, InputBlock, Toggle } from "./fire-input-controls"
import { FireBaristaCheck, FireBaristaFields } from "./fire-barista-fields"
import { FireRealReturnHelper } from "./fire-real-return-helper"

type SectionProps = { state: FirePlanState }

function setterFor(state: FirePlanState) {
  return <K extends keyof FireInputs>(key: K) => (value: FireInputs[K]) => state.update({ [key]: value } as Partial<FireInputs>)
}

export function YouSection({ state }: SectionProps) {
  const { inputs, update } = state
  const set = setterFor(state)
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <FireNumberField label="Your age" value={inputs.currentAge} min={10} max={100} onChange={set("currentAge")} />
      <FireNumberField label="Retirement length (years)" value={inputs.horizonYears} min={10} max={80} onChange={(v) => update({ horizonYears: Math.round(v) })} />
      <FireNumberField label="Traditional retirement age" value={inputs.coastAge} min={inputs.currentAge + 1} max={100} onChange={set("coastAge")} hint="Used for Coast FIRE" />
    </div>
  )
}

export function MoneySection({ state }: SectionProps) {
  const { inputs, update, plan, baseline } = state
  const set = setterFor(state)
  const b = baseline.investable
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <FireNumberField
          label="Invested now"
          prefix="$"
          value={Math.round(plan.investable)}
          min={0}
          onChange={set("investableOverride")}
          auto={{ isAuto: plan.investableIsAuto, onReset: () => update({ investableOverride: null }) }}
        />
        <FireNumberField
          label="Spending / yr"
          prefix="$"
          value={Math.round(plan.annualSpend)}
          min={0}
          onChange={set("annualSpend")}
          auto={{ isAuto: plan.spendIsAuto, onReset: () => update({ annualSpend: null }) }}
        />
        <FireNumberField
          label="Invested / yr until FI"
          prefix="$"
          value={Math.round(plan.annualContribution)}
          onChange={set("annualContribution")}
          hint="Every year until you reach FI"
          auto={{ isAuto: plan.contributionIsAuto, onReset: () => update({ annualContribution: null }) }}
        />
        <FireNumberField label="Real return" suffix="%" scale={100} value={inputs.realReturn} min={-0.05} max={0.15} onChange={set("realReturn")} hint="After inflation" />
      </div>
      <FireRealReturnHelper horizonYears={inputs.horizonYears} onUse={set("realReturn")} />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="text-xs text-foreground-muted">Also count as invested:</span>
        <Toggle label={`Cash (${fmtMoney(b.cash)})`} checked={inputs.includeCash} onChange={set("includeCash")} />
        <Toggle label={`Crypto (${fmtMoney(b.crypto)})`} checked={inputs.includeCrypto} onChange={set("includeCrypto")} />
      </div>
    </div>
  )
}

const SWR_OPTIONS: { value: SwrPreset; label: string }[] = [
  { value: "4", label: "4%" },
  { value: "3.5", label: "3.5%" },
  { value: "3.25", label: "3.25%" },
  { value: "cape", label: "CAPE rule" },
  { value: "custom", label: "Custom" },
]

export function WithdrawalsSection({ state }: SectionProps) {
  const { inputs, update, plan, history, allocation } = state
  const set = setterFor(state)
  const manual = inputs.allocationSource === "manual"
  const g = inputs.glidepath
  return (
    <div className="space-y-6">
      <InputBlock title={`Withdrawal rate · ${fmtPct(plan.swr, 2)}`} description="The share of your nest egg you spend in year one, then adjust for inflation.">
        <ChoiceChips label="Withdrawal rule" options={SWR_OPTIONS} value={inputs.swrPreset} onChange={set("swrPreset")} />
        {inputs.swrPreset === "custom" && (
          <div className="max-w-[160px]">
            <FireNumberField label="Custom rate" suffix="%" scale={100} value={inputs.customSwr} min={0.005} max={0.15} onChange={set("customSwr")} />
          </div>
        )}
        {inputs.swrPreset === "cape" && (
          <div className="grid grid-cols-2 gap-3 max-w-[340px]">
            <FireNumberField label="Base a" suffix="%" scale={100} value={inputs.capeA} min={0} max={0.1} onChange={set("capeA")} />
            <FireNumberField label="Slope b" value={inputs.capeB} min={0} max={5} onChange={set("capeB")} hint={history ? `a + b ÷ CAPE ${history.latestCape.toFixed(1)}` : undefined} />
          </div>
        )}
      </InputBlock>

      <InputBlock title="Investment mix in retirement" description="Stocks vs 10-year Treasuries in the historical simulation.">
        <ChoiceChips
          label="Allocation source"
          options={[
            { value: "portfolio", label: `My portfolio (${Math.round(allocation.sim.stocks * 100)}% stocks)` },
            { value: "manual", label: "Set manually" },
          ]}
          value={inputs.allocationSource}
          onChange={set("allocationSource")}
        />
        {manual && (
          <div className="space-y-3">
            <Toggle label="Glidepath: start safer, shift into stocks" checked={g.enabled} onChange={(enabled) => update({ glidepath: { ...g, enabled } })} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {!g.enabled && <FireNumberField label="Stocks" suffix="%" scale={100} value={inputs.equityShare} min={0} max={1} onChange={set("equityShare")} />}
              {g.enabled && (
                <>
                  <FireNumberField label="Stocks at start" suffix="%" scale={100} value={g.startEquity} min={0} max={1} onChange={(startEquity) => update({ glidepath: { ...g, startEquity } })} />
                  <FireNumberField label="Stocks at end" suffix="%" scale={100} value={g.endEquity} min={0} max={1} onChange={(endEquity) => update({ glidepath: { ...g, endEquity } })} />
                  <FireNumberField label="Over (years)" value={g.years} min={1} max={40} onChange={(years) => update({ glidepath: { ...g, years } })} />
                </>
              )}
            </div>
          </div>
        )}
      </InputBlock>

      <InputBlock title="Money left at the end" description="0% spends it all; 100% keeps your starting nest egg (in today's dollars) for heirs.">
        <div className="max-w-[160px]">
          <FireNumberField label="Final value" suffix="%" scale={100} value={inputs.finalValueTarget} min={0} max={1} onChange={set("finalValueTarget")} />
        </div>
      </InputBlock>
    </div>
  )
}

export function IncomeSection({ state }: SectionProps) {
  const { inputs } = state
  const set = setterFor(state)
  return (
    <div className="space-y-6">
      <InputBlock title="Recurring income" description="Social Security, pensions — anything paid every year from a certain age.">
        <FireFlowsEditor flows={inputs.flows} onChange={set("flows")} />
      </InputBlock>
      <InputBlock title="Inheritance & one-time amounts" description="Before FI it gets you there sooner; after, it lets you spend more.">
        <FireLumpSumsEditor lumpSums={inputs.lumpSums} currentAge={inputs.currentAge} onChange={set("lumpSums")} />
      </InputBlock>
    </div>
  )
}

export function CryptoSection({ state }: SectionProps) {
  const { inputs, update } = state
  if (!inputs.includeCrypto) {
    return <p className="text-sm text-foreground-muted">Crypto isn&apos;t counted as invested. Turn it on under Money to stress-test it.</p>
  }
  const drops = resolveDrops(inputs.cryptoStressPreset, inputs.cryptoDrops)
  const setDrop = (tier: keyof TierDrops, value: number) => update({ cryptoStressPreset: "custom", cryptoDrops: { ...drops, [tier]: value } })
  return (
    <div className="space-y-4">
      <ChoiceChips
        label="Crypto stress preset"
        options={(["cautious", "moderate", "full", "custom"] as const).map((p) => ({ value: p, label: CRYPTO_PRESET_LABELS[p] }))}
        value={inputs.cryptoStressPreset}
        onChange={(cryptoStressPreset) => update({ cryptoStressPreset })}
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {RISK_TIERS.map((t) => (
          <FireNumberField key={t} label={`${CRYPTO_TIER_LABELS[t]} drop`} suffix="%" scale={100} value={drops[t]} min={0} max={1} onChange={(v) => setDrop(t, v)} />
        ))}
      </div>
    </div>
  )
}

export function MilestonesSection({ state }: SectionProps) {
  const { inputs, update } = state
  const set = setterFor(state)
  return (
    <div className="space-y-6">
      <InputBlock title="Barista FIRE" description="Leave full-time work early and bridge with a part-time job, then retire fully.">
        <FireBaristaFields state={state} />
        <FireBaristaCheck state={state} />
      </InputBlock>
      <InputBlock title="Tier spending levels" description="Yearly retirement spending that defines each lifestyle.">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
      </InputBlock>
    </div>
  )
}
