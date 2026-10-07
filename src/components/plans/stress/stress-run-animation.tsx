"use client"

import { useEffect, useRef, useState } from "react"
import { fmtCompact, fmtSuccess } from "@/components/fire/fire-helpers"
import { isBroke, type CohortResult } from "@/lib/plans/stress/stress-test"

/** The whole run plays over at least this long, however fast the trials finish (the reveal is part of the point). */
const PLAYBACK_MS = 2600
/** How long one trial's line takes to sweep across the chart (shorter keeps fewer lines in flight at once). */
const SWEEP_MS = 450
/** How often the counter updates while lines land: often enough to tick, rarely enough not to re-render each frame. */
const REPORT_MS = 120
/** A beat after the last line lands, before the results take over. */
const HOLD_MS = 350
/** Settled lines: faint green when fully funded, amber when accounts were depleted, red when assets were exhausted. */
const LASTED_ALPHA = 0.1
const FAILED_ALPHA = 0.22
/** The y-axis tops out a bit above the 90th percentile of the first trials, so booms don't flatten the rest. */
const Y_PERCENTILE = 0.9
const Y_HEADROOM = 1.2

/** Room on the left for the y-axis's dollar labels, and the plot's top and bottom inset. */
const AXIS_LEFT = 44
const PAD_Y = 8
const PAD_RIGHT = 4

/** Two or three round dollar gridlines under the top of the scale: steps of 1, 2 or 5 × a power of ten. */
function yTicks(top: number): number[] {
  const raw = top / 3
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = ([1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow)
  const ticks: number[] = []
  for (let v = 0; v < top * 0.95; v += step) ticks.push(v)
  return ticks
}

type Status = "lasted" | "short" | "failed"
const statusOf = (c: CohortResult): Status => (isBroke(c) ? "failed" : c.depletedAge !== null ? "short" : "lasted")

/**
 * Each outcome's share as whole percents that always add up to 100 (largest remainder: floor them all, then hand the
 * leftover points to the biggest fractions). An outcome that happened but rounds to zero reads "<1%", and one that
 * rounds to 100 beside it reads ">99%".
 */
function outcomeShares(n: Record<Status, number>): Record<Status, string> {
  const total = n.lasted + n.short + n.failed
  const keys: Status[] = ["lasted", "short", "failed"]
  if (total === 0) return { lasted: "—", short: "—", failed: "—" }
  const exact = keys.map((k) => (n[k] / total) * 100)
  const pct = exact.map(Math.floor)
  const order = keys.map((_, i) => i).sort((a, b) => exact[b] - pct[b] - (exact[a] - pct[a]))
  for (let left = 100 - pct.reduce((s, v) => s + v, 0), j = 0; left > 0; left--, j++) pct[order[j]]++
  const label = (k: Status, p: number) => (p === 0 && n[k] > 0 ? "<1%" : p === 100 && n[k] < total ? ">99%" : `${p}%`)
  return Object.fromEntries(keys.map((k, i) => [k, label(k, pct[i])])) as Record<Status, string>
}

interface Colors {
  lasted: string
  grid: string
  failed: string
  short: string
  head: string
  plan: string
}

function readColors(el: HTMLElement): Colors {
  const css = getComputedStyle(el)
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  return { lasted: v("--success", "#1f9d57"), grid: v("--card-border", "#e7e7ef"), failed: v("--error", "#e5484d"), short: v("--warning", "#b5791a"), head: v("--primary", "#5b5bd6"), plan: v("--foreground", "#111") }
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
  /** The plan's first calendar year, for the year axis (none without it). */
  startYear?: number
  /** The run is over and its numbers show elsewhere: keep the finished chart, drop the counter, add a legend. */
  done?: boolean
}

/**
 * The run as it happens: each trial's net worth sweeps across by age as it finishes (faint green if fully funded, red
 * if assets were exhausted, amber if only the portfolio was depleted) while the count and the share that kept their net worth tick up. Paced so even an instant run plays out.
 */
export function StressRunAnimation({ trials, total, plan, complete, onFinished, unit, height = 220, startYear, done = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const trialsRef = useRef(trials)
  const completeRef = useRef(complete)
  const totalRef = useRef(total)
  const finishedRef = useRef(onFinished)
  // No animation (reduced motion, or the card is hidden and has no size): finish as soon as the run does.
  const staticRef = useRef(false)
  const [shown, setShown] = useState({ count: 0, survived: 0 })
  const [yTopShown, setYTopShown] = useState(0)
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

    const pad = { top: PAD_Y, bottom: PAD_Y, left: AXIS_LEFT, right: PAD_RIGHT }
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
    const active: { c: CohortResult; born: number; status: Status }[] = []
    const landedStyle: Record<Status, { color: string; alpha: number }> = {
      lasted: { color: colors.lasted, alpha: LASTED_ALPHA },
      short: { color: colors.short, alpha: FAILED_ALPHA },
      failed: { color: colors.failed, alpha: FAILED_ALPHA },
    }

    const tick = (now: number) => {
      const arrived = trialsRef.current
      if (yTop === 0 && arrived.length > 0) {
        yTop = yTopFor(arrived, plan)
        setYTopShown(yTop)
      }
      const all = Math.max(totalRef.current, arrived.length, 1)
      // Spawn on schedule, but never ahead of the trials that have actually finished.
      const due = playback === 0 ? arrived.length : Math.min(arrived.length, Math.floor(((now - start) / playback) * all))
      for (; spawned < due; spawned++) active.push({ c: arrived[spawned], born: now, status: statusOf(arrived[spawned]) })

      ctx.clearRect(0, 0, width, height)
      if (yTop > 0) {
        ctx.strokeStyle = colors.grid
        ctx.lineWidth = 1
        ctx.beginPath()
        for (const v of yTicks(yTop)) {
          const gy = Math.round(y(v)) + 0.5
          ctx.moveTo(pad.left, gy)
          ctx.lineTo(width - pad.right, gy)
        }
        ctx.stroke()
      }
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
    <div aria-live="polite">
      <div className="flex">
        {/* The y-axis title sits outside the plot, left of the dollar labels. */}
        <span className="flex shrink-0 rotate-180 items-center justify-center whitespace-nowrap text-[10px] text-foreground-muted [writing-mode:vertical-rl]" style={{ height }} aria-hidden="true">
          Net worth ($)
        </span>
        <div className="relative min-w-0 flex-1">
          <canvas ref={canvasRef} className="block w-full" style={{ height }} aria-hidden="true" />
          {yTopShown > 0 && <YAxis top={yTopShown} height={height} />}
          {startYear !== undefined && plan.length > 1 && <XAxis startYear={startYear} years={plan.length - 1} />}
          {!done && (
            <div style={{ left: AXIS_LEFT }} className="pointer-events-none absolute top-0 flex flex-col gap-0.5 rounded-lg bg-card/80 px-2.5 py-1.5 backdrop-blur-sm">
              <p className="font-data text-2xl font-semibold tabular-nums text-foreground">{rate === null ? "—" : fmtSuccess(rate)}</p>
              <p className="text-[11px] tabular-nums text-foreground-muted">
                solvent · {counts.count.toLocaleString()}
                {all > 0 ? ` of ${all.toLocaleString()}` : ""} {unit}
              </p>
            </div>
          )}
        </div>
      </div>
      {done ? (
        <Legend trials={trials} />
      ) : (
        <>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-card-border/60">
            <div className="h-full rounded-full bg-primary transition-[width] duration-100" style={{ width: `${all > 0 ? (counts.count / all) * 100 : 0}%` }} />
          </div>
        </>
      )}
    </div>
  )
}

/** Dollar labels on the gridlines, in the canvas's left gutter. */
function YAxis({ top, height }: { top: number; height: number }) {
  const at = (v: number) => height - PAD_Y - (v / top) * (height - 2 * PAD_Y)
  return (
    <div className="pointer-events-none absolute inset-y-0 left-0" style={{ width: AXIS_LEFT, height }} aria-hidden="true">
      {yTicks(top).map((v) => (
        <span key={v} className="absolute right-1.5 -translate-y-1/2 font-data text-[10px] tabular-nums text-foreground-muted" style={{ top: at(v) }}>
          {fmtCompact(v)}
        </span>
      ))}
    </div>
  )
}

/** Calendar years under the plot, on round 5-year marks (10-year on long plans so they don't crowd). */
function XAxis({ startYear, years }: { startYear: number; years: number }) {
  const step = years > 40 ? 10 : 5
  const marks: number[] = []
  for (let i = 0; i <= years; i++) if ((startYear + i) % step === 0) marks.push(i)
  return (
    <div className="pointer-events-none relative h-4" aria-hidden="true">
      {marks.map((i) => (
        <span
          key={i}
          className="absolute top-0.5 -translate-x-1/2 font-data text-[10px] tabular-nums text-foreground-muted"
          style={{ left: `calc(${AXIS_LEFT}px + ${i / years} * (100% - ${AXIS_LEFT + PAD_RIGHT}px))` }}
        >
          {startYear + i}
        </span>
      ))}
    </div>
  )
}

/** Under the finished chart: what each kind of line means, with each outcome's share of the trials (they don't overlap). */
function Legend({ trials }: { trials: CohortResult[] }) {
  const n = { lasted: 0, short: 0, failed: 0 }
  for (const c of trials) n[statusOf(c)]++
  const share = outcomeShares(n)
  const swatch = (color: string, label: string, dashed = false) => (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-4" style={{ borderTop: `2px ${dashed ? "dashed" : "solid"} ${color}` }} aria-hidden="true" />
      {label}
    </span>
  )
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-foreground-muted">
      {swatch("var(--success)", `Fully funded plan (${share.lasted})`)}
      {swatch("var(--warning)", `Portfolio depleted, still solvent (${share.short})`)}
      {swatch("var(--error)", `Assets exhausted (${share.failed})`)}
      {swatch("var(--foreground)", "Your plan (steady returns)", true)}
      <span>Today&apos;s dollars</span>
    </div>
  )
}
