import "dotenv/config"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

// Portfolio-sync health check: latest jobs, wallet address formats, API-key
// health (verified / consecutive429), and any stuck refresh jobs. A bad wallet
// entry can leave persistent poisoned key state, so this surfaces it.
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

function addressKind(addr: string): string {
  const a = addr.trim()
  if (/^0x[0-9a-fA-F]{40}$/.test(a)) return "EVM"
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return "SOLANA?"
  return "UNKNOWN/malformed"
}

async function main() {
  const jobs = await db.portfolioRefreshJob.findMany({
    orderBy: { updatedAt: "desc" }, take: 4,
    select: { status: true, updatedAt: true, error: true, details: true },
  })
  console.log(`\n── Latest refresh jobs ──`)
  for (const j of jobs) {
    const d = (j.details ?? {}) as { warnings?: string[]; walletCount?: number; totalValue?: number }
    console.log(`  ${new Date(j.updatedAt).toLocaleString()} [${j.status}] wallets=${d.walletCount ?? "?"} total=$${Math.round(d.totalValue ?? 0).toLocaleString()} warnings=${d.warnings?.join(",") || "none"}${j.error ? ` err=${j.error.slice(0, 80)}` : ""}`)
  }

  const stuck = await db.portfolioRefreshJob.count({ where: { status: { in: ["queued", "running"] } } })
  const failed = await db.portfolioRefreshJob.count({ where: { status: "failed" } })
  console.log(`  queued/running=${stuck}  failed=${failed}`)

  console.log(`\n── API keys (health) ──`)
  const keys = await db.externalApiKey.findMany({ select: { serviceName: true, label: true, verified: true, consecutive429: true, lastUsedAt: true } })
  if (keys.length === 0) console.log("  (none in DB — using env fallback)")
  for (const k of keys) {
    console.log(`  ${k.serviceName.padEnd(10)} label=${k.label ?? "-"} verified=${k.verified} consec429=${k.consecutive429} lastUsed=${k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "never"}`)
  }

  const ws = await db.trackedWallet.findMany({ orderBy: { createdAt: "desc" }, select: { address: true, chains: true, createdAt: true } })
  console.log(`\n── Tracked wallets (${ws.length}, newest first) ──`)
  for (const w of ws) {
    console.log(`  ${new Date(w.createdAt).toLocaleString()} ${addressKind(w.address).padEnd(16)} ${w.address} chains=${w.chains.length}`)
  }
  console.log("")
}

main().catch((e) => console.error("ERR", e)).finally(() => db.$disconnect())
