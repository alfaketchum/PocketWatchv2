"use client"

import { useCallback, useEffect, useRef, useState, type RefObject } from "react"

const MIN_SPAN_MS = 3 * 86_400_000
const WHEEL_ZOOM_RATE = 0.002

/**
 * Time-axis zoom for a custom SVG chart.
 * - Zoom: trackpad pinch or Ctrl/⌘ + wheel, centred on the pointer. A plain
 *   wheel is left alone so the page still scrolls.
 * - Pan: drag while zoomed in.
 * - Reset: double-click (or setView(null)). New data resets the view.
 */
export function useChartZoom(
  containerRef: RefObject<HTMLDivElement | null>,
  points: Array<{ t: number }>,
  padLeft: number,
  chartW: number,
) {
  const [view, setView] = useState<[number, number] | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ x: number; view: [number, number] } | null>(null)

  const fullMin = points.length ? points[0].t : 0
  const fullMax = points.length ? points[points.length - 1].t : 1
  const latest = useRef({ view, fullMin, fullMax, padLeft, chartW })
  latest.current = { view, fullMin, fullMax, padLeft, chartW }

  useEffect(() => setView(null), [points])

  /** Clamp a window into the data range; null when it covers everything. */
  const clamp = useCallback((t0: number, t1: number): [number, number] | null => {
    const { fullMin: lo, fullMax: hi } = latest.current
    const span = Math.min(Math.max(t1 - t0, MIN_SPAN_MS), hi - lo)
    if (span >= hi - lo) return null
    const start = Math.min(Math.max(t0, lo), hi - span)
    return [start, start + span]
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const { view: v, fullMin: lo, fullMax: hi, padLeft: pl, chartW: w } = latest.current
      if (w <= 0) return
      const [t0, t1] = v ?? [lo, hi]
      const frac = Math.min(Math.max((e.clientX - el.getBoundingClientRect().left - pl) / w, 0), 1)
      const cursorT = t0 + frac * (t1 - t0)
      const scale = Math.exp(e.deltaY * WHEEL_ZOOM_RATE)
      setView(clamp(cursorT - (cursorT - t0) * scale, cursorT + (t1 - cursorT) * scale))
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [containerRef, clamp])

  const zoomHandlers = {
    onMouseDown: (e: React.MouseEvent) => {
      if (!latest.current.view) return
      dragRef.current = { x: e.clientX, view: latest.current.view }
      setDragging(true)
    },
    onMouseMove: (e: React.MouseEvent) => {
      const drag = dragRef.current
      if (!drag || latest.current.chartW <= 0) return
      const [t0, t1] = drag.view
      const shift = ((e.clientX - drag.x) / latest.current.chartW) * (t1 - t0)
      setView(clamp(t0 - shift, t1 - shift))
    },
    onMouseUp: () => { dragRef.current = null; setDragging(false) },
    onDoubleClick: () => setView(null),
  }

  return { view, setView, dragging, zoomHandlers }
}
