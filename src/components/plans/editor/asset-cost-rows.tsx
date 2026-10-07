"use client"

import { usePathname, useRouter } from "next/navigation"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { usePlanMode } from "@/hooks/plans/use-plan-mode"
import type { AssetCostLine } from "@/lib/plans/plan-asset-costs"
import type { PlanDocument } from "@/lib/plans/plan-types"
import { CategoryCell } from "./category-cell"
import { Badge, Cell, Row, RowButton } from "./plan-table"
import { TimingCell } from "./timing-cell"

const MONTHS = 12
const KIND_LABEL = { home: "Home", vehicle: "Vehicle", other: "Asset" } as const

/** Home and vehicle running costs as read-only rows in the Expenses table; the edit button opens Assets & debts. */
export function AssetCostRows({ lines, doc }: { lines: AssetCostLine[]; doc: PlanDocument }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isBasic } = usePlanMode()
  return (
    <>
      {lines.map(({ expense: e, asset, yearly, followsValue }) => (
        <Row key={e.id} muted>
          <Cell>
            <span className="flex items-center px-2">
              {e.name}
              <Badge>{KIND_LABEL[asset.kind]}</Badge>
            </span>
          </Cell>
          <Cell>
            <CategoryCell category={e.category} />
          </Cell>
          <Cell omit={isBasic} />
          <Cell align="right">
            <span className="px-2 tabular-nums">{fmtMoney(yearly / MONTHS)}</span>
          </Cell>
          <Cell align="right">
            <span className="px-2 tabular-nums">{fmtMoney(yearly)}</span>
          </Cell>
          <Cell align="right" omit={isBasic}>
            <span className="px-2 text-xs text-foreground-muted">{followsValue ? "with value" : "infl."}</span>
          </Cell>
          <Cell>
            <TimingCell timing={e.start} doc={doc} />
          </Cell>
          <Cell>
            <TimingCell timing={e.end} doc={doc} />
          </Cell>
          <Cell />
          <Cell align="center">
            <RowButton icon="edit" label={`Edit ${asset.name} on Assets & debts`} onClick={() => router.push(`${pathname}?tab=assets`, { scroll: false })} />
          </Cell>
        </Row>
      ))}
    </>
  )
}
