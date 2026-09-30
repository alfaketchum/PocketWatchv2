"use client"

import { useMemo } from "react"
import { fiMilestone } from "@/lib/plans/plan-fi-milestone"
import { milestoneSource, milestoneUses, MILESTONE_SOURCE_LABELS } from "@/lib/plans/plan-milestone-uses"
import { generatedMilestones } from "@/lib/plans/plan-milestones"
import { payoffMilestones } from "@/lib/plans/plan-payoff-milestones"
import { milestoneGroup } from "@/lib/plans/plan-chart"
import { resolveTiming, timingContext } from "@/lib/plans/plan-timing"
import type { PlanMilestone } from "@/lib/plans/plan-types"
import { patchItem, planItemAnchor, primaryAge, type PlanEditorProps } from "../plans-helpers"
import { usePlanColors } from "../results/use-plan-colors"
import { Badge, Cell, CellText, PlanTable, Row, RowButton } from "./plan-table"
import { TimingCell } from "./timing-cell"

const COLUMNS = [
  { label: "Milestone" },
  { label: "Source", width: "w-20" },
  { label: "When", width: "w-32" },
  { label: "Used by", width: "w-56" },
  { label: "Year", align: "right" as const, width: "w-20" },
  { label: "Your age", align: "right" as const, width: "w-20" },
  { label: "", width: "w-16" },
]

/** Milestones as a table: yours editable, generated ones (kids, assets) read-only, all in date order. */
export function MilestonesTable({ doc, update, onEditItem, onDelete }: PlanEditorProps & { onDelete: (id: string) => void }) {
  const { milestones: groupColors } = usePlanColors()
  const payoffs = useMemo(() => payoffMilestones(doc), [doc])
  const fi = useMemo(() => fiMilestone(doc), [doc])
  const ctx = timingContext(doc)
  const age0 = primaryAge(doc)
  const patch = (id: string, change: Partial<PlanMilestone>) => update((d) => ({ ...d, milestones: patchItem(d.milestones, id, change) }))
  const rows = [
    ...doc.milestones.map((m) => ({ m, generated: false, unreached: false })),
    ...generatedMilestones(doc).map((m) => ({ m, generated: true, unreached: false })),
    ...payoffs.map((m) => ({ m, generated: true, unreached: false })),
    ...(fi ? [{ m: fi.milestone, generated: true, unreached: !fi.reached }] : []),
  ]
    .map((r) => ({ ...r, index: resolveTiming(r.m.timing, ctx) }))
    .sort((a, b) => (a.index ?? Infinity) - (b.index ?? Infinity))

  return (
    <PlanTable columns={COLUMNS}>
      {rows.map(({ m, generated, unreached, index }) => (
        <Row key={m.id} muted={generated}>
          <Cell>
            <span className="flex items-center">
              <span
                className="material-symbols-rounded ml-2 mr-1 shrink-0"
                style={{ fontSize: 15, color: groupColors[milestoneGroup(m)] }}
              >
                {m.icon ?? (m.kind === "retirement" ? "beach_access" : "flag")}
              </span>
              {generated ? (
                <span className="px-1">{m.name}</span>
              ) : (
                <CellText label="Milestone name" value={m.name} onChange={(name) => patch(m.id, { name })} />
              )}
            </span>
          </Cell>
          <Cell>
            <Badge>{MILESTONE_SOURCE_LABELS[milestoneSource(m)]}</Badge>
          </Cell>
          <Cell>
            {unreached ? (
              <span className="block truncate px-2 text-xs text-foreground-muted">Not reached in this plan</span>
            ) : (
              <TimingCell timing={m.timing} doc={doc} />
            )}
          </Cell>
          <Cell>
            <span className="block truncate px-2 text-xs text-foreground-muted" title={milestoneUses(doc, m.id).join(" · ")}>
              {milestoneUses(doc, m.id).join(" · ") || "—"}
            </span>
          </Cell>
          <Cell align="right">
            <span className="px-2 tabular-nums">{index === null || unreached ? "—" : doc.settings.startYear + index}</span>
          </Cell>
          <Cell align="right">
            <span className="px-2 tabular-nums">{index === null || unreached ? "—" : age0 + index}</span>
          </Cell>
          <Cell align="center">
            {!generated && (
              <span className="flex">
                <RowButton icon="edit" label={`Edit ${m.name} in detailed view`} onClick={() => onEditItem?.(planItemAnchor(m.id))} />
                {m.kind !== "retirement" && (
                  <RowButton
                    icon="delete"
                    label={`Remove ${m.name}`}
                    danger
                    onClick={() => onDelete(m.id)}
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
