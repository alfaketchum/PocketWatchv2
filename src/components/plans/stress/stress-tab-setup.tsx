"use client"

import { FireSectionCard } from "@/components/fire/fire-section-card"
import { InflationSource } from "../editor/inflation-source"
import { StressControls } from "./stress-controls"
import { StressHomeFallbacks } from "./stress-home-fallbacks"
import { StressMixTable } from "./stress-mix-table"
import type { StressViewModel } from "./stress-view-model"

const INFO =
  "Your whole plan (income, spending, taxes, loans, purchases) re-run many times, with each account earning what its mix earned in the historical years the trial lives through, after inflation. Simulated trials stitch history's years together in new orders; History replays every complete start year since 1871 (Early Retirement Now's method). Crypto swings twice as hard as stocks around its assumed return."

/** What Setup needs: only the settings, so it works before there are results (or when a filter matches none). */
export type StressSetupModel = Pick<
  StressViewModel,
  "doc" | "update" | "annual" | "sampling" | "setSampling" | "align" | "setAlign" | "canAlignRetirement" | "cape" | "setCape" | "inflation" | "setInflation"
>

/** Setup: how the trials are drawn, what happens to each home if the cash runs out, inflation and each account's mix. */
export function StressTabSetup({ v }: { v: StressSetupModel }) {
  return (
    <div className="space-y-5">
      <FireSectionCard eyebrow="Test setup" info={INFO}>
        <StressControls
          sampling={v.sampling}
          onSampling={v.setSampling}
          align={v.align}
          onAlign={v.setAlign}
          canAlignRetirement={v.canAlignRetirement}
          cape={v.cape}
          onCape={v.setCape}
          inflation={v.inflation}
          onInflation={v.setInflation}
          latestCape={v.annual?.latestCape ?? null}
        >
          <StressHomeFallbacks doc={v.doc} update={v.update} />
        </StressControls>
      </FireSectionCard>
      <FireSectionCard
        eyebrow="Assumptions"
        title="Inflation and account mix"
        info="Inflation is the plan's own (shared with Assumptions). The mix is used only for the stress test. Stocks and bonds earn their historical returns after inflation, cash earns nothing after inflation, and crypto swings twice as hard as stocks around its own assumed return."
      >
        <div className="mb-4">
          <InflationSource doc={v.doc} update={v.update} compact />
        </div>
        <StressMixTable doc={v.doc} update={v.update} />
      </FireSectionCard>
    </div>
  )
}
