/**
 * Next.js instrumentation hook — runs once on server startup.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
let stopScheduler: (() => void) | null = null

const DEFAULT_DEV_JOBS = "asset-history"

export async function register() {
  // Only run on the Node.js server runtime, not Edge
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { recoverOrphanedJobs } = await import("@/lib/portfolio/sync-recovery")

    try {
      const result = await recoverOrphanedJobs()
      if (result.historySyncRecovered > 0 || result.refreshRecovered > 0) {
        console.log("[instrumentation] Startup recovery complete:", result)
      }
    } catch (err) {
      // Don't block startup if DB isn't ready yet
      console.error("[instrumentation] Startup recovery failed:", err)
    }

    // Start in-process cron scheduler (replaces Vercel cron). Production runs
    // every job; dev runs only DEV_SCHEDULER_JOBS (comma-separated, default
    // asset-history; empty disables) so local work doesn't burn provider quota.
    const isProd = process.env.NODE_ENV === "production"
    const devJobs = (process.env.DEV_SCHEDULER_JOBS ?? DEFAULT_DEV_JOBS)
      .split(",")
      .map((j) => j.trim())
      .filter(Boolean)
    if (!stopScheduler && (isProd || devJobs.length > 0)) {
      try {
        const { startScheduler } = await import("@/lib/scheduler")
        stopScheduler = isProd
          ? startScheduler()
          : startScheduler({ only: devJobs, runOnStart: true })
      } catch (err) {
        console.error("[instrumentation] Scheduler startup failed:", err)
      }
    }
  }
}
