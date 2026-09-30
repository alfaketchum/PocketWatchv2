"use client"

import { generatedMilestones } from "@/lib/plans/plan-milestones"
import { resolveTiming, timingContext } from "@/lib/plans/plan-timing"
import type { PlanMilestone } from "@/lib/plans/plan-types"
import { patchItem, planItemAnchor, primaryAge, type PlanEditorProps } from "../plans-helpers"
import { Badge, Cell, CellText, PlanTable, Row, RowButton } from "./plan-table"
import { TimingCell } from "./timing-cell"

const COLUMNS = [
  { label: "Milestone" },
  { label: "When", width: "w-40" },
  { label: "Year", align: "right" as const, width: "w-20" },
  { label: "Your age", align: "right" as const, width: "w-20" },
  { label: "", width: "w-16" },
]

/** Milestones as a table: yours editable, generated ones (kids, assets) read-only, all in date order. */
export function MilestonesTable({ doc, update, onEditItem }: PlanEditorProps) {
  const ctx = timingContext(doc)
  const age0 = primaryAge(doc)
  const patch = (id: string, change: Partial<PlanMilestone>) => update((d) => ({ ...d, milestones: patchItem(d.milestones, id, change) }))
  const rows = [
    ...doc.milestones.map((m) => ({ m, generated: false })),
    ...generatedMilestones(doc).map((m) => ({ m, generated: true })),
  ]
    .map((r) => ({ ...r, index: resolveTiming(r.m.timing, ctx) }))
    .sort((a, b) => (a.index ?? Infinity) - (b.index ?? Infinity))

  return (
    <PlanTable columns={COLUMNS}>
      {rows.map(({ m, generated, index }) => (
        <Row key={m.id} muted={generated}>
          <Cell>
            {generated ? (
              <span className="flex items-center px-2">
                <span className="material-symbols-rounded mr-1.5 text-primary" style={{ fontSize: 15 }}>
                  {m.icon ?? "flag"}
                </span>
                {m.name}
                <Badge>Auto</Badge>
              </span>
            ) : (
              <CellText label="Milestone name" value={m.name} onChange={(name) => patch(m.id, { name })} />
            )}
          </Cell>
          <Cell>
            <TimingCell timing={m.timing} doc={doc} />
          </Cell>
          <Cell align="right">
            <span className="px-2 tabular-nums">{index === null ? "—" : doc.settings.startYear + index}</span>
          </Cell>
          <Cell align="right">
            <span className="px-2 tabular-nums">{index === null ? "—" : age0 + index}</span>
          </Cell>
          <Cell align="center">
            {!generated && (
              <span className="flex">
                <RowButton icon="edit" label={`Edit ${m.name} in list view`} onClick={() => onEditItem?.(planItemAnchor(m.id))} />
                {m.kind !== "retirement" && (
                  <RowButton
                    icon="delete"
                    label={`Remove ${m.name}`}
                    danger
                    onClick={() => update((d) => ({ ...d, milestones: d.milestones.filter((x) => x.id !== m.id) }))}
                  />
                )}
              </span>
            )}
          </Cell>
        </Row>
      ))}
    </PlanTable>
  )
}
