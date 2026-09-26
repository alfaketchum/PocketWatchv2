"use client"

import { useRef, useState, useEffect, useMemo, useCallback } from "react"
import { useChartZoom } from "@/hooks/use-chart-zoom"
import { ResetZoomButton } from "@/components/ui/reset-zoom-button"

export interface StackLayer {
  key: string
  label: string
  color: string
}

export interface StackedPoint {
  /** Epoch ms */
  t: number
  values: Record<string, number>
  /** Optional per-layer breakdown rows shown under that layer in the tooltip */
  details?: Record<string, Array<{ label: string; value: number }>>
  /** Optional rows under the layers in the tooltip (e.g. debt, net worth) */
  footer?: Array<{ label: string; value: number }>
}

function fmtCompact(v: number): string {
  const a = Math.abs(v)
  if (a >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (a >= 10_000) return `$${(v / 1_000).toFixed(0)}K`
  if (a >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
  return `$${v.toFixed(0)}`
}
function fmtFull(v: number): string {
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
}
/** Axis date: "Sep 26" (month + year) for long spans, "Sep 12" (month + day) under ~4 months */
function fmtDate(ts: number, spanMs: number): string {
  const opts: Intl.DateTimeFormatOptions = spanMs < 120 * 86_400_000
    ? { month: "short", day: "numeric" }
    : { month: "short", year: "2-digit" }
  return new Date(ts).toLocaleDateString("en-US", opts)
}
function fmtTipDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
}

// Monotone-cubic smooth path (same feel as the finance chart).
function smoothPath(xs: number[], ys: number[]): string {
  const n = xs.length
  if (n === 0) return ""
  if (n === 1) return `M${xs[0].toFixed(2)},${ys[0].toFixed(2)}`
  const slopes = new Array(n).fill(0)
  const d: number[] = []
  for (let i = 0; i < n - 1; i++) { const dx = xs[i + 1] - xs[i]; d.push(dx === 0 ? 0 : (ys[i + 1] - ys[i]) / dx) }
  slopes[0] = d[0]; slopes[n - 1] = d[n - 2]
  for (let i = 1; i < n - 1; i++) slopes[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2
  let path = `M${xs[0].toFixed(2)},${ys[0].toFixed(2)}`
  for (let i = 0; i < n - 1; i++) {
    const dx = (xs[i + 1] - xs[i]) / 3
    path += ` C${(xs[i] + dx).toFixed(2)},${(ys[i] + slopes[i] * dx).toFixed(2)} ${(xs[i + 1] - dx).toFixed(2)},${(ys[i + 1] - slopes[i + 1] * dx).toFixed(2)} ${xs[i + 1].toFixed(2)},${ys[i + 1].toFixed(2)}`
  }
  return path
}

interface Props {
  data: StackedPoint[]
  /** Bottom → top stack order */
  layers: StackLayer[]
  height?: number
  onLayerClick?: (key: string) => void
  /** Privacy mode: blur dollar values (axis + tooltip) */
  isHidden?: boolean
}

/** Stacked-area chart: layers stacked to the total, with a hover tooltip. */
export function StackedAreaChart({ data, layers, height = 280, onLayerClick, isHidden }: Props) {
  const blur = isHidden ? { filter: "blur(6px)" } : undefined
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => { for (const e of entries) setWidth(e.contentRect.width) })
    obs.observe(el); setWidth(el.clientWidth)
    return () => obs.disconnect()
  }, [])

  const allPoints = useMemo(() => data.map((d) => ({ t: d.t, d: d.values, details: d.details, footer: d.footer })), [data])

  const PAD = { top: 12, right: 16, bottom: 32, left: 56 }
  const chartW = Math.max(width - PAD.left - PAD.right, 0)
  const chartH = Math.max(height - PAD.top - PAD.bottom, 0)

  // Zoom window [t0, t1] (null = everything); new data resets it
  const { view, setView, dragging, zoomHandlers } = useChartZoom(containerRef, allPoints, PAD.left, chartW)
  const points = useMemo(() => {
    if (!view) return allPoints
    const first = Math.max(0, allPoints.findIndex((p) => p.t >= view[0]) - 1)
    const lastInside = allPoints.findLastIndex((p) => p.t <= view[1])
    return allPoints.slice(first, Math.min(allPoints.length, lastInside + 2))
  }, [allPoints, view])

  const tMin = view ? view[0] : points.length ? points[0].t : 0
  const tMax = view ? view[1] : points.length ? points[points.length - 1].t : 1
  const tRange = tMax - tMin || 1
  const totals = points.map((p) => layers.reduce((s, l) => s + (p.d[l.key] || 0), 0))
  const yMaxRaw = totals.length ? Math.max(...totals) : 1
  const yMax = yMaxRaw * 1.08 || 1

  const sx = useCallback((t: number) => PAD.left + ((t - tMin) / tRange) * chartW, [tMin, tRange, chartW])
  const sy = useCallback((v: number) => PAD.top + (1 - v / yMax) * chartH, [yMax, chartH, PAD.top])

  const handleMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left
    if (dragging || mx < PAD.left || mx > PAD.left + chartW || points.length === 0) { setHoverIdx(null); return }
    const targetT = tMin + ((mx - PAD.left) / chartW) * tRange
    let lo = 0, hi = points.length - 1
    while (lo < hi) { const mid = (lo + hi) >> 1; if (points[mid].t < targetT) lo = mid + 1; else hi = mid }
    setHoverIdx(lo)
  }, [points, tMin, tRange, chartW, dragging])

  if (points.length < 2 || chartW <= 0) {
    return <div ref={containerRef} style={{ width: "100%", height }} className="flex items-center justify-center"><span className="text-xs text-foreground-muted">Not enough data</span></div>
  }

  const xs = points.map((p) => sx(p.t))
  // Cumulative band tops (bottom→top stack order).
  let cumulative = new Array(points.length).fill(0)
  const bands = layers.map((layer) => {
    const bottom = [...cumulative]
    cumulative = cumulative.map((c, i) => c + (points[i].d[layer.key] || 0))
    const topYs = cumulative.map((v) => sy(v))
    const botYs = bottom.map((v) => sy(v))
    const topPath = smoothPath(xs, topYs)
    const botPathRev = smoothPath([...xs].reverse(), [...botYs].reverse())
    const area = `${topPath} L${xs[xs.length - 1].toFixed(2)},${botYs[botYs.length - 1].toFixed(2)} ${botPathRev.replace(/^M/, "L")} Z`
    return { layer, area, topPath, topYs }
  })

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((p) => ({ y: PAD.top + p * chartH, val: yMax * (1 - p) }))
  const xTickCount = Math.min(6, Math.max(3, Math.floor(chartW / 110)))
  const xTicks = Array.from({ length: xTickCount }, (_, i) => {
    const t = tMin + (tRange * i) / (xTickCount - 1)
    return { x: sx(t), label: fmtDate(t, tRange) }
  })

  const hp = hoverIdx !== null ? points[hoverIdx] : null
  const hoverTotal = hoverIdx !== null ? totals[hoverIdx] : 0
  const tipFlip = hp ? sx(hp.t) > PAD.left + chartW * 0.6 : false

  return (
    <div ref={containerRef} style={{ width: "100%", position: "relative" }}>
      {view && <ResetZoomButton onClick={() => setView(null)} />}
      <svg
        width={width} height={height}
        onMouseDown={zoomHandlers.onMouseDown}
        onMouseMove={(e) => { zoomHandlers.onMouseMove(e); handleMove(e) }}
        onMouseUp={zoomHandlers.onMouseUp}
        onMouseLeave={() => { zoomHandlers.onMouseUp(); setHoverIdx(null) }}
        onDoubleClick={zoomHandlers.onDoubleClick}
        style={{ display: "block", cursor: dragging ? "grabbing" : view ? "grab" : "default", userSelect: "none" }}
      >
        {yTicks.map((tk, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={tk.y} x2={PAD.left + chartW} y2={tk.y} stroke="var(--card-border)" strokeWidth={1} opacity={0.5} />
            <text x={PAD.left - 8} y={tk.y + 3} textAnchor="end" fontSize={10} fontFamily="'IBM Plex Mono', monospace" fill="var(--foreground-muted)" opacity={0.7} style={blur}>{fmtCompact(tk.val)}</text>
          </g>
        ))}
        {xTicks.map((tk, i) => (
          <text key={i} x={tk.x} y={height - 10} textAnchor="middle" fontSize={10} fontFamily="'IBM Plex Mono', monospace" fill="var(--foreground-muted)" opacity={0.7}>{tk.label}</text>
        ))}
        {bands.map((b) => (
          <g key={b.layer.key} onClick={() => onLayerClick?.(b.layer.key)} style={{ cursor: onLayerClick ? "pointer" : "default" }}>
            <path d={b.area} fill={b.layer.color} fillOpacity={0.55} />
            <path d={b.topPath} fill="none" stroke={b.layer.color} strokeWidth={1.25} />
          </g>
        ))}
        {hp && (
          <line x1={sx(hp.t)} y1={PAD.top} x2={sx(hp.t)} y2={PAD.top + chartH} stroke="var(--foreground-muted)" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
        )}
      </svg>

      {hp && (
        <div className="absolute pointer-events-none rounded-lg border border-card-border bg-card shadow-lg px-3 py-2 text-[11px] z-10"
          style={{ left: tipFlip ? sx(hp.t) - 172 : sx(hp.t) + 12, top: PAD.top + 4, width: 160 }}>
          <div className="text-foreground-muted mb-1">{fmtTipDate(hp.t)}</div>
          <div className="font-semibold text-foreground tabular-nums mb-1.5" style={blur}>{fmtFull(hoverTotal)}</div>
          {[...layers].reverse().map((l) => (
            (hp.d[l.key] || 0) > 0.5 && (
              <div key={l.key}>
                <div className="flex items-center gap-1.5 leading-tight">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: l.color }} />
                  <span className="text-foreground-muted flex-1 truncate" title={l.label}>{l.label}</span>
                  <span className="tabular-nums text-foreground" style={blur}>{fmtCompact(hp.d[l.key])}</span>
                </div>
                {hp.details?.[l.key]?.map((row) => (
                  <div key={row.label} className="flex items-center gap-1.5 leading-tight pl-3.5 text-[10px]">
                    <span className="text-foreground-muted flex-1 truncate">{row.label}</span>
                    <span className="tabular-nums text-foreground-muted" style={blur}>{fmtCompact(row.value)}</span>
                  </div>
                ))}
              </div>
            )
          ))}
          {hp.footer && hp.footer.length > 0 && (
            <div className="mt-1.5 pt-1.5 border-t border-card-border">
              {hp.footer.map((row) => (
                <div key={row.label} className="flex items-center gap-1.5 leading-tight">
                  <span className="text-foreground-muted flex-1">{row.label}</span>
                  <span className={row.value < 0 ? "tabular-nums text-error" : "tabular-nums text-foreground"} style={blur}>{row.value < 0 ? "−" : ""}{fmtCompact(Math.abs(row.value))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
