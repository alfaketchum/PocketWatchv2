/**
 * Monte Carlo trials for the stress test: which historical years each trial lives through. A path lists the history
 * position (index into `AnnualHistory.years`) used for each plan year from the anchor on, so every trial keeps that
 * year's stocks, bonds, inflation and CAPE together (their real co-movement), and runs through the same engine as the
 * plain historical replay.
 *
 * - history: every complete historical start year, in order (Early Retirement Now's replay).
 * - restart: each start year in order; when history runs out, jump to a random year and carry on (ProjectionLab's default).
 * - block: random runs of consecutive years stitched together (a block bootstrap): mixes eras, keeps streaks.
 * - random: an independent random year for every plan year.
 *
 * A fixed seed gives the same trials every time, so the headline doesn't move on reload.
 */

/** How trials pick their years. */
export type StressSampling = "history" | "restart" | "block" | "random"

export interface SamplingOptions {
  method: StressSampling
  /** Trials to run (ignored by history, which runs every complete start year). */
  trials: number
  /** Years per block (block only). */
  blockLength: number
  seed: number
}

/** What Basic, the Overview card and the stress test page show by default. */
export const DEFAULT_SAMPLING: SamplingOptions = { method: "block", trials: 500, blockLength: 10, seed: 1 }

export const TRIAL_OPTIONS = [500, 1000, 2000] as const
export const BLOCK_OPTIONS = [5, 10, 15] as const

/** Mulberry32: a small, fast seeded generator; returns floats in [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = (rng: () => number, n: number) => Math.floor(rng() * n)

/** Every complete start year, in order: positions `start … start + length − 1`. */
export function historyPaths(years: number, length: number): number[][] {
  const last = years - length
  return Array.from({ length: Math.max(0, last + 1) }, (_, start) => Array.from({ length }, (_, t) => start + t))
}

/** Starts at `start`, moves chronologically, and jumps to a random year whenever history runs out. */
function restartPath(rng: () => number, years: number, length: number, start: number): number[] {
  const path: number[] = []
  let h = start
  while (path.length < length) {
    if (h >= years) h = pick(rng, years)
    path.push(h++)
  }
  return path
}

/** Random blocks of `block` consecutive years, each wholly inside history, stitched until the path is long enough. */
function blockPath(rng: () => number, years: number, length: number, block: number): number[] {
  const size = Math.max(1, Math.min(block, years))
  const path: number[] = []
  while (path.length < length) {
    const start = pick(rng, years - size + 1)
    for (let t = 0; t < size && path.length < length; t++) path.push(start + t)
  }
  return path
}

/** Trial paths of `length` plan years over a history of `years` years. */
export function trialPaths(years: number, length: number, opts: SamplingOptions): number[][] {
  if (years <= 0 || length <= 0) return []
  if (opts.method === "history") return historyPaths(years, length)
  const rng = seededRandom(opts.seed)
  return Array.from({ length: Math.max(0, opts.trials) }, (_, i) => {
    if (opts.method === "restart") return restartPath(rng, years, length, i % years)
    if (opts.method === "block") return blockPath(rng, years, length, opts.blockLength)
    return Array.from({ length }, () => pick(rng, years))
  })
}

/** Simulated trials (anything but the plain historical replay). */
export const isSimulated = (method: StressSampling) => method !== "history"
