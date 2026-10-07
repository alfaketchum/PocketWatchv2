"use client"

import { useEffect, useRef, useState } from "react"
import { fmtSuccess } from "@/components/fire/fire-helpers"
import { isBroke, type CohortResult } from "@/lib/plans/stress/stress-test"

/** The whole run plays over at least this long, however fast the trials finish (the reveal is part of the point). */
const PLAYBACK_MS = 2600
/** How long one trial's line takes to sweep across the chart (shorter keeps fewer lines in flight at once). */
const SWEEP_MS = 450
/** How often the counter updates while lines land: often enough to tick, rarely enough not to re-render each frame. */
const REPORT_MS = 120
/** A beat after the last line lands, before the results take over. */
const HOLD_MS = 350
/** Settled lines: faint when fully funded, amber when accounts were depleted, red when assets were exhausted. */
const LASTED_ALPHA = 0.07
const FAILED_ALPHA = 0.22
/** The y-axis tops out a bit above the 90th percentile of the first trials, so booms don't flatten the rest. */
const Y_PERCENTILE = 0.9
const Y_HEADROOM = 1.2

interface Colors {
  lasted: string
  failed: string
  short: string
  head: string
  plan: string
}

function readColors(el: HTMLElement): Colors {
  const css = getComputedStyle(el)
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  return { lasted: v("--foreground-muted", "#888"), failed: v("--error", "#e5484d"), short: v("--warning", "#b5791a"), head: v("--primary", "#5b5bd6"), plan: v("--foreground", "#111") }
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

/** Scale from the plan line and whatever trials have arrived (fixed once set, so settled lines stay put). */
function yTopFor(trials: CohortResult[], plan: number[]): number {
  const values = trials.flatMap((c) => c.netWorth).filter((v) => v > 0).sort((a, b) => a - b)
  const high = values[Math.floor(values.length * Y_PERCENTILE)] ?? 0
  return Math.max(high, ...plan, 1) * Y_HEADROOM
}

interface Props {
  /** Trials finished so far (grows while the run is in progress, or all of them for a replay). */
  trials: CohortResult[]
  /** How many the run will have. */
  total: number
  /** The plan with steady returns, net worth in today's dollars, for the dashed reference line. */
  plan: number[]
  /** Whether the run itself is done (every trial is in `trials`). */
  complete: boolean
  /** Called once the last line has landed. */
  onFinished: () => void
  unit: string
  height?: number
  /** The run is over and its numbers show elsewhere: keep the finished chart, drop the counter, add a legend. */
  done?: boolean
}

/**
 * The run as it happens: each trial's net worth sweeps across by age as it finishes (faint if fully funded, red
 * if assets were exhausted, amber if only the accounts were depleted) while the count and the share that kept their net worth tick up. Paced so even an instant run plays out.
 */
export function StressRunAnimation({ trials, total, plan, complete, onFinished, unit, height = 220, done = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const trialsRef = useRef(trials)
  const completeRef = useRef(complete)
  const totalRef = useRef(total)
  const finishedRef = useRef(onFinished)
  // No animation (reduced motion, or the card is hidden and has no size): finish as soon as the run does.
  const staticRef = useRef(false)
  const [shown, setShown] = useState({ count: 0, survived: 0 })
  trialsRef.current = trials
  completeRef.current = complete
  totalRef.current = total
  finishedRef.current = onFinished

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    const { width } = canvas.getBoundingClientRect()
    // Nowhere to draw (a hidden card): finish as soon as the run does. Without motion: every line lands at once.
    staticRef.current = width < 1
    if (staticRef.current) {
      if (completeRef.current) finishedRef.current()
      return
    }
    const instant = reducedMotion()
    const playback = instant ? 0 : PLAYBACK_MS
    const sweep = instant ? 1 : SWEEP_MS
    const hold = instant ? 0 : HOLD_MS
    const colors = readColors(canvas)
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx.scale(dpr, dpr)
    // Lines that have landed are painted once onto their own layer.
    const settled = document.createElement("canvas")
    settled.width = canvas.width
    settled.height = canvas.height
    const settledCtx = settled.getContext("2d")!
    settledCtx.scale(dpr, dpr)
    for (const c of [ctx, settledCtx]) {
      c.beginPath()
      c.rect(0, 0, width, height)
      c.clip()
    }

    const pad = { top: 8, bottom: 8, left: 4, right: 4 }
    let yTop = 0
    const years = Math.max(1, plan.length - 1)
    const x = (i: number) => pad.left + (i / years) * (width - pad.left - pad.right)
    // Not capped at the top: lines run off the plot (clipped) rather than flattening along its edge.
    const y = (v: number) => height - pad.bottom - (Math.max(0, v) / yTop) * (height - pad.top - pad.bottom)
    // Adds a line to the current path (callers stroke many at once: one stroke per colour, not per line).
    const addLine = (c: CanvasRenderingContext2D, values: number[], upTo: number) => {
      const whole = Math.floor(upTo)
      for (let i = 0; i <= Math.min(whole, values.length - 1); i++) (i === 0 ? c.moveTo : c.lineTo).call(c, x(i), y(values[i]))
      if (whole < values.length - 1) {
        const f = upTo - whole
        c.lineTo(x(whole + f), y(values[whole] + (values[whole + 1] - values[whole]) * f))
      }
    }
    const trace = (c: CanvasRenderingContext2D, values: number[], upTo: number) => {
      c.beginPath()
      addLine(c, values, upTo)
      c.stroke()
    }

    const start = performance.now()
    let spawned = 0
    let landed = 0
    let survived = 0
    let lastReport = 0
    let doneAt: number | null = null
    let frame = 0
    /** In flight: the trial, when it started, and how it ended (worked out once, not every frame). */
    const active: { c: CohortResult; born: number; status: "lasted" | "short" | "failed" }[] = []
    const statusOf = (c: CohortResult) => (isBroke(c) ? "failed" : c.depletedAge !== null ? "short" : "lasted") as "lasted" | "short" | "failed"
    const landedStyle: Record<"lasted" | "short" | "failed", { color: string; alpha: number }> = {
      lasted: { color: colors.lasted, alpha: LASTED_ALPHA },
      short: { color: colors.short, alpha: FAILED_ALPHA },
      failed: { color: colors.failed, alpha: FAILED_ALPHA },
    }

    const tick = (now: number) => {
      const arrived = trialsRef.current
      if (yTop === 0 && arrived.length > 0) yTop = yTopFor(arrived, plan)
      const all = Math.max(totalRef.current, arrived.length, 1)
      // Spawn on schedule, but never ahead of the trials that have actually finished.
      const due = playback === 0 ? arrived.length : Math.min(arrived.length, Math.floor(((now - start) / playback) * all))
      for (; spawned < due; spawned++) active.push({ c: arrived[spawned], born: now, status: statusOf(arrived[spawned]) })

      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(settled, 0, 0, width, height)
      ctx.lineWidth = 1
      // Lines that finished this frame land on the settled layer, one stroke per colour.
      const landing = { lasted: [] as CohortResult[], short: [] as CohortResult[], failed: [] as CohortResult[] }
      // Lines still sweeping: one path per colour for the lines, one for their heads.
      const flying = { head: [] as [CohortResult, number][], failed: [] as [CohortResult, number][] }
      for (let k = active.length - 1; k >= 0; k--) {
        const { c, born, status } = active[k]
        const t = instant ? 1 : Math.min(1, (now - born) / sweep)
        if (t >= 1) {
          landing[status].push(c)
          active.splice(k, 1)
          landed++
          if (status !== "failed") survived++
          continue
        }
        flying[status === "failed" ? "failed" : "head"].push([c, (1 - Math.pow(1 - t, 3)) * years])
      }
      settledCtx.lineWidth = 1
      for (const status of ["lasted", "short", "failed"] as const) {
        if (landing[status].length === 0) continue
        settledCtx.strokeStyle = landedStyle[status].color
        settledCtx.globalAlpha = landedStyle[status].alpha
        settledCtx.beginPath()
        for (const c of landing[status]) addLine(settledCtx, c.netWorth, years)
        settledCtx.stroke()
      }
      for (const kind of ["head", "failed"] as const) {
        const lines = flying[kind]
        if (lines.length === 0) continue
        const color = kind === "failed" ? colors.failed : colors.head
        ctx.strokeStyle = color
        ctx.fillStyle = color
        ctx.globalAlpha = 0.5
        ctx.beginPath()
        for (const [c, upTo] of lines) addLine(ctx, c.netWorth, upTo)
        ctx.stroke()
        ctx.globalAlpha = 1
        ctx.beginPath()
        for (const [c, upTo] of lines) {
          const i = Math.min(Math.floor(upTo), c.netWorth.length - 1)
          ctx.moveTo(x(upTo) + 1.8, y(c.netWorth[i] ?? 0))
          ctx.arc(x(upTo), y(c.netWorth[i] ?? 0), 1.8, 0, Math.PI * 2)
        }
        ctx.fill()
      }
      if (yTop > 0) {
        ctx.globalAlpha = 0.7
        ctx.setLineDash([5, 4])
        ctx.strokeStyle = colors.plan
        ctx.lineWidth = 1.5
        trace(ctx, plan, years)
        ctx.setLineDash([])
      }
      ctx.globalAlpha = 1

      if (now - lastReport > REPORT_MS) {
        lastReport = now
        setShown({ count: landed, survived })
      }
      const allLanded = completeRef.current && landed >= arrived.length && active.length === 0 && arrived.length > 0
      if (allLanded && doneAt === null) {
        doneAt = now
        setShown({ count: landed, survived })
      }
      if (doneAt !== null && now - doneAt >= hold) {
        finishedRef.current()
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [plan, height])

  useEffect(() => {
    if (complete && staticRef.current) finishedRef.current()
  }, [complete])

  const counts = shown
  const rate = counts.count > 0 ? counts.survived / counts.count : null
  const all = Math.max(total, trials.length)
  return (
    <div className="relative" aria-live="polite">
      <canvas ref={canvasRef} className="block w-full" style={{ height }} aria-hidden="true" />
      {done ? (
        <Legend />
      ) : (
        <>
          <div className="pointer-events-none absolute left-0 top-0 flex flex-col gap-0.5 rounded-lg bg-card/80 px-2.5 py-1.5 backdrop-blur-sm">
            <p className="font-data text-2xl font-semibold tabular-nums text-foreground">{rate === null ? "—" : fmtSuccess(rate)}</p>
            <p className="text-[11px] tabular-nums text-foreground-muted">
              solvent · {counts.count.toLocaleString()}
              {all > 0 ? ` of ${all.toLocaleString()}` : ""} {unit}
            </p>
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-card-border/60">
            <div className="h-full rounded-full bg-primary transition-[width] duration-100" style={{ width: `${all > 0 ? (counts.count / all) * 100 : 0}%` }} />
          </div>
        </>
      )}
    </div>
  )
}

/** Under the finished chart: what each kind of line means. */
function Legend() {
  const swatch = (color: string, label: string, dashed = false) => (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-4" style={{ borderTop: `2px ${dashed ? "dashed" : "solid"} ${color}` }} aria-hidden="true" />
      {label}
    </span>
  )
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-foreground-muted">
      {swatch("var(--foreground-muted)", "Fully funded")}
      {swatch("var(--warning)", "Accounts depleted")}
      {swatch("var(--error)", "Assets exhausted")}
      {swatch("var(--foreground)", "Your plan (steady returns)", true)}
      <span>Net worth by age, today&apos;s dollars</span>
    </div>
  )
}
