"use client"

import { ResponsiveContainer, Sankey, Tooltip, type SankeyNodeOptions } from "recharts"
import { fmtMoney } from "@/components/fire/fire-helpers"
import type { PlanSankey, SankeyGroup } from "@/lib/plans/plan-sankey"
import { usePlanColors } from "../results/use-plan-colors"

const LABEL_ROOM = 230
const MAX_LABEL = 28
const ROW_HEIGHT = 38
const MIN_HEIGHT = 420
const LABEL_GAP = 8

interface NodePayload {
  name: string
  group: SankeyGroup
  column: number
  value: number
}

function tallestColumn(sankey: PlanSankey): number {
  const counts = new Map<number, number>()
  for (const n of sankey.nodes) counts.set(n.column, (counts.get(n.column) ?? 0) + 1)
  return Math.max(1, ...counts.values())
}

interface TooltipItem {
  payload?: { name?: string; value?: number; source?: NodePayload; target?: NodePayload; payload?: TooltipItem["payload"] }
}

function SankeyTooltip({ active, payload }: { active?: boolean; payload?: TooltipItem[] }) {
  const item = payload?.[0]?.payload
  if (!active || !item) return null
  const data = item.payload ?? item
  const title = data.source && data.target ? `${data.source.name} → ${data.target.name}` : data.name
  return (
    <div className="rounded-lg border border-card-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="text-foreground-muted">{title}</p>
      <p className="font-semibold text-foreground tabular-nums">{fmtMoney(data.value ?? 0)}</p>
    </div>
  )
}

/** Money moving through one plan year: sources → cash flow → uses → lines. */
export function PlanSankeyChart({ sankey, isHidden }: { sankey: PlanSankey; isHidden: boolean }) {
  const { cashFlow, hub } = usePlanColors()
  const colorOf = (group: SankeyGroup) => (group === "hub" ? hub : cashFlow[group])
  const height = Math.max(MIN_HEIGHT, tallestColumn(sankey) * ROW_HEIGHT)

  const renderNode: SankeyNodeOptions = ({ x, y, width, height: h, payload }) => {
    const node = payload as unknown as NodePayload
    const rightSide = node.column > 0
    const tx = rightSide ? x + width + LABEL_GAP : x - LABEL_GAP
    const anchor = rightSide ? "start" : "end"
    return (
      <g>
        <rect x={x} y={y} width={width} height={Math.max(1, h)} rx={2} fill={colorOf(node.group)} />
        <text x={tx} y={y + h / 2} textAnchor={anchor} dominantBaseline="central" fontSize={11}>
            <tspan fill="var(--foreground)" fontWeight={node.group === "hub" ? 600 : 500}>
              {node.name.length > MAX_LABEL ? `${node.name.slice(0, MAX_LABEL - 1)}…` : node.name}
            </tspan>
            <tspan
              fill="var(--foreground-muted)"
              dx={6}
              style={isHidden ? { filter: "blur(4px)" } : undefined}
            >
              {fmtMoney(node.value)}
            </tspan>
        </text>
      </g>
    )
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <Sankey
          data={sankey}
          node={renderNode}
          link={({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, payload }) => {
            const source = payload.source as unknown as NodePayload
            const target = payload.target as unknown as NodePayload
            const color = colorOf(source.group === "hub" ? target.group : source.group)
            return (
              <path
                d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
                fill="none"
                stroke={color}
                strokeOpacity={0.3}
                strokeWidth={Math.max(1, linkWidth)}
                className="transition-[stroke-opacity] hover:[stroke-opacity:0.55]"
              />
            )
          }}
          nodeWidth={10}
          nodePadding={18}
          align="left"
          sort={false}
          iterations={0}
          margin={{ top: 12, right: LABEL_ROOM, bottom: 12, left: LABEL_ROOM }}
        >
          <Tooltip content={<SankeyTooltip />} />
        </Sankey>
      </ResponsiveContainer>
    </div>
  )
}
