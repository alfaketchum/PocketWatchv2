"use client"

import { useRef, useEffect, useState } from "react"
import {
  createChart,
  type IChartApi,
  type UTCTimestamp,
  AreaSeries,
  ColorType,
  LineType,
  CrosshairMode,
} from "lightweight-charts"

interface HistoryPoint {
  date: string
  fiat: number
  crypto: number
  total: number
}

interface NetWorthHistoryChartProps {
  data: HistoryPoint[]
  height?: number
}

// Fiat (blue) sits on the bottom, crypto (green) stacks on top to the total.
const FIAT_COLOR = "#8886ff"
const CRYPTO_COLOR = "#4ade80"

function fmt(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 100_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
}

function themeText(): string {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "#4a4a5a" : "#86868B"
}

export function NetWorthHistoryChart({ data, height = 280 }: NetWorthHistoryChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const [hover, setHover] = useState<{ fiat: number; crypto: number } | null>(null)

  useEffect(() => {
    if (!containerRef.current || data.length < 2) return

    const gridColor = document.documentElement.getAttribute("data-theme") === "dark"
      ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.04)"

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: themeText(),
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 10,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: gridColor, style: 0 } },
      crosshair: { mode: CrosshairMode.Magnet, horzLine: { visible: false, labelVisible: false } },
      rightPriceScale: { visible: false },
      leftPriceScale: { visible: false },
      timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true, lockVisibleTimeRangeOnResize: true },
      handleScale: false,
      handleScroll: false,
      width: containerRef.current.clientWidth,
      height,
    })
    chartRef.current = chart

    // Draw the TOTAL area first (crypto color), then FIAT on top — the overlap
    // paints the bottom band as fiat, leaving the crypto band stacked above it.
    const totalSeries = chart.addSeries(AreaSeries, {
      lineColor: CRYPTO_COLOR,
      topColor: "rgba(74,222,128,0.35)",
      bottomColor: "rgba(74,222,128,0.06)",
      lineWidth: 2,
      lineType: LineType.Curved,
      priceScaleId: "overlay",
      lastValueVisible: false,
      priceLineVisible: false,
      priceFormat: { type: "custom", formatter: fmt },
    })
    const fiatSeries = chart.addSeries(AreaSeries, {
      lineColor: FIAT_COLOR,
      topColor: "rgba(136,134,255,0.55)",
      bottomColor: "rgba(136,134,255,0.30)",
      lineWidth: 2,
      lineType: LineType.Curved,
      priceScaleId: "overlay",
      lastValueVisible: false,
      priceLineVisible: false,
      priceFormat: { type: "custom", formatter: fmt },
    })
    totalSeries.priceScale().applyOptions({ scaleMargins: { top: 0.1, bottom: 0.08 } })

    const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const toTime = (d: string) => Math.floor(new Date(d).getTime() / 1000) as UTCTimestamp
    totalSeries.setData(sorted.map((p) => ({ time: toTime(p.date), value: p.total })))
    fiatSeries.setData(sorted.map((p) => ({ time: toTime(p.date), value: p.fiat })))
    chart.timeScale().fitContent()

    chart.subscribeCrosshairMove((param) => {
      const t = param.seriesData.get(totalSeries)
      const f = param.seriesData.get(fiatSeries)
      if (t && "value" in t && f && "value" in f) {
        setHover({ fiat: f.value, crypto: Math.max(0, t.value - f.value) })
      } else {
        setHover(null)
      }
    })

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) chart.applyOptions({ width: Math.max(e.contentRect.width, 1) })
      chart.timeScale().fitContent()
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
    }
  }, [data, height])

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center text-foreground-muted text-sm" style={{ height }}>
        Not enough history for chart
      </div>
    )
  }

  const latest = data[data.length - 1]
  const shown = hover ?? { fiat: latest.fiat, crypto: latest.crypto }

  return (
    <div className="relative" style={{ width: "100%" }}>
      {/* Legend / hover readout */}
      <div className="flex items-center gap-4 mb-1 text-[11px] font-medium">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: FIAT_COLOR }} />
          <span className="text-foreground-muted">Finance</span>
          <span className="tabular-nums text-foreground">{fmt(shown.fiat)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: CRYPTO_COLOR }} />
          <span className="text-foreground-muted">Digital Assets</span>
          <span className="tabular-nums text-foreground">{fmt(shown.crypto)}</span>
        </span>
      </div>
      <div ref={containerRef} style={{ height, width: "100%", position: "relative" }} />
    </div>
  )
}
