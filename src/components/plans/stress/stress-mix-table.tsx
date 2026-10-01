"use client"

import { fmtMoney } from "@/components/fire/fire-helpers"
import { defaultMix, MIX_KEYS, mixFor } from "@/lib/plans/stress/stress-mix"
import type { AccountMix, PlanAccount } from "@/lib/plans/plan-types"
import { patchItem, type PlanEditorProps } from "../plans-helpers"
import { Badge, Cell, CellNumber, PlanTable, Row, RowButton } from "../editor/plan-table"

const PERCENT = 100
const MIX_LABELS: Record<keyof AccountMix, string> = { stocks: "Stocks", bonds: "Bonds", cash: "Cash", crypto: "Crypto" }

const COLUMNS = [
  { label: "Account" },
  { label: "Balance", align: "right" as const, width: "w-32" },
  ...MIX_KEYS.map((k) => ({ label: MIX_LABELS[k], align: "right" as const, width: "w-24" })),
  { label: "Total", align: "right" as const, width: "w-20" },
  { label: "", width: "w-10" },
]

const pct = (share: number) => `${Math.round(share * PERCENT)}%`

/** The plan's holdings weighted by balance: "62% stocks · 15% bonds · 8% cash · 15% crypto". */
function blended(accounts: PlanAccount[]): string {
  const total = accounts.reduce((s, a) => s + a.balance, 0)
  if (total <= 0) return "—"
  return MIX_KEYS.map((k) => ({ k, share: accounts.reduce((s, a) => s + a.balance * mixFor(a)[k], 0) / total }))
    .filter((x) => x.share >= 0.005)
    .map((x) => `${pct(x.share)} ${MIX_LABELS[x.k].toLowerCase()}`)
    .join(" · ")
}

/**
 * What each account holds, for replaying history: stocks and bonds earn their historical returns, cash
 * earns nothing after inflation, crypto swings twice as hard as stocks. Shares are scaled to 100% on save.
 */
export function StressMixTable({ doc, update }: Pick<PlanEditorProps, "doc" | "update">) {
  const setMix = (id: string, mix: AccountMix | undefined) => update((d) => ({ ...d, accounts: patchItem(d.accounts, id, { mix }) }))
  return (
    <div className="space-y-2">
      <p className="text-xs text-foreground-muted">
        All accounts together: <span className="font-medium text-foreground">{blended(doc.accounts)}</span>
      </p>
      <PlanTable columns={COLUMNS} minWidth="min-w-[820px]">
        {doc.accounts.map((a) => {
          const mix = a.mix ?? defaultMix(a)
          const total = MIX_KEYS.reduce((s, k) => s + mix[k], 0)
          return (
            <Row key={a.id}>
              <Cell>
                <span className="flex items-center px-2">
                  {a.name}
                  {!a.mix && <Badge>Default</Badge>}
                </span>
              </Cell>
              <Cell align="right">
                <span className="px-2 tabular-nums">{fmtMoney(a.balance)}</span>
              </Cell>
              {MIX_KEYS.map((k) => (
                <Cell key={k} align="right">
                  <CellNumber label={`${a.name} ${MIX_LABELS[k]}`} suffix="%" scale={PERCENT} min={0} max={1} value={mix[k]} onChange={(v) => setMix(a.id, { ...mix, [k]: v })} />
                </Cell>
              ))}
              <Cell align="right">
                <span className={`px-2 tabular-nums ${Math.abs(total - 1) > 0.005 ? "text-warning" : "text-foreground-muted"}`} title={Math.abs(total - 1) > 0.005 ? "Scaled to 100% when replaying history" : undefined}>
                  {pct(total)}
                </span>
              </Cell>
              <Cell align="center">
                {a.mix && <RowButton icon="restart_alt" label={`Reset ${a.name} to the default mix`} onClick={() => setMix(a.id, undefined)} />}
              </Cell>
            </Row>
          )
        })}
      </PlanTable>
    </div>
  )
}
