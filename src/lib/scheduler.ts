/**
 * In-process cron scheduler — replaces Vercel cron jobs.
 * Started once in instrumentation.ts on server boot.
 * Each job has a concurrency guard to prevent pile-up.
 */
import cron from "node-cron"

const PORT = process.env.PORT ?? "3500"
const BASE_URL = process.env.INTERNAL_BASE_URL ?? `http://localhost:${PORT}`

interface JobConfig {
  readonly name: string
  readonly schedule: string
  readonly endpoint: string
  readonly method: "GET" | "POST"
  readonly headers: Record<string, string>
  /** Abort timeout for this job's fetch. Defaults to 120s, but the heavy
      provider-bound workers (balance/history refresh over many rate-limited
      wallets) need their full server-side maxDuration or they get cut off
      before a snapshot is ever written. */
  readonly timeoutMs?: number
}

// Heavy workers whose server route declares maxDuration ~300s — give the fetch
// almost that long instead of the blanket 120s.
const LONG_TIMEOUT_MS = 290_000

function bearerHeader(secret: string | undefined): Record<string, string> {
  if (!secret) return {}
  return { Authorization: `Bearer ${secret}` }
}

function customHeader(
  key: string,
  secret: string | undefined,
): Record<string, string> {
  if (!secret) return {}
  return { [key]: secret }
}

// Schedules use node-cron's 6-field form (leading seconds) to stagger jobs that
// would otherwise all fire on the same minute boundary — at :00 of every 30th
// minute five jobs used to start at once in the request-serving event loop.
function buildJobs(): readonly JobConfig[] {
  return [
    {
      name: "history-sync",
      schedule: "5 * * * * *",
      endpoint: "/api/internal/history/sync-worker",
      method: "POST",
      headers: customHeader(
        "x-history-cron-secret",
        process.env.HISTORY_CRON_SECRET,
      ),
      timeoutMs: LONG_TIMEOUT_MS,
    },
    {
      name: "finance-sync",
      schedule: "20 */15 * * * *",
      endpoint: "/api/internal/finance-sync-worker",
      method: "POST",
      headers: customHeader(
        "x-finance-sync-secret",
        process.env.FINANCE_SYNC_SECRET,
      ),
    },
    {
      // Every 5 min (not 2): a full refresh of many rate-limited wallets can take
      // minutes, so firing every 2 min just piled up overlapping runs.
      name: "portfolio-refresh",
      schedule: "35 */5 * * * *",
      endpoint: "/api/internal/portfolio/refresh-worker",
      method: "POST",
      headers: customHeader(
        "x-portfolio-refresh-cron-secret",
        process.env.PORTFOLIO_REFRESH_CRON_SECRET,
      ),
      timeoutMs: LONG_TIMEOUT_MS,
    },
    {
      name: "staking-snapshot",
      schedule: "15 0 * * * *",
      endpoint: "/api/internal/staking/snapshot-hourly",
      method: "POST",
      headers: customHeader(
        "x-staking-cron-secret",
        process.env.STAKING_CRON_SECRET,
      ),
    },
    {
      name: "snapshot-worker",
      schedule: "25 */5 * * * *",
      endpoint: "/api/internal/snapshot-worker",
      method: "POST",
      headers: bearerHeader(process.env.SNAPSHOT_WORKER_SECRET),
    },
    {
      // By-asset chart: discovery + budget-capped history backfill (low priority)
      name: "asset-history",
      schedule: "10 */15 * * * *",
      endpoint: "/api/internal/asset-history",
      method: "POST",
      headers: bearerHeader(process.env.SNAPSHOT_WORKER_SECRET),
      timeoutMs: LONG_TIMEOUT_MS,
    },
    {
      name: "classify-transactions",
      schedule: "45 */10 * * * *",
      endpoint: "/api/internal/classify-transactions",
      method: "POST",
      headers: bearerHeader(process.env.SNAPSHOT_WORKER_SECRET),
    },
    {
      name: "backup-worker",
      schedule: "50 0 */6 * * *",
      endpoint: "/api/internal/backup-worker",
      method: "POST",
      headers: bearerHeader(
        process.env.BACKUP_CRON_SECRET ?? process.env.SNAPSHOT_WORKER_SECRET,
      ),
    },
    {
      name: "travel-price-check",
      schedule: "40 */30 * * * *",
      endpoint: "/api/internal/travel/price-check-worker",
      method: "POST",
      headers: bearerHeader(process.env.TRAVEL_PRICE_CHECK_SECRET),
    },
    {
      // Daily at 08:00 — after the default quiet-hours window (ends 07:00).
      name: "finance-digest",
      schedule: "30 0 8 * * *",
      endpoint: "/api/internal/finance-digest-worker",
      method: "POST",
      headers: bearerHeader(process.env.FINANCE_DIGEST_SECRET),
    },
    {
      // Daily at 03:10 — downsample old high-frequency snapshots to daily.
      name: "snapshot-compaction",
      schedule: "10 10 3 * * *",
      endpoint: "/api/internal/snapshot-compaction",
      method: "POST",
      headers: bearerHeader(process.env.SNAPSHOT_WORKER_SECRET),
    },
    {
      // Daily at 04:30 — refresh the login/account directory from Gmail.
      name: "accounts-scan",
      schedule: "55 30 4 * * *",
      endpoint: "/api/internal/accounts-scan-worker",
      method: "POST",
      headers: bearerHeader(process.env.ACCOUNTS_SCAN_SECRET),
      timeoutMs: LONG_TIMEOUT_MS,
    },
  ] as const
}

function createTask(job: JobConfig): {
  task: ReturnType<typeof cron.schedule>
  run: () => Promise<void>
} {
  let running = false

  const run = async () => {
    if (running) {
      console.warn(
        `[scheduler] ${job.name} skipped — previous invocation still running`,
      )
      return
    }
    running = true
    const start = Date.now()
    try {
      const res = await fetch(`${BASE_URL}${job.endpoint}`, {
        method: job.method,
        headers: { "Content-Type": "application/json", ...job.headers },
        signal: AbortSignal.timeout(job.timeoutMs ?? 120_000),
      })
      const elapsed = Date.now() - start
      if (!res.ok) {
        console.error(
          `[scheduler] ${job.name} HTTP ${res.status} (${elapsed}ms)`,
        )
      }
    } catch (err) {
      const elapsed = Date.now() - start
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[scheduler] ${job.name} failed (${elapsed}ms): ${msg}`)
    } finally {
      running = false
    }
  }

  return { task: cron.schedule(job.schedule, run), run }
}

const REQUIRED_SECRETS: Record<string, string> = {
  HISTORY_CRON_SECRET: "history-sync",
  FINANCE_SYNC_SECRET: "finance-sync",
  PORTFOLIO_REFRESH_CRON_SECRET: "portfolio-refresh",
  STAKING_CRON_SECRET: "staking-snapshot",
  SNAPSHOT_WORKER_SECRET: "snapshot-worker, asset-history, classify-transactions, backup-worker",
  TRAVEL_PRICE_CHECK_SECRET: "travel-price-check",
  FINANCE_DIGEST_SECRET: "finance-digest",
  ACCOUNTS_SCAN_SECRET: "accounts-scan",
}

// Delay before a boot-time run, so the server is listening before it calls itself.
const RUN_ON_START_DELAY_MS = 30_000

interface SchedulerOptions {
  /** Start only these jobs (by name). Omit to start every job. */
  readonly only?: readonly string[]
  /** Also run each started job once shortly after boot. */
  readonly runOnStart?: boolean
}

export function startScheduler(options: SchedulerOptions = {}): () => void {
  const { only, runOnStart = false } = options
  // Warn about missing secrets at startup
  for (const [envVar, jobNames] of Object.entries(REQUIRED_SECRETS)) {
    if (!process.env[envVar] && (!only || only.some((n) => jobNames.includes(n)))) {
      console.warn(
        `[scheduler] WARNING: ${envVar} not set — ${jobNames} will fail with 401`,
      )
    }
  }

  const jobs = buildJobs().filter((j) => !only || only.includes(j.name))
  const tasks = jobs.map(createTask)
  console.log(
    `[scheduler] Started ${tasks.length} cron jobs: ${jobs.map((j) => j.name).join(", ")}`,
  )
  const startTimer = runOnStart
    ? setTimeout(() => {
        for (const t of tasks) void t.run()
      }, RUN_ON_START_DELAY_MS)
    : null
  return () => {
    if (startTimer) clearTimeout(startTimer)
    for (const t of tasks) t.task.stop()
    console.log("[scheduler] Stopped all cron jobs")
  }
}
